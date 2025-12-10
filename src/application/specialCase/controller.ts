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
      "INSERT INTO user_routine_failures (id, user_id, reason, description, current_user_date) VALUES (?, ?, ?, ?, ?)",
      [failureId, userId, adaptedData.reason, adaptedData.description, formattedDate]
    );
    console.log('Paso 2: Datos guardados en user_routine_failures');
    // Paso 3: Obtener metadata eficiente
    const [pastCountRow]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM user_routine WHERE user_id = ? AND status = 'pending' AND date < ?",
      [userId, formattedDate]
    );
    const numPastFailed = pastCountRow[0].count;
    console.log('Paso 3: Número de días pasados pendientes:', numPastFailed);

    const [futureCountRow]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM user_routine WHERE user_id = ? AND status = 'pending' AND date >= ?",
      [userId, formattedDate]
    );
    const numFuturePending = futureCountRow[0].count;
    console.log('Paso 3: Número de días futuros pendientes:', numFuturePending);

    if (numPastFailed + numFuturePending === 0) {
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

    const MAX_PAST_FAILED = 60; // Límite razonable para evitar consultas largas
    if (numPastFailed > MAX_PAST_FAILED) {
      console.log('Paso 3: Demasiados días pasados pendientes:', numPastFailed);
      res.status(400).json({
        response: "",
        error: true,
        message: `Demasiados días pendientes pasados (${numPastFailed} > ${MAX_PAST_FAILED}). Contacte soporte para limpieza de datos históricos.`,
        failure_id: failureId,
        user_id: userId
      });
      return;
    }

    // Actualizar status a 'failed' para pendientes pasados en una sola query eficiente
    await pool.execute(
      "UPDATE user_routine SET status = 'failed' WHERE user_id = ? AND status = 'pending' AND date < ?",
      [userId, formattedDate]
    );
    console.log('Paso 3: Status actualizado a "failed" para', numPastFailed, 'días pasados pendientes');

    // Fetch fechas de futuros pendientes si es necesario
    const [futureDatesRows]: any = await pool.execute(
      "SELECT date FROM user_routine WHERE user_id = ? AND status = 'pending' AND date >= ? ORDER BY date",
      [userId, formattedDate]
    );
    const futurePendingDates = futureDatesRows.map((row: any) => new Date(row.date).toISOString().split('T')[0]);
    console.log('Paso 3: Fechas de días futuros pendientes:', futurePendingDates);

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
    // Paso 5: Filtrar solo workouts pendientes futuros para posibles ajustes
    const futurePendingWorkouts = workouts.filter((workout: any) => {
      const workoutDate = new Date(workout.fecha).toISOString().split('T')[0];
      return futurePendingDates.includes(workoutDate);
    }).sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    console.log('Paso 5: Workouts pendientes futuros filtrados:', JSON.stringify(futurePendingWorkouts, null, 2));
    if (futurePendingWorkouts.length === 0 && numPastFailed === 0) {
      console.log('Paso 5: No se encontraron workouts relevantes para ajustes');
      res.status(200).json({
        response: "No se encontraron workouts para los días pendientes.",
        error: false,
        message: "Información de fallo guardada, pero no se generó rutina leve.",
        failure_id: failureId,
        user_id: userId
      });
      return;
    }
    // Paso 6: Obtener ajustes solo si la razón es 'injury' o 'enfermedad'
    let applyAdjustments = false;
    let repsReductionPercentage = 25; // Valores por defecto
    let restIncreaseMinutes = 0.5;
    if (adaptedData.reason === 'injury') {
      applyAdjustments = true;
      // Consultar a la IA para recomendaciones de ajustes
      const prompt = `
        Basado en el motivo de fallo "${adaptedData.reason}" y la descripción "${adaptedData.description}", determina los ajustes para una rutina de entrenamiento leve. La rutina contiene ejercicios como sentadillas, press de banca, planchas, etc., cada uno con un número de series, repeticiones, y tiempo de descanso.
        Proporciona los siguientes valores para generar una versión leve:
        - Porcentaje de reducción para las repeticiones (25-50%, según la severidad).
        - Minutos a aumentar en el tiempo de descanso (0.5-1 minuto, según la severidad).
        Devuelve solo un JSON con la estructura:
        {
          "repsReductionPercentage": number,
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
          typeof aiAdjustments.restIncreaseMinutes !== 'number' ||
          aiAdjustments.repsReductionPercentage < 25 || aiAdjustments.repsReductionPercentage > 50 ||
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
        restIncreaseMinutes = aiAdjustments.restIncreaseMinutes;
        console.log('Paso 6: Ajustes de IA aplicados:', { repsReductionPercentage, restIncreaseMinutes });
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
      console.log('Paso 6: No se aplican ajustes para la razón:', adaptedData.reason);
    }
    // Paso 7: Generar rutina leve solo para futuros si aplica ajustes
    let lightFutureWorkouts = futurePendingWorkouts;
    if (applyAdjustments) {
      lightFutureWorkouts = futurePendingWorkouts.map((workout: any) => {
        const adjustedExercises = workout.ejercicios.map((exercise: any) => {
          const seriesCount = exercise.Esquema.Series;
          let descansoAumentado = parseFloat(exercise.Esquema.Descanso) + restIncreaseMinutes;
          let adjustedSeries = exercise.Esquema["Detalle series"].map((serie: any) => {
            let repsReducidos = Math.max(1, Math.floor(serie.Reps * (1 - repsReductionPercentage / 100)));
            return {
              Reps: repsReducidos
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
      console.log('Paso 7: Rutina leve generada para futuros:', JSON.stringify(lightFutureWorkouts, null, 2));
    } else {
      console.log('Paso 7: No se generó rutina leve ya que no aplica ajustes para esta razón');
    }
    // Paso 8: Mantener el full training plan
    let newTrainingPlan = [...workouts];
    let updated = false;
    if (applyAdjustments) {
      lightFutureWorkouts.forEach((lightWorkout: any) => {
        const workoutDate = new Date(lightWorkout.fecha).toISOString().split('T')[0];
        const index = newTrainingPlan.findIndex((w: any) => new Date(w.fecha).toISOString().split('T')[0] === workoutDate);
        if (index !== -1) {
          newTrainingPlan[index] = lightWorkout;
          updated = true;
        }
      });
      // Ordenar por fecha ascendente para consistencia
      newTrainingPlan.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
      console.log('Paso 8: Nueva rutina completa generada con ajustes en futuros:', JSON.stringify(newTrainingPlan, null, 2));
    } else {
      console.log('Paso 8: Rutina completa sin cambios en workouts');
    }
    // Paso 9: Actualizar en BD solo si hubo ajustes
    if (updated) {
      await pool.execute(
        "UPDATE user_training_plans SET training_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
        [JSON.stringify(newTrainingPlan), userId]
      );
      console.log('Paso 9: user_training_plans actualizado con nueva rutina');
    } else {
      console.log('Paso 9: No se actualizó user_training_plans ya que no hubo ajustes');
    }
    // Paso 10: Responder con la rutina completa
    res.status(200).json({
      response: applyAdjustments ? "Rutina leve generada exitosamente para futuros." : "Información de fallo guardada sin ajustes en rutina.",
      error: false,
      message: `Información de fallo guardada y estados actualizados por ${adaptedData.reason}.`,
      failure_id: failureId,
      user_id: userId,
      full_routine: newTrainingPlan
    });
    console.log('Paso 10: Respuesta enviada con rutina completa:', JSON.stringify({ full_routine: newTrainingPlan }, null, 2));
  } catch (error: any) {
    console.error('Error en generateLightRoutine:', error);
    res.status(500).json({
      response: "",
      error: true,
      message: "Ocurrió un error al procesar la rutina.",
      details: error.message
    });
  }
};