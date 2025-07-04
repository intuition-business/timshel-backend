import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterRoutineDays } from "./adapter";
import { createRoutineDto, getRoutineDto, updateRoutineStatusDto, deleteRoutineDto } from "./dto"; // Importamos los DTOs

// Función para formatear las fechas a "DD/MM/YYYY"
const formatDateWithSlash = (date: Date) => {
  const day = date.getDate().toString().padStart(2, '0'); // Día con 2 dígitos
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Mes con 2 dígitos (sumamos 1 porque los meses empiezan en 0)
  const year = date.getFullYear();

  return `${day}/${month}/${year}`; // Formato "DD/MM/YYYY"
};

// Crear la rutina global para un usuario
export const createRoutine = async (req: Request, res: Response, next: NextFunction) => {
  const { selected_days, start_date } = req.body;  // Días seleccionados y fecha de inicio enviados desde el frontend

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

    // Usar la fecha de inicio proporcionada desde el frontend
    const startDate = new Date(start_date);  // Fecha proporcionada por el usuario
    const start_date_formatted = formatDateWithSlash(startDate);  // Formato "DD/MM/YYYY"

    // Calcular la fecha final (30 días después de la fecha de inicio)
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 30);  // 30 días después
    const end_date_formatted = formatDateWithSlash(endDate);  // Formato "DD/MM/YYYY"

    // Generamos la rutina para los días seleccionados
    const routineData = await generateGlobalRoutine(selected_days, startDate, endDate);

    // Validamos si alguna de las fechas y días ya existe
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

    // Si existen duplicados, respondemos con un error
    if (duplicates.length > 0) {
      response.error = true;
      response.message = `Ya existe una rutina para los siguientes días: ${duplicates.map(item => `${item.day} ${formatDateWithSlash(new Date(item.date))}`).join(", ")}`;
      return res.status(400).json(response);
    }

    // Insertar en la base de datos
    const query = "INSERT INTO user_routine (user_id, day, date, start_date, end_date) VALUES ?";
    const [result]: any = await pool.query(query, [routineData.map(item => [userId, item.day, item.date, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]])]);

    if (result) {
      response.message = "Rutina generada exitosamente";
      return res.status(201).json({
        start_date: start_date_formatted,
        end_date: end_date_formatted,
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


// Genera las fechas de la rutina
const generateGlobalRoutine = (selectedDays: string[], startDate: Date, endDate: Date) => {
  const routine: { day: string; date: string }[] = [];
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Vamos a usar un set para asegurarnos de que no haya días duplicados
  const datesSet = new Set();

  // Generamos las fechas de rutina durante 4 semanas (30 días)
  let currentDate = new Date(startDate);

  // En cada iteración se genera el día correspondiente
  while (currentDate <= endDate) {
    selectedDays.forEach(day => {
      const trainingDay = getNextTrainingDay(day, currentDate, 0);  // El 0 indica la semana inicial

      // Comprobamos si la fecha ya fue añadida antes de agregarla
      if (!datesSet.has(trainingDay.toISOString().split('T')[0]) && trainingDay <= endDate) {
        routine.push({
          day: day,
          date: trainingDay.toISOString().split('T')[0],  // Fecha en formato YYYY-MM-DD
        });

        datesSet.add(trainingDay.toISOString().split('T')[0]);  // Añadimos la fecha al Set para evitar duplicados
      }
    });

    currentDate.setDate(currentDate.getDate() + 1); // Aseguramos de seguir avanzando por los días
  }

  return routine;
};

// Función para obtener el siguiente día de entrenamiento basado en el día de la semana
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

export const getRoutineByUserId = async (req: Request, res: Response, next: NextFunction) => {
  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  const response = { message: "", error: false, data: [], start_date: "", end_date: "" };

  try {
    const [rows] = await pool.execute(
      "SELECT day, date, start_date, end_date FROM user_routine WHERE user_id = ?",
      [userId]
    );

    const routineRows = rows as Array<{ day: string; date: string; start_date: string; end_date: string }>;


    if (routineRows.length > 0) {
      // Convertimos las fechas a formato "DD/MM/YYYY" antes de devolverlas
      const formattedRows = routineRows.map((row: any) => ({
        ...row,
        date: formatDateWithSlash(new Date(row.date)),
        start_date: formatDateWithSlash(new Date(row.start_date)),
        end_date: formatDateWithSlash(new Date(row.end_date)),
      }));

      // Asignar las fechas de inicio y final
      const startDate = new Date(routineRows[0].start_date);
      const endDate = new Date(routineRows[0].end_date);
      response.start_date = formatDateWithSlash(startDate);
      response.end_date = formatDateWithSlash(endDate);

      response.data = adapterRoutineDays(formattedRows);  // Usamos el adaptador para formatear los datos
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

// Actualizar la rutina de un usuario
export const updateRoutineDayStatus = async (req: Request, res: Response, next: NextFunction) => {
  const { selected_days, start_date, end_date, current_date } = req.body;  // Días seleccionados, fecha de inicio, fecha final y fecha actual enviados desde el frontend

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

    // Convertir las fechas de inicio, final y actual a objetos Date
    const startDate = new Date(start_date);  // Fecha de inicio proporcionada
    const endDate = new Date(end_date);  // Fecha final proporcionada
    const currentDate = new Date(current_date);  // Fecha actual para actualizar la rutina

    // Obtener las rutinas ya existentes para este usuario
    const [existingRoutinesRows] = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date",
      [userId, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]]
    ) as [Array<{ day: string; date: string }>, any];
    const existingRoutines = existingRoutinesRows as Array<{ day: string; date: string }>;


    // Creamos un set con las fechas existentes para no duplicarlas
    const existingDatesSet = new Set(existingRoutines.map(item => item.date));

    // Generamos nuevas fechas para los días seleccionados
    const newRoutineData = await generateGlobalRoutine(selected_days, startDate, endDate);

    // Insertamos las nuevas fechas en la base de datos
    const query = "INSERT INTO user_routine (user_id, day, date, start_date, end_date) VALUES ?";
    const [result]: any = await pool.query(query, [newRoutineData.map(item => [userId, item.day, item.date, startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]])]);

    if (result) {
      response.message = "Rutina actualizada exitosamente";
      return res.status(201).json({
        start_date: formatDateWithSlash(startDate),
        end_date: formatDateWithSlash(endDate),
        routine: adapterRoutineDays(newRoutineData),  // Usamos el adaptador para devolver los días
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

