import { NextFunction, Request, Response } from "express";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import pool from "../../config/db";
import { v4 as uuidv4 } from 'uuid';
import { adapterUserInfo } from "./adapter";
import { getOpenAI } from "../../infrastructure/openIA";
// Función para convertir fecha de DD/MM/YYYY a YYYY-MM-DD
const convertDate = (date: string): string => {
  const [day, month, year] = date.split('/');
  const formattedDate = new Date(`${year}-${month}-${day}`);
  return formattedDate.toISOString().split('T')[0];
};
// Función para validar si un string es un JSON válido
const isValidJson = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};
// Nueva función helper para obtener weekdays únicos de fechas (0=Domingo, 1=Lunes, etc.)
const getTrainingWeekdays = (dates: string[]): number[] => {
  const weekdays = new Set<number>();
  dates.forEach(dateStr => {
    const date = new Date(dateStr);
    weekdays.add(date.getDay());
  });
  return Array.from(weekdays);
};
// Nueva función helper para generar N fechas futuras coincidiendo con weekdays, empezando desde una fecha dada
const generateNewDates = (startDateStr: string, count: number, weekdays: number[]): string[] => {
  const newDates: string[] = [];
  let currentDate = new Date(startDateStr);
  while (newDates.length < count) {
    currentDate.setDate(currentDate.getDate() + 1); // Avanzar un día
    if (weekdays.includes(currentDate.getDay())) {
      newDates.push(currentDate.toISOString().split('T')[0]);
    }
  }
  return newDates;
};
export const generateLightRoutine = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { headers, body } = req;
    console.log('Paso 1: Procesando request con body:', JSON.stringify(body, null, 2));
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;
    console.log('Paso 1: userId extraído del token:', userId);
    // Paso 1: Adaptar la data recibida del front
    const adaptedData = adapterUserInfo(body);
    console.log('Paso 1: Datos adaptados:', JSON.stringify(adaptedData, null, 2));
    // Convertir current_user_date de DD/MM/YYYY a YYYY-MM-DD
    const formattedDate = convertDate(adaptedData.current_user_date);
    console.log('Paso 1: Fecha formateada:', formattedDate);
    // Paso 2: Guardar en una nueva tabla 'user_routine_failures' para control
    const failureId = uuidv4();
    console.log('Paso 2: Generando failureId:', failureId);
    await pool.execute(
      "INSERT INTO user_routine_failures (id, user_id, reason, description, current_user_date, current_user_time) VALUES (?, ?, ?, ?, ?, ?)",
      [failureId, userId, adaptedData.reason, adaptedData.description, formattedDate, adaptedData.current_user_time + ':00']
    );
    console.log('Paso 2: Datos guardados en user_routine_failures');
    // Paso 3: Identificar días pendientes de 'user_routine' (todos pending, sin filtro inicial)
    const [userRoutineRows]: any = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? AND status = 'pending' ORDER BY date",
      [userId]
    );
    console.log('Paso 3: Días pendientes de user_routine:', JSON.stringify(userRoutineRows, null, 2));
    if (userRoutineRows.length === 0) {
      console.log('Paso 3: No se encontraron días pendientes para user_id:', userId);
      res.status(200).json({
        response: "No hay días pendientes para ajustar.",
        error: false,
        message: "Información de fallo guardada, pero no se generó rutina leve.",
        failure_id: failureId,
        user_id: userId
      });
      return;
    }
    // Separar pasados y futuros
    const pastPendingRows = userRoutineRows.filter((row: any) => new Date(row.date).toISOString().split('T')[0] < formattedDate);
    const futurePendingRows = userRoutineRows.filter((row: any) => new Date(row.date).toISOString().split('T')[0] >= formattedDate);
    // Cambiar status a 'failed' solo para pasados
    for (const row of pastPendingRows) {
      await pool.execute(
        "UPDATE user_routine SET status = 'failed' WHERE user_id = ? AND date = ?",
        [userId, row.date]
      );
    }
    console.log('Paso 3: Status actualizado a "failed" para', pastPendingRows.length, 'días pasados pendientes');
    // Contar N = días pasados pendientes (fallados)
    const numPastFailed = pastPendingRows.length;
    // Extraer todas las fechas de user_routine para inferir weekdays de entrenamiento
    const allDates = userRoutineRows.map((row: any) => new Date(row.date).toISOString().split('T')[0]);
    const trainingWeekdays = getTrainingWeekdays(allDates);
    console.log('Paso 3: Días de la semana de entrenamiento inferidos:', trainingWeekdays);
    // Encontrar la última fecha existente (max date)
    const maxDateStr = allDates.reduce((max: any, date: any) => date > max ? date : max, allDates[0]);
    console.log('Paso 3: Última fecha existente en la rutina:', maxDateStr);
    // Generar N nuevas fechas al final, coincidiendo con weekdays, empezando DESDE la última fecha existente
    const newFailedDates = numPastFailed > 0 ? generateNewDates(maxDateStr, numPastFailed, trainingWeekdays) : [];
    console.log('Paso 3: Nuevas fechas generadas para fallados pasados (a partir de la última existente):', newFailedDates);
    // pendingDates: fechas futuras + nuevas para fallados (solo para filtrado inicial)
    const pendingDates = [
      ...futurePendingRows.map((row: any) => new Date(row.date).toISOString().split('T')[0]),
      ...newFailedDates
    ];
    console.log('Paso 3: Fechas pendientes actualizadas (futuras + nuevas para fallados):', pendingDates);
    // Paso 4: Obtener la rutina original de 'user_training_plans'
    const [trainingPlanRows]: any = await pool.execute(
      "SELECT id, training_plan FROM user_training_plans WHERE user_id = ?",
      [userId]
    );
    console.log('Paso 4: Datos de user_training_plans:', JSON.stringify(trainingPlanRows, null, 2));
    if (trainingPlanRows.length === 0) {
      console.log('Paso 4: No se encontró rutina para user_id:', userId);
      res.status(404).json({
        response: "",
        error: true,
        message: "No se encontró rutina original para el usuario.",
        failure_id: failureId,
        user_id: userId
      });
      return;
    }
    const trainingPlanRaw = trainingPlanRows[0].training_plan;
    console.log('Paso 4: Contenido crudo de training_plan:', trainingPlanRaw);
    let originalTrainingPlan;
    // Intentar usar el JSON ya parseado de trainingPlanRows si está disponible
    if (Array.isArray(trainingPlanRows[0].training_plan)) {
      originalTrainingPlan = trainingPlanRows[0].training_plan;
      console.log('Paso 4: Usando training_plan ya parseado de trainingPlanRows:', JSON.stringify(originalTrainingPlan, null, 2));
    } else if (typeof trainingPlanRaw === 'string' && isValidJson(trainingPlanRaw)) {
      try {
        originalTrainingPlan = JSON.parse(trainingPlanRaw);
        console.log('Paso 4: Workouts parseados desde trainingPlanRaw:', JSON.stringify(originalTrainingPlan, null, 2));
      } catch (parseError: any) {
        console.log('Paso 4: Error al parsear training_plan:', parseError.message);
        res.status(400).json({
          response: "",
          error: true,
          message: "Error al parsear el training_plan de la base de datos.",
          failure_id: failureId,
          user_id: userId,
          details: `Contenido de training_plan: ${trainingPlanRaw}. Verifique la fuente de datos en user_training_plans (id: ${trainingPlanRows[0].id}). Asegúrese de que el proceso que guarda training_plan use JSON.stringify() correctamente.`
        });
        return;
      }
    } else {
      console.log('Paso 4: training_plan no es un JSON válido ni un array:', trainingPlanRaw);
      res.status(400).json({
        response: "",
        error: true,
        message: "El formato de training_plan en la base de datos es inválido.",
        failure_id: failureId,
        user_id: userId,
        details: `Contenido de training_plan: ${trainingPlanRaw}. Verifique la fuente de datos en user_training_plans (id: ${trainingPlanRows[0].id}). Asegúrese de que el proceso que guarda training_plan use JSON.stringify() correctamente.`
      });
      return;
    }
    const workouts = originalTrainingPlan; // Array directo
    if (!Array.isArray(workouts)) {
      console.log('Paso 4: training_plan no es un array:', JSON.stringify(originalTrainingPlan, null, 2));
      res.status(400).json({
        response: "",
        error: true,
        message: "La rutina original no es un array válido.",
        failure_id: failureId,
        user_id: userId
      });
      return;
    }
    // Paso 5: Filtrar workouts pendientes a partir de pendingDates actualizadas
    // También recolectar workouts de fechas falladas pasadas para reutilizarlos más tarde (en orden original)
    const pastFailedDates = pastPendingRows.map((row: any) => new Date(row.date).toISOString().split('T')[0]);
    const pastFailedWorkouts = workouts.filter((workout: any) => {
      const workoutDate = new Date(workout.fecha).toISOString().split('T')[0];
      return pastFailedDates.includes(workoutDate);
    }).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()); // Mantener orden original de fallados
    console.log('Paso 5: Workouts de fechas falladas pasadas recolectados (en orden original):', JSON.stringify(pastFailedWorkouts, null, 2));
    const pendingWorkouts = workouts.filter((workout: any) => {
      const workoutDate = new Date(workout.fecha).toISOString().split('T')[0];
      const isPending = pendingDates.includes(workoutDate); // Ahora usa pendingDates con nuevas fechas
      console.log(`Paso 5: Comparando workout.fecha: ${workoutDate} con pendingDates: ${isPending}`);
      return isPending;
    });
    console.log('Paso 5: Workouts pendientes filtrados:', JSON.stringify(pendingWorkouts, null, 2));
    if (pendingWorkouts.length === 0 && pastFailedWorkouts.length === 0) {
      console.log('Paso 5: No se encontraron coincidencias entre pendingDates y workouts.fecha');
      res.status(200).json({
        response: "No se encontraron workouts para los días pendientes.",
        error: false,
        message: "Información de fallo guardada, pero no se generó rutina leve.",
        failure_id: failureId,
        user_id: userId
      });
      return;
    }
    // Paso 6: Obtener ajustes de la IA o usar reglas fijas
    let repsReductionPercentage = 25; // Valores por defecto para rule-based
    let loadReductionPercentage = 25;
    let restIncreaseMinutes = 0.5;
    if (adaptedData.reason !== 'lack_of_time') {
      // Consultar a la IA para recomendaciones de ajustes
      const prompt = `
        Basado en el motivo de fallo "${adaptedData.reason}" y la descripción "${adaptedData.description}", determina los ajustes para una rutina de entrenamiento leve. La rutina contiene ejercicios como sentadillas, press de banca, planchas, etc., cada uno con un número de series, repeticiones, carga, y tiempo de descanso.
        Proporciona los siguientes valores para generar una versión leve:
        - Porcentaje de reducción para las repeticiones (25-50%, según la severidad).
        - Porcentaje de reducción para la carga (25-50%, según la severidad, si no es "Bodyweight").
        - Minutos a aumentar en el tiempo de descanso (0.5-1 minuto, según la severidad).
        Devuelve solo un JSON con la estructura:
        {
          "repsReductionPercentage": number,
          "loadReductionPercentage": number,
          "restIncreaseMinutes": number
        }
        Sin texto adicional.
      `;
      console.log('Paso 6: Enviando prompt a OpenAI:', prompt);
      const { response } = await getOpenAI(prompt);
      if (!response?.choices?.[0]?.message?.content) {
        console.log('Paso 6: No se recibió respuesta de OpenAI');
        res.status(500).json({
          response: "",
          error: true,
          message: "No se generó respuesta de OpenAI.",
          failure_id: failureId,
          user_id: userId
        });
        return;
      }
      let aiAdjustments;
      try {
        aiAdjustments = JSON.parse(response.choices[0].message.content);
        console.log('Paso 6: Respuesta de OpenAI:', JSON.stringify(aiAdjustments, null, 2));
        if (
          typeof aiAdjustments.repsReductionPercentage !== 'number' ||
          typeof aiAdjustments.loadReductionPercentage !== 'number' ||
          typeof aiAdjustments.restIncreaseMinutes !== 'number' ||
          aiAdjustments.repsReductionPercentage < 25 || aiAdjustments.repsReductionPercentage > 50 ||
          aiAdjustments.loadReductionPercentage < 25 || aiAdjustments.loadReductionPercentage > 50 ||
          aiAdjustments.restIncreaseMinutes < 0.5 || aiAdjustments.restIncreaseMinutes > 1
        ) {
          console.log('Paso 6: Formato de ajustes de la IA inválido:', JSON.stringify(aiAdjustments, null, 2));
          res.status(400).json({
            response: "",
            error: true,
            message: "Formato de ajustes de la IA inválido.",
            failure_id: failureId,
            user_id: userId
          });
          return;
        }
        repsReductionPercentage = aiAdjustments.repsReductionPercentage;
        loadReductionPercentage = aiAdjustments.loadReductionPercentage;
        restIncreaseMinutes = aiAdjustments.restIncreaseMinutes;
        console.log('Paso 6: Ajustes de IA aplicados:', { repsReductionPercentage, loadReductionPercentage, restIncreaseMinutes });
      } catch (parseError: any) {
        console.log('Paso 6: Error al parsear respuesta de OpenAI:', parseError.message);
        res.status(400).json({
          response: "",
          error: true,
          message: "Error al parsear la respuesta de la IA.",
          failure_id: failureId,
          user_id: userId,
          details: parseError.message
        });
        return;
      }
    } else {
      console.log('Paso 6: Usando reglas fijas para lack_of_time:', { repsReductionPercentage, loadReductionPercentage, restIncreaseMinutes });
    }
    // Paso 7: Generar la rutina leve
    let lightWorkouts;
    if (adaptedData.reason === 'lack_of_time') {
      // Para lack_of_time, mantener ejercicios sin cambios
      lightWorkouts = pendingWorkouts.map((workout: any) => ({ ...workout }));
    } else {
      // Para otras razones, ajustar Reps, carga y Descanso
      lightWorkouts = pendingWorkouts.map((workout: any) => {
        const adjustedExercises = workout.ejercicios.map((exercise: any) => {
          const seriesCount = exercise.Esquema.Series; // Mantener Series sin cambios
          let descansoAumentado = parseFloat(exercise.Esquema.Descanso) + restIncreaseMinutes;
          let adjustedSeries = exercise.Esquema["Detalle series"].map((serie: any) => {
            let repsReducidos = Math.max(1, Math.floor(serie.Reps * (1 - repsReductionPercentage / 100)));
            let cargaReducida = serie.carga === "Bodyweight"
              ? "Bodyweight"
              : Math.max(0, Math.floor(serie.carga * (1 - loadReductionPercentage / 100)));
            return {
              Reps: repsReducidos,
              carga: cargaReducida
            };
          });
          return {
            ...exercise,
            Esquema: {
              ...exercise.Esquema,
              Series: seriesCount,
              Descanso: descansoAumentado.toString(),
              "Detalle series": adjustedSeries
            }
          };
        });
        return {
          ...workout,
          ejercicios: adjustedExercises
        };
      });
    }
    // Ajustar también los workouts de fallados pasados (aplicar mismos ajustes leves, en orden original)
    const lightPastFailedWorkouts = adaptedData.reason === 'lack_of_time'
      ? pastFailedWorkouts.map((workout: any) => ({ ...workout }))
      : pastFailedWorkouts.map((workout: any) => {
        const adjustedExercises = workout.ejercicios.map((exercise: any) => {
          const seriesCount = exercise.Esquema.Series;
          let descansoAumentado = parseFloat(exercise.Esquema.Descanso) + restIncreaseMinutes;
          let adjustedSeries = exercise.Esquema["Detalle series"].map((serie: any) => {
            let repsReducidos = Math.max(1, Math.floor(serie.Reps * (1 - repsReductionPercentage / 100)));
            let cargaReducida = serie.carga === "Bodyweight"
              ? "Bodyweight"
              : Math.max(0, Math.floor(serie.carga * (1 - loadReductionPercentage / 100)));
            return {
              Reps: repsReducidos,
              carga: cargaReducida
            };
          });
          return {
            ...exercise,
            Esquema: {
              ...exercise.Esquema,
              Series: seriesCount,
              Descanso: descansoAumentado.toString(),
              "Detalle series": adjustedSeries
            }
          };
        });
        return {
          ...workout,
          ejercicios: adjustedExercises
        };
      });
    console.log('Paso 7: Rutina leve generada (incluyendo fallados pasados):', JSON.stringify([...lightWorkouts, ...lightPastFailedWorkouts], null, 2));
    // Paso 8: Mantener fechas originales de los workouts pendientes
    const updatedLightWorkouts = lightWorkouts.filter((workout: any) => {
      const workoutDate = new Date(workout.fecha);
      const endDate = userRoutineRows[0]?.end_date ? new Date(userRoutineRows[0].end_date) : null;
      return !endDate || workoutDate <= endDate;
    });
    // Filtrar también fallados pasados (aunque sus fechas nuevas ya son futuras, al final)
    const updatedLightPastFailedWorkouts = lightPastFailedWorkouts.filter((workout: any) => {
      // Nota: Como asignaremos fechas nuevas más adelante, aquí solo filtramos por estructura
      return true; // Asumimos que las nuevas fechas extenderán el período si es necesario
    });
    console.log('Paso 8: Workouts con fechas originales (pendientes) y fallados filtrados:', JSON.stringify([...updatedLightWorkouts, ...updatedLightPastFailedWorkouts], null, 2));
    if (updatedLightWorkouts.length === 0 && updatedLightPastFailedWorkouts.length === 0) {
      console.log('Paso 8: No hay workouts válidos dentro del período de la rutina');
      res.status(200).json({
        response: "No hay workouts válidos dentro del período de la rutina.",
        error: false,
        message: "Información de fallo guardada, pero no se generó rutina leve.",
        failure_id: failureId,
        user_id: userId
      });
      return;
    }
    // Paso 9: Crear una nueva rutina sin modificar la original
    let newTrainingPlan = [...workouts];
    // Eliminar workouts de fechas falladas pasadas antiguas
    newTrainingPlan = newTrainingPlan.filter((w: any) => {
      const wDate = new Date(w.fecha).toISOString().split('T')[0];
      return !pastFailedDates.includes(wDate);
    });
    // Actualizar/reemplazar workouts pendientes existentes (futuros, manteniendo fechas originales)
    updatedLightWorkouts.forEach((lightWorkout: any) => {
      const workoutDate = new Date(lightWorkout.fecha).toISOString().split('T')[0];
      const index = newTrainingPlan.findIndex((w: any) => new Date(w.fecha).toISOString().split('T')[0] === workoutDate);
      if (index !== -1) {
        newTrainingPlan[index] = lightWorkout;
      } else {
        newTrainingPlan.push(lightWorkout);
      }
    });
    // Agregar workouts de fallados pasados AL FINAL con nuevas fechas (corridas secuencialmente después de la última)
    updatedLightPastFailedWorkouts.forEach((lightWorkout: any, index: number) => {
      const newDate = newFailedDates[index];
      if (newDate) {
        newTrainingPlan.push({
          ...lightWorkout,
          fecha: newDate // Asignar nueva fecha corrida
        });
      }
    });
    // Ordenar el newTrainingPlan por fecha ascendente para consistencia cronológica (mantiene orden original tanto como posible)
    newTrainingPlan.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    console.log('Paso 9: Nueva rutina generada (con fallados al final, fechas corridas y orden cronológico):', JSON.stringify(newTrainingPlan, null, 2));
    // Guardar la nueva rutina en una nueva tabla (o actualizar user_training_plans si es necesario)
    await pool.execute(
      "UPDATE user_training_plans SET training_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      [JSON.stringify(newTrainingPlan), userId]
    );
    console.log('Paso 9: user_training_plans actualizado con nueva rutina');
    // Paso 10: Responder con la rutina leve generada
    res.status(200).json({
      response: "Rutina leve generada exitosamente.",
      error: false,
      message: `Información de fallo guardada y rutina ajustada por ${adaptedData.reason}.`,
      failure_id: failureId,
      user_id: userId,
      light_workouts: [...updatedLightWorkouts, ...updatedLightPastFailedWorkouts.map((w, i) => ({ ...w, fecha: newFailedDates[i] }))].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
    });
    console.log('Paso 10: Respuesta enviada:', JSON.stringify({ light_workouts: [...updatedLightWorkouts, ...updatedLightPastFailedWorkouts.map((w, i) => ({ ...w, fecha: newFailedDates[i] }))].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()) }, null, 2));
  } catch (error: any) {
    console.error('Error en generateLightRoutine:', error);
    res.status(500).json({
      response: "",
      error: true,
      message: "Ocurrió un error al generar la rutina leve.",
      details: error.message
    });
  }
};