import { NextFunction, Request, Response } from "express";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import pool from "../../config/db";
import { v4 as uuidv4 } from 'uuid';
import { adapterUserInfo } from "./adapter";

// Función para convertir fecha de DD/MM/YYYY a YYYY-MM-DD
const convertDate = (date: string): string => {
  const [day, month, year] = date.split('/');
  const formattedDate = new Date(`${year}-${month}-${day}`);
  return formattedDate.toISOString().split('T')[0];
};

export const generateLightRoutine = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { headers, body } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    // Paso 1: Adaptar la data recibida del front
    const adaptedData = adapterUserInfo(body);

    // Convertir current_user_date de DD/MM/YYYY a YYYY-MM-DD
    const formattedDate = convertDate(adaptedData.current_user_date);

    // Paso 2: Guardar en una nueva tabla 'user_routine_failures' para control
    const failureId = uuidv4();
    await pool.execute(
      "INSERT INTO user_routine_failures (id, user_id, reason, description, current_user_date, current_user_time) VALUES (?, ?, ?, ?, ?, ?)",
      [failureId, userId, adaptedData.reason, adaptedData.description, formattedDate, adaptedData.current_user_time + ':00']
    );

    // Paso 3: Identificar días pendientes de 'user_routine'
    const [userRoutineRows]: any = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? AND date >= ? AND status = 'pending' ORDER BY date",
      [userId, formattedDate]
    );

    if (userRoutineRows.length === 0) {
      res.json({
        response: "No hay días pendientes para ajustar.",
        error: false,
        message: "Información de fallo guardada, pero no se generó rutina leve.",
        failure_id: failureId,
        user_id: userId
      });
      return;
    }

    // Extraer las fechas pendientes (YYYY-MM-DD)
    const pendingDates = userRoutineRows.map((row: any) => row.date);

    // Paso 4: Obtener la rutina original de 'user_training_plans'
    const [trainingPlanRows]: any = await pool.execute(
      "SELECT training_plan FROM user_training_plans WHERE user_id = ?",
      [userId]
    );

    if (trainingPlanRows.length === 0) {
      throw new Error("No se encontró rutina original para el usuario.");
    }

    const originalTrainingPlan = JSON.parse(trainingPlanRows[0].training_plan);
    const workouts = originalTrainingPlan; // Array directo

    if (!Array.isArray(workouts)) {
      throw new Error("La rutina original no es un array válido.");
    }

    // Convertir fechas ISO a YYYY-MM-DD para comparación
    const pendingWorkouts = workouts.filter((workout: any) => {
      const workoutDate = new Date(workout.fecha).toISOString().split('T')[0];
      return pendingDates.includes(workoutDate);
    });

    if (pendingWorkouts.length === 0) {
      res.json({
        response: "No se encontraron workouts para los días pendientes.",
        error: false,
        message: "Información de fallo guardada, pero no se generó rutina leve.",
        failure_id: failureId,
        user_id: userId
      });
      return;
    }

    // Paso 5: Ajustar la rutina leve (rule-based)
    const lightWorkouts = pendingWorkouts.map((workout: any) => {
      const adjustedExercises = workout.ejercicios.map((exercise: any) => {
        const seriesCount = exercise.Esquema.Series;
        // Declarar descansoAumentado fuera del map de series
        let descansoAumentado = parseFloat(exercise.Esquema.Descanso) + 0.5; // +0.5 minutos base

        // Ajustar Reps y carga, mantener Series
        let adjustedSeries = exercise.Esquema["Detalle series"].map((serie: any) => {
          let repsReducidos = Math.max(1, Math.floor(serie.Reps * 0.75));
          let cargaReducida = serie.carga === "Bodyweight" ? "Bodyweight" : Math.max(0, Math.floor(serie.carga * 0.75));

          if (adaptedData.reason === 'injury') {
            repsReducidos = Math.max(1, Math.floor(serie.Reps * 0.5));
            cargaReducida = serie.carga === "Bodyweight" ? "Bodyweight" : Math.max(0, Math.floor(serie.carga * 0.5));
            descansoAumentado += 0.5; // +0.5 minutos extra
          } else if (adaptedData.reason === 'sickness') {
            // Opcional: Ajustes para sickness
            repsReducidos = Math.max(1, Math.floor(serie.Reps * 0.7));
            cargaReducida = serie.carga === "Bodyweight" ? "Bodyweight" : Math.max(0, Math.floor(serie.carga * 0.7));
            descansoAumentado += 0.3; // +0.3 minutos para sickness
          }

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

    // Paso 6: Guardar la rutina leve
    const updatedWorkouts = workouts.map((workout: any) => {
      const workoutDate = new Date(workout.fecha).toISOString().split('T')[0];
      return pendingDates.includes(workoutDate)
        ? lightWorkouts.find((lw: any) => new Date(lw.fecha).toISOString().split('T')[0] === workoutDate)
        : workout;
    });

    const updatedTrainingPlanJson = JSON.stringify(updatedWorkouts);

    await pool.execute(
      "UPDATE user_training_plans SET training_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
      [updatedTrainingPlanJson, userId]
    );

    // Paso 7: Actualizar status en user_routine
    await pool.execute(
      "UPDATE user_routine SET status = 'leve_generada' WHERE user_id = ? AND date IN (?)",
      [userId, pendingDates]
    );

    // Paso 8: Responder con la rutina leve generada
    res.json({
      response: "Rutina leve generada exitosamente.",
      error: false,
      message: `Información de fallo guardada y rutina ajustada por ${adaptedData.reason}.`,
      failure_id: failureId,
      user_id: userId,
      light_workouts: lightWorkouts
    });
  } catch (error) {
    console.error("Error al procesar la rutina leve:", error);
    res.json({
      response: "",
      error: true,
      message: "Ocurrió un error al generar la rutina leve.",
      details: error,
    });
    next(error);
  }
};