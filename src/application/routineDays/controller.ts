import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterRoutineDays } from "./adapter";
import { createRoutineDto, getRoutineDto, updateRoutineStatusDto, deleteRoutineDto } from "./dto"; // Importamos los DTOs



// Crear la rutina global para un usuario
export const createRoutine = async (req: Request, res: Response, next: NextFunction) => {
  const { selected_days } = req.body;  // Días seleccionados enviados desde el frontend

  const response = { message: "", error: false };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;  // Obtenemos el userId desde el token

    if (!selected_days || selected_days.length === 0) {
      response.error = true;
      response.message = "No se seleccionaron días para la rutina.";
      return res.status(400).json(response);
    }

    // Obtener la fecha de inicio (hoy)
    const startDate = new Date();
    const start_date = startDate.toISOString().split('T')[0];  // Formato YYYY-MM-DD

    // Calcular la fecha final (30 días después de la fecha de inicio)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 30);  // 30 días después
    const end_date = endDate.toISOString().split('T')[0];  // Formato YYYY-MM-DD

    // Generamos la rutina para los días seleccionados
    const routineData = await generateGlobalRoutine(selected_days, startDate, endDate);

    // Guardar la rutina en la base de datos
    const query = "INSERT INTO user_routine (user_id, day, date, start_date, end_date) VALUES ?";
    const [result]: any = await pool.query(query, [routineData.map(item => [userId, item.day, item.date, start_date, end_date])]);

    if (result) {
      response.message = "Rutina generada exitosamente";
      return res.status(201).json({
        start_date,
        end_date,
        routine: adapterRoutineDays(routineData),  // Usamos el adaptador para devolver los días
      });
    } else {
      response.error = true;
      response.message = "No se pudo guardar la rutina";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al crear la rutina:", error);
    next(error);
    return res.status(500).json({ message: "Error al crear la rutina." });
  }
};

// Función para generar la rutina global (días con fechas)
const generateGlobalRoutine = (selectedDays: string[], startDate: Date, endDate: Date) => {
  const routine: { day: string; date: string }[] = [];

  // Generamos las fechas de rutina durante 4 semanas (30 días)
  for (let week = 0; week < 4; week++) {
    selectedDays.forEach(day => {
      const trainingDay = getNextTrainingDay(day, startDate, week);

      routine.push({
        day: day,
        date: trainingDay.toISOString().split('T')[0],  // Fecha en formato YYYY-MM-DD
      });
    });
  }

  return routine;
};

// Función para calcular la fecha del siguiente día de entrenamiento
const getNextTrainingDay = (day: string, startDate: Date, week: number) => {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDayIndex = daysOfWeek.indexOf(day);

  const dayOfWeek = new Date(startDate);
  let daysToAdd = targetDayIndex - dayOfWeek.getDay() + week * 7;

  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }
  dayOfWeek.setDate(dayOfWeek.getDate() + daysToAdd);

  return dayOfWeek;
};

// Para obtener la rutina de un usuario, validamos también el user_id
export const getRoutineByUserId = async (req: Request, res: Response, next: NextFunction) => {
  // Validar los datos de entrada con Joi
  const { error } = getRoutineDto.validate(req.params);
  if (error) {
    return res.status(400).json({ error: true, message: error.details[0].message });
  }

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = { message: "", error: false, data: [] };

  try {
    const [rows] = await pool.execute(
      "SELECT day, date, start_date, end_date FROM user_routine WHERE user_id = ?",
      [userId]
    );

    if ((rows as any[]).length > 0) {
      response.data = adapterRoutineDays(rows);  // Usamos el adaptador para formatear los datos
      response.message = "Rutina obtenida exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se encontró rutina para este usuario";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener la rutina del usuario:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener la rutina." });
  }
};

// Para actualizar el estado de un día en la rutina
export const updateRoutineDayStatus = async (req: Request, res: Response, next: NextFunction) => {
  const { error } = updateRoutineStatusDto.validate(req.body);  // Validación con Joi
  if (error) {
    return res.status(400).json({ error: true, message: error.details[0].message });
  }

  const { day, date, status } = req.body;  // Recibimos el día, la fecha y el nuevo estado (completado o no)

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = { message: "", error: false };

  try {
    const [result] = await pool.execute(
      "UPDATE user_routine SET status = ? WHERE user_id = ? AND day = ? AND date = ?",
      [status, userId, day, date]
    );

    const updateResult = result as import('mysql2').ResultSetHeader;

    if (updateResult && updateResult.affectedRows > 0) {
      response.message = "Estado del día actualizado exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se pudo actualizar el estado del día";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al actualizar el estado del día:", error);
    next(error);
    return res.status(500).json({ message: "Error al actualizar el estado del día." });
  }
};

// Eliminar un día de la rutina
export const deleteRoutineDay = async (req: Request, res: Response, next: NextFunction) => {
  const { error } = deleteRoutineDto.validate(req.body);  // Validación con Joi
  if (error) {
    return res.status(400).json({ error: true, message: error.details[0].message });
  }

  const { day, date } = req.body;  // Día y fecha que se eliminará

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = { message: "", error: false };

  try {
    const [result] = await pool.execute(
      "DELETE FROM user_routine WHERE user_id = ? AND day = ? AND date = ?",
      [userId, day, date]
    );

    const deleteResult = result as import('mysql2').ResultSetHeader;

    if (deleteResult && deleteResult.affectedRows > 0) {
      response.message = "Día de rutina eliminado exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se pudo eliminar el día de la rutina";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al eliminar el día de la rutina:", error);
    next(error);
    return res.status(500).json({ message: "Error al eliminar el día de la rutina." });
  }
};
