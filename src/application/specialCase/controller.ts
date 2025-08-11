import { NextFunction, Request, Response } from "express";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import pool from "../../config/db";
import { v4 as uuidv4 } from 'uuid';
import { adapterUserInfo } from "./adapter";

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

    // Paso 2: Guardar en una nueva tabla 'user_routine_failures' para control
    const failureId = uuidv4();
    await pool.execute(
      "INSERT INTO user_routine_failures (id, user_id, reason, description, current_user_date, current_user_time) VALUES (?, ?, ?, ?, ?, ?)",
      [failureId, userId, adaptedData.reason, adaptedData.description, adaptedData.current_user_date, adaptedData.current_user_time]
    );

    // Nuevo Paso 3: Identificar días pendientes de 'user_routine'
    // Filtramos por date >= current_user_date (asumiendo formato YYYY-MM-DD)
    // Si tienes un campo 'estado' en user_routine, agrégalo al WHERE (ej: AND estado = 'pendiente')
    const [userRoutineRows]: any = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? AND date >= ? ORDER BY date",
      [userId, adaptedData.current_user_date]
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

    // Extraer las fechas pendientes
    const pendingDates = userRoutineRows.map((row: any) => row.date);

    // Nuevo Paso 4: Obtener la rutina original de 'user_training_plans'
    const [trainingPlanRows]: any = await pool.execute(
      "SELECT training_plan FROM user_training_plans WHERE user_id = ?",
      [userId]
    );

    if (trainingPlanRows.length === 0) {
      throw new Error("No se encontró rutina original para el usuario.");
    }

    const originalTrainingPlan = JSON.parse(trainingPlanRows[0].training_plan);
    const workouts = originalTrainingPlan.workouts || originalTrainingPlan.training_plan; // Basado en tu controlador principal

    if (!Array.isArray(workouts)) {
      throw new Error("La rutina original no es un array válido.");
    }

    // Filtrar solo los workouts para fechas pendientes
    const pendingWorkouts = workouts.filter((workout: any) => pendingDates.includes(workout.fecha));

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

    // Nuevo Paso 5: Ajustar la rutina leve (rule-based: reducir series, aumentar descanso)
    // Ejemplos de reglas: series * 0.75 (mínimo 1), descanso + 60s
    // Ajustar basado en 'reason' o 'description' (ej: si 'injury', reducir más)
    const lightWorkouts = pendingWorkouts.map((workout: any) => {
      const adjustedExercises = workout.exercises.map((exercise: any) => { // Usando tu interface Exercise
        let seriesReducidas = Math.max(1, Math.floor(exercise.series_completed.length * 0.75)); // Asumiendo series_completed es el array de series
        let descansoAumentado = exercise.series_completed.map((serie: any) => ({
          ...serie,
          breakTime: serie.breakTime + 60 // Aumentar 60s base
        }));

        // Ajustes adicionales por reason
        if (adaptedData.reason === 'injury') {
          seriesReducidas = Math.max(1, Math.floor(exercise.series_completed.length * 0.5)); // Reducir más si lesión
          descansoAumentado = descansoAumentado.map((serie: any) => ({
            ...serie,
            breakTime: serie.breakTime + 30 // +30s extra
          }));
        } else if (adaptedData.reason === 'sickness') {
          // Otros ajustes si es sickness, etc.
        }

        return {
          ...exercise,
          series_completed: descansoAumentado.slice(0, seriesReducidas) // Reducir el array de series si es necesario
        };
      });

      return {
        ...workout,
        exercises: adjustedExercises
      };
    });

    // Nuevo Paso 6: Guardar la rutina leve (ej: actualizar user_training_plans o crear nueva tabla)
    // Aquí actualizamos el mismo registro, reemplazando solo los workouts pendientes
    const updatedWorkouts = workouts.map((workout: any) =>
      pendingDates.includes(workout.fecha) ? lightWorkouts.find((lw: any) => lw.fecha === workout.fecha) : workout
    );

    const updatedTrainingPlanJson = JSON.stringify({ workouts: updatedWorkouts }); // Ajusta si usas 'training_plan'

    await pool.execute(
      "UPDATE user_training_plans SET training_plan = ? WHERE user_id = ?",
      [updatedTrainingPlanJson, userId]
    );

    // Opcional: Actualizar estado en user_routine si agregas un campo 'estado'
    // await pool.execute("UPDATE user_routine SET estado = 'leve_generada' WHERE user_id = ? AND date IN (?)", [userId, pendingDates]);

    // Paso 7: Responder con la rutina leve generada (solo los días ajustados)
    res.json({
      response: "Rutina leve generada exitosamente.",
      error: false,
      message: `Información de fallo guardada y rutina ajustada por ${adaptedData.reason}.`,
      failure_id: failureId,
      user_id: userId,
      light_workouts: lightWorkouts // Solo retornar los ajustados
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