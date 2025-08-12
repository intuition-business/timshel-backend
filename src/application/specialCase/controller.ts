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

// Función para sumar días a una fecha
const addDays = (date: Date, days: number): string => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate.toISOString();
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
    console.log('Paso 1: Procesando request con body:', body);
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;
    console.log('Paso 1: userId extraído del token:', userId);

    // Paso 1: Adaptar la data recibida del front
    const adaptedData = adapterUserInfo(body);
    console.log('Paso 1: Datos adaptados:', adaptedData);

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

    // Paso 3: Identificar días pendientes de 'user_routine'
    const [userRoutineRows]: any = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? AND date >= ? AND status = 'pending' ORDER BY date",
      [userId, formattedDate]
    );
    console.log('Paso 3: Días pendientes de user_routine:', userRoutineRows);

    if (userRoutineRows.length === 0) {
      console.log('Paso 3: No se encontraron días pendientes para user_id:', userId, 'y fecha >=', formattedDate);
      res.status(200).json({
        response: "No hay días pendientes para ajustar.",
        error: false,
        message: "Información de fallo guardada, pero no se generó rutina leve.",
        failure_id: failureId,
        user_id: userId
      });
      return;
    }

    // Extraer las fechas pendientes (YYYY-MM-DD)
    const pendingDates = userRoutineRows.map((row: any) => new Date(row.date).toISOString().split('T')[0]);
    console.log('Paso 3: Fechas pendientes extraídas:', pendingDates);

    // Paso 4: Obtener la rutina original de 'user_training_plans'
    const [trainingPlanRows]: any = await pool.execute(
      "SELECT training_plan FROM user_training_plans WHERE user_id = ?",
      [userId]
    );
    console.log('Paso 4: Datos de user_training_plans:', trainingPlanRows);

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

    if (!isValidJson(trainingPlanRaw)) {
      console.log('Paso 4: training_plan no es un JSON válido:', trainingPlanRaw);
      res.status(400).json({
        response: "",
        error: true,
        message: "El formato de training_plan en la base de datos es inválido.",
        failure_id: failureId,
        user_id: userId,
        details: `Contenido de training_plan: ${trainingPlanRaw}`
      });
      return;
    }

    let originalTrainingPlan;
    try {
      originalTrainingPlan = JSON.parse(trainingPlanRaw);
      console.log('Paso 4: Workouts parseados:', originalTrainingPlan);
    } catch (parseError: any) {
      console.log('Paso 4: Error al parsear training_plan:', parseError.message);
      res.status(400).json({
        response: "",
        error: true,
        message: "Error al parsear el training_plan de la base de datos.",
        failure_id: failureId,
        user_id: userId,
        details: parseError.message
      });
      return;
    }

    const workouts = originalTrainingPlan; // Array directo
    if (!Array.isArray(workouts)) {
      console.log('Paso 4: training_plan no es un array:', originalTrainingPlan);
      res.status(400).json({
        response: "",
        error: true,
        message: "La rutina original no es un array válido.",
        failure_id: failureId,
        user_id: userId
      });
      return;
    }

    // Convertir fechas ISO a YYYY-MM-DD para comparación
    const pendingWorkouts = workouts.filter((workout: any) => {
      const workoutDate = new Date(workout.fecha).toISOString().split('T')[0];
      const isPending = pendingDates.includes(workoutDate);
      console.log(`Paso 4: Comparando workout.fecha: ${workoutDate} con pendingDates: ${isPending}`);
      return isPending;
    });
    console.log('Paso 4: Workouts pendientes filtrados:', pendingWorkouts);

    if (pendingWorkouts.length === 0) {
      console.log('Paso 4: No se encontraron coincidencias entre pendingDates y workouts.fecha');
      res.status(200).json({
        response: "No se encontraron workouts para los días pendientes.",
        error: false,
        message: "Información de fallo guardada, pero no se generó rutina leve.",
        failure_id: failureId,
        user_id: userId
      });
      return;
    }

    // Paso 5: Obtener ajustes de la IA o usar reglas fijas
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
      console.log('Paso 5: Enviando prompt a OpenAI:', prompt);

      const { response } = await getOpenAI(prompt);

      if (!response?.choices?.[0]?.message?.content) {
        console.log('Paso 5: No se recibió respuesta de OpenAI');
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
        console.log('Paso 5: Respuesta de OpenAI:', aiAdjustments);
        if (
          typeof aiAdjustments.repsReductionPercentage !== 'number' ||
          typeof aiAdjustments.loadReductionPercentage !== 'number' ||
          typeof aiAdjustments.restIncreaseMinutes !== 'number' ||
          aiAdjustments.repsReductionPercentage < 25 || aiAdjustments.repsReductionPercentage > 50 ||
          aiAdjustments.loadReductionPercentage < 25 || aiAdjustments.loadReductionPercentage > 50 ||
          aiAdjustments.restIncreaseMinutes < 0.5 || aiAdjustments.restIncreaseMinutes > 1
        ) {
          console.log('Paso 5: Formato de ajustes de la IA inválido:', aiAdjustments);
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
        console.log('Paso 5: Ajustes de IA aplicados:', { repsReductionPercentage, loadReductionPercentage, restIncreaseMinutes });
      } catch (parseError: any) {
        console.log('Paso 5: Error al parsear respuesta de OpenAI:', parseError.message);
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
      console.log('Paso 5: Usando reglas fijas para lack_of_time:', { repsReductionPercentage, loadReductionPercentage, restIncreaseMinutes });
    }

    // Paso 6: Ajustar la rutina leve usando los valores (de IA o default)
    let lightWorkouts = pendingWorkouts.map((workout: any) => {
      const adjustedExercises = workout.ejercicios.map((exercise: any) => {
        const seriesCount = Math.max(1, Math.floor(exercise.Esquema.Series * (1 - repsReductionPercentage / 100)));
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
            // cspell:ignore Descanso
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
    console.log('Paso 6: Rutina leve generada:', lightWorkouts);

    // Paso 7: Actualizar fechas a partir de current_user_date
    lightWorkouts.sort((a: any, b: any) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
    const baseNewDate = new Date(formattedDate);
    const [routineRows]: any = await pool.execute(
      "SELECT start_date, end_date FROM user_routine WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const endDate = routineRows[0]?.end_date ? new Date(routineRows[0].end_date) : null;
    console.log('Paso 7: Fecha base:', formattedDate, 'end_date:', endDate);

    const updatedLightWorkouts: any[] = [];
    lightWorkouts.forEach((workout: any, index: number) => {
      const newDate = addDays(baseNewDate, index);
      const newDateObj = new Date(newDate);
      if (!endDate || newDateObj <= endDate) {
        updatedLightWorkouts.push({
          ...workout,
          fecha: newDateObj.toISOString()
        });
      }
    });
    console.log('Paso 7: Workouts con fechas actualizadas:', updatedLightWorkouts);

    if (updatedLightWorkouts.length === 0) {
      console.log('Paso 7: No hay workouts válidos dentro del período de la rutina');
      res.status(200).json({
        response: "No hay workouts válidos dentro del período de la rutina.",
        error: false,
        message: "Información de fallo guardada, pero no se generó rutina leve.",
        failure_id: failureId,
        user_id: userId
      });
      return;
    }

    // Paso 8: Guardar la rutina leve
    const updatedWorkouts = workouts.map((workout: any) => {
      const workoutDate = new Date(workout.fecha).toISOString().split('T')[0];
      const matchingLightWorkout = updatedLightWorkouts.find(
        (lw: any) => new Date(lw.fecha).toISOString().split('T')[0] === workoutDate
      );
      console.log(`Paso 8: Comparando workout.fecha: ${workoutDate} con lightWorkout.fecha: ${matchingLightWorkout?.fecha}`);
      return matchingLightWorkout || workout;
    });

    const updatedTrainingPlanJson = JSON.stringify(updatedWorkouts);
    console.log('Paso 8: JSON actualizado para user_training_plans:', updatedTrainingPlanJson);

    await pool.execute(
      "UPDATE user_training_plans SET training_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      [updatedTrainingPlanJson, userId]
    );
    console.log('Paso 8: user_training_plans actualizado');

    // Paso 9: Actualizar status en user_routine
    await pool.execute(
      "UPDATE user_routine SET status = 'leve_generada' WHERE user_id = ? AND date IN (?)",
      [userId, pendingDates]
    );
    console.log('Paso 9: user_routine actualizado con status = leve_generada para fechas:', pendingDates);

    // Paso 10: Responder con la rutina leve generada
    res.status(200).json({
      response: "Rutina leve generada exitosamente.",
      error: false,
      message: `Información de fallo guardada y rutina ajustada por ${adaptedData.reason}.`,
      failure_id: failureId,
      user_id: userId,
      light_workouts: updatedLightWorkouts
    });
    console.log('Paso 10: Respuesta enviada:', { light_workouts: updatedLightWorkouts });
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