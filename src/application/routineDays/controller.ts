import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterRoutineDays } from "./adapter";
import { createRoutineDto, getRoutineDto, updateRoutineStatusDto, deleteRoutineDto } from "./dto"; // Importamos los DTOs


interface Routine {
  day: string;
  date: string;
  start_date: string;
  end_date: string;
  status: string;
  routine_start_time: string;
  routine_end_time: string;
}
// Función para formatear las fechas a "DD/MM/YYYY"
const formatDateWithSlash = (date: Date) => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
};

// Función para obtener la fecha en formato "YYYY-MM-DD" usando componentes locales
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isValidTimeFormat = (time: string): boolean => {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
};

const isTimeAfter = (time1: string, time2: string): boolean => {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return h1 > h2 || (h1 === h2 && m1 > m2);
};

// Ajustamos el código de creación de la rutina
export const createRoutine = async (req: Request, res: Response, next: NextFunction) => {
  const { selected_days, start_date, routine_start_time, routine_end_time, current_user_time } = req.body;

  const response = { message: "", error: false };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    if (!selected_days || selected_days.length === 0) {
      response.error = true;
      response.message = "No se seleccionaron días para la rutina.";
      return res.status(400).json(response);
    }

    if (!isValidTimeFormat(routine_start_time) || !isValidTimeFormat(routine_end_time) || !isValidTimeFormat(current_user_time)) {
      response.error = true;
      response.message = "Formato de hora inválido (debe ser HH:MM).";
      return res.status(400).json(response);
    }

    if (isTimeAfter(routine_start_time, routine_end_time)) {
      response.error = true;
      response.message = "La hora de inicio debe ser anterior a la hora de fin.";
      return res.status(400).json(response);
    }

    // Parsear start_date como fecha local
    const [dayStr, monthStr, yearStr] = start_date.split('/');
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    const startDate = new Date(year, month - 1, day); // Crea fecha en 00:00 local

    const now = new Date();
    now.setHours(0, 0, 0, 0); // 00:00 local hoy

    const effectiveStart = new Date(Math.max(startDate.getTime(), now.getTime()));

    const endDate = new Date(effectiveStart);
    endDate.setDate(effectiveStart.getDate() + 30);

    const start_date_formatted = formatDateWithSlash(effectiveStart);
    const end_date_formatted = formatDateWithSlash(endDate);

    // Obtener todayStr como fecha local YYYY-MM-DD
    const todayStr = getLocalDateString(new Date());

    const routineData = generateGlobalRoutine(selected_days, effectiveStart, endDate, routine_start_time, routine_end_time, current_user_time, todayStr);

    const duplicates = [];
    for (const item of routineData) {
      const [existingRoutine] = await pool.execute(
        "SELECT id FROM user_routine WHERE user_id = ? AND day = ? AND date = ?",
        [userId, item.day, item.date]
      );

      if ((existingRoutine as any).length > 0) {
        duplicates.push(item);
      }
    }

    if (duplicates.length > 0) {
      response.error = true;
      response.message = `Ya existe una rutina para los siguientes días: ${duplicates.map(item => `${item.day} ${formatDateWithSlash(new Date(item.date.split('-').reverse().join('-')))}`).join(", ")}`;
      return res.status(400).json(response);
    }

    const startDateStr = getLocalDateString(effectiveStart);
    const endDateStr = getLocalDateString(endDate);

    const query = "INSERT INTO user_routine (user_id, day, date, start_date, end_date, routine_start_time, routine_end_time) VALUES ?";
    const [result]: any = await pool.query(query, [routineData.map(item => [userId, item.day, item.date, startDateStr, endDateStr, item.routine_start_time, item.routine_end_time])]);

    if (result) {
      response.message = "Rutina generada exitosamente";
      return res.status(201).json({
        start_date: start_date_formatted,
        end_date: end_date_formatted,
        routine: adapterRoutineDays(routineData),
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


// Genera las fechas de la rutina
const generateGlobalRoutine = (selectedDays: string[], startDate: Date, endDate: Date, routine_start_time: string, routine_end_time: string, current_user_time: string, currentDateStr: string) => {
  const routine: { day: string; date: string; routine_start_time: string; routine_end_time: string }[] = [];
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const dayMap = {
    'domingo': 'Sunday',
    'lunes': 'Monday',
    'martes': 'Tuesday',
    'miercoles': 'Wednesday',
    'jueves': 'Thursday',
    'viernes': 'Friday',
    'sabado': 'Saturday',
    'sunday': 'Sunday',
    'monday': 'Monday',
    'tuesday': 'Tuesday',
    'wednesday': 'Wednesday',
    'thursday': 'Thursday',
    'friday': 'Friday',
    'saturday': 'Saturday',
  };

  const normalizedSelectedDays = new Set(selectedDays.map(day => dayMap[day.toLowerCase() as keyof typeof dayMap]));

  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayIndex = currentDate.getDay();
    const dayName = daysOfWeek[dayIndex];
    const dateStr = getLocalDateString(currentDate);
    if (normalizedSelectedDays.has(dayName)) {
      if (dateStr === currentDateStr && isTimeAfter(current_user_time, routine_start_time)) {
        // skip
      } else {
        routine.push({
          day: dayName,
          date: dateStr,
          routine_start_time,
          routine_end_time,
        });
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return routine;
};

export const getRoutineByUserId = async (req: Request, res: Response, next: NextFunction) => {
  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = { message: "", error: false, data: [] as Routine[] };

  try {
    const [rows] = await pool.execute(
      "SELECT day, date, start_date, end_date, status, routine_start_time, routine_end_time FROM user_routine WHERE user_id = ? ORDER BY date ASC",
      [userId]
    );

    const routineRows = rows as Array<{
      day: string;
      date: string | Date;
      start_date: string | Date;
      end_date: string | Date;
      status: string;
      routine_start_time: string;
      routine_end_time: string;
    }>;

    if (routineRows.length > 0) {
      const formattedRows = routineRows.map((row) => {
        // Convert date fields to strings if they are Date objects
        const dateStr = row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date;
        const startDateStr = row.start_date instanceof Date ? row.start_date.toISOString().split('T')[0] : row.start_date;
        const endDateStr = row.end_date instanceof Date ? row.end_date.toISOString().split('T')[0] : row.end_date;

        return {
          ...row,
          date: formatDateWithSlash(new Date(dateStr.split('-').reverse().join('-'))),
          start_date: formatDateWithSlash(new Date(startDateStr.split('-').reverse().join('-'))),
          end_date: formatDateWithSlash(new Date(endDateStr.split('-').reverse().join('-'))),
          status: row.status,
        };
      });

      response.data = formattedRows;
      response.message = "Rutinas obtenidas exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se encontraron rutinas para este usuario";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener las rutinas del usuario:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener las rutinas." });
  }
};

// Actualizar la rutina de un usuario
export const updateRoutineDayStatus = async (req: Request, res: Response, next: NextFunction) => {
  const { selected_days, start_date, end_date, current_date, routine_start_time, routine_end_time, current_user_time } = req.body;

  const response = { message: "", error: false };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    if (!selected_days || selected_days.length === 0) {
      response.error = true;
      response.message = "No se seleccionaron días para la rutina.";
      return res.status(400).json(response);
    }

    // Convertir las fechas de inicio, final y actual a objetos Date locales
    const [sDay, sMonth, sYear] = start_date.split('/');
    const startDate = new Date(parseInt(sYear), parseInt(sMonth) - 1, parseInt(sDay));

    const [eDay, eMonth, eYear] = end_date.split('/');
    const endDate = new Date(parseInt(eYear), parseInt(eMonth) - 1, parseInt(eDay));

    const [cDay, cMonth, cYear] = current_date.split('/');
    const currentDate = new Date(parseInt(cYear), parseInt(cMonth) - 1, parseInt(cDay));

    const currentDateStr = getLocalDateString(currentDate);

    // Obtener las rutinas ya existentes para este usuario
    const [existingRoutinesRows] = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date",
      [userId, getLocalDateString(startDate), getLocalDateString(endDate)]
    ) as [Array<{ day: string; date: string }>, any];
    const existingRoutines = existingRoutinesRows as Array<{ day: string; date: string }>;

    const existingDatesSet = new Set(existingRoutines.map(item => item.date));

    const newRoutineData = generateGlobalRoutine(selected_days, startDate, endDate, routine_start_time, routine_end_time, current_user_time, currentDateStr);

    const startDateStr = getLocalDateString(startDate);
    const endDateStr = getLocalDateString(endDate);

    const query = "INSERT INTO user_routine (user_id, day, date, start_date, end_date, routine_start_time, routine_end_time) VALUES ?";
    const [result]: any = await pool.query(query, [newRoutineData.map(item => [userId, item.day, item.date, startDateStr, endDateStr, item.routine_start_time, item.routine_end_time])]);

    if (result) {
      response.message = "Rutina actualizada exitosamente";
      return res.status(201).json({
        start_date: formatDateWithSlash(startDate),
        end_date: formatDateWithSlash(endDate),
        routine: adapterRoutineDays(newRoutineData),
      });
    } else {
      response.error = true;
      response.message = "No se pudo actualizar la rutina";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al actualizar la rutina:", error);
    next(error);
    return res.status(500).json({ message: "Error al actualizar la rutina." });
  }
};
// Eliminar un día de la rutina
export const deleteRoutineDay = async (req: Request, res: Response, next: NextFunction) => {
  const { error } = deleteRoutineDto.validate(req.body);
  if (error) {
    return res.status(400).json({ error: true, message: error.details[0].message });
  }

  const { day, date } = req.body;

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