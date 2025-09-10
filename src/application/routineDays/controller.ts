import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterRoutineDays } from "./adapter";
import { createRoutineDto, getRoutineDto, updateRoutineStatusDto, deleteRoutineDto } from "./dto"; // Importamos los DTOs
// Para ejecutar como cron (agrega esto en tu app principal o un archivo init)



import { getOpenAI } from "../../infrastructure/openIA";
import { readFiles } from "../routines/useCase/readFiles";
import { adapter } from "../routines/useCase/adapter";

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
      date: string | Date | null;
      start_date: string | Date | null;
      end_date: string | Date | null;
      status: string;
      routine_start_time: string;
      routine_end_time: string;
    }>;

    if (routineRows.length > 0) {
      const formattedRows = routineRows.map((row) => {
        // Convert to strings if Date objects
        const dateStr = row.date instanceof Date ? getLocalDateString(row.date) : row.date;
        const startDateStr = row.start_date instanceof Date ? getLocalDateString(row.start_date) : row.start_date;
        const endDateStr = row.end_date instanceof Date ? getLocalDateString(row.end_date) : row.end_date;

        // Parse and format, with validation
        const formatOrInvalid = (dateStr: string | null): string => {
          if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            return 'Invalid Date';
          }
          const dateObj = new Date(dateStr); // Directly parse YYYY-MM-DD
          if (isNaN(dateObj.getTime())) {
            return 'Invalid Date';
          }
          return formatDateWithSlash(dateObj);
        };

        return {
          ...row,
          date: formatOrInvalid(dateStr),
          start_date: formatOrInvalid(startDateStr),
          end_date: formatOrInvalid(endDateStr),
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



// Función para generar los días de rutina predeterminados
function generateDefaultRoutineDays() {
  const currentDate = new Date();
  const defaultDays = ['Monday', 'Wednesday', 'Friday'];
  return defaultDays.map((day, index) => {
    let nextDate = new Date(currentDate);
    nextDate.setDate(currentDate.getDate() + (index * 2)); // Sumamos 2 días por cada día de la semana
    return {
      day: day,
      date: nextDate.toISOString().split('T')[0], // Formato: YYYY-MM-DD
    };
  });
}


export const generateRoutinesIaBackground = async (
  userId: number,
  startDate: string,  // Nueva param: start_date del periodo
  endDate: string     // Nueva param: end_date del periodo
): Promise<{ error: boolean; message: string; routine_id?: number }> => {
  try {
    // Consultamos los días seleccionados por el usuario (filtramos por el nuevo periodo para no incluir viejos)
    const [userRoutineRows]: any = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? AND start_date = ? AND end_date = ? ORDER BY date",
      [userId, startDate, endDate]
    );

    let daysData;
    if (userRoutineRows.length === 0) {
      daysData = generateDefaultRoutineDays();
    } else {
      daysData = userRoutineRows;
    }

    // Consulta para obtener los datos del usuario desde la tabla 'formulario'
    const [rows]: any = await pool.execute(
      "SELECT * FROM formulario WHERE usuario_id = ?",
      [userId]
    );

    const personData = adapter(rows?.[0]);

    // Generar el prompt completo para todo el mes de una vez
    const fullPrompt = await readFiles(personData, daysData);

    // Llamamos a la IA para generar la rutina completa
    const { response, error } = await getOpenAI(fullPrompt);

    // Validamos si la respuesta de OpenAI es válida
    if (response?.choices?.[0]?.message?.content) {
      let parsed;
      try {
        parsed = JSON.parse(response.choices[0].message.content || "");
      } catch (parseError: unknown) {
        console.error("Error al parsear la respuesta de OpenAI:", parseError);
        return { error: true, message: "Error al parsear la respuesta de OpenAI." };
      }

      // Verificamos que parsed tenga la propiedad 'workouts' o 'training_plan' y que sea un array
      let trainingPlan = parsed.workouts || parsed.training_plan || parsed.workout_plan; // Manejar variaciones
      if (parsed && Array.isArray(trainingPlan)) {
        // Asociamos las fechas con la rutina generada
        trainingPlan.forEach((day: any, index: number) => {
          const dateData = daysData[index];
          day.fecha = dateData ? dateData.date : null;
        });

        // Guardar la rutina completa en la DB como NUEVO registro
        const trainingPlanJson = JSON.stringify(trainingPlan); // Convertir a string si usas TEXT; si usas JSON, usa el objeto directamente

        // INSERT nuevo (sin ON DUPLICATE)
        await pool.execute(
          "INSERT INTO user_training_plans (user_id, training_plan, start_date, end_date) VALUES (?, ?, ?, ?)",
          [userId, trainingPlanJson, startDate, endDate]
        );

        // Obtener el ID del nuevo registro
        const [result]: any = await pool.execute(
          "SELECT LAST_INSERT_ID() as id"
        );
        const routineId = result?.[0]?.id;

        if (!routineId) {
          throw new Error("No se pudo obtener el ID del registro");
        }

        console.log('Rutina completa generada y guardada para user_id:', userId, 'en periodo', startDate, '-', endDate);

        return { error: false, message: "Documento generado.", routine_id: routineId };
      } else {
        console.error("La propiedad 'workouts' o 'training_plan' no es un array:", parsed);
        return { error: true, message: "La respuesta generada por la IA no es un array." };
      }
    }

    return { error: true, message: "No se generó respuesta de OpenAI." };
  } catch (error) {
    console.error("Error al generar la rutina con IA en background:", error);
    return { error: true, message: "Ocurrió un error al generar la rutina con IA." };
  }
};

// Función principal para renovar rutinas vencidas
export const renewRoutines = async () => {
  const currentDate = new Date(); // Para producción; para pruebas: new Date(2025, 8, 9); // Sept 09, 2025 (mes 8 es septiembre)
  const currentDateStr = getLocalDateString(currentDate);

  try {
    // Obtener periodos únicos que vencen exactamente hoy (DISTINCT para evitar duplicados)
    const [periodRows] = await pool.execute(
      `SELECT DISTINCT user_id, start_date, end_date, routine_start_time, routine_end_time 
       FROM user_routine 
       WHERE end_date = ?`,
      [currentDateStr]
    );

    const periods = periodRows as Array<{
      user_id: number;
      start_date: string;
      end_date: string;
      routine_start_time: string;
      routine_end_time: string;
    }>;

    if (periods.length === 0) {
      console.log("No hay rutinas que vencen hoy.");
      return;
    }

    for (const period of periods) {
      const userId = period.user_id;

      // Paso 1: Actualizar 'pending' a 'failed' en los días anteriores (todo el periodo vencido)
      await pool.execute(
        `UPDATE user_routine 
         SET status = 'failed' 
         WHERE user_id = ? AND start_date = ? AND end_date = ? AND status = 'pending'`,
        [userId, period.start_date, period.end_date]
      );
      console.log(`Actualizados a 'failed' los días pendientes para user ${userId} en periodo ${period.start_date} - ${period.end_date}`);

      // Paso 2: Extraer el patrón de días únicos (e.g., ['Friday', 'Monday'])
      const [dayRows] = await pool.execute(
        `SELECT DISTINCT day 
         FROM user_routine 
         WHERE user_id = ? AND start_date = ? AND end_date = ?`,
        [userId, period.start_date, period.end_date]
      );
      const selectedDays = (dayRows as Array<{ day: string }>).map((row) => row.day);

      if (selectedDays.length === 0) {
        console.log(`No se encontró patrón de días para user ${userId}. Saltando.`);
        continue;
      }

      // Paso 3: Calcular nuevas fechas (mes siguiente: +1 día a end_date, +30 días para end)
      const oldEndDate = new Date(period.end_date);
      const newStartDate = new Date(oldEndDate);
      newStartDate.setDate(newStartDate.getDate() + 1);
      const newEndDate = new Date(newStartDate);
      newEndDate.setDate(newEndDate.getDate() + 30);

      const newStartStr = getLocalDateString(newStartDate);
      const newEndStr = getLocalDateString(newEndDate);

      // Verificar si ya existe un periodo para el mes siguiente (evitar duplicados)
      const [existing] = await pool.execute(
        `SELECT id FROM user_routine WHERE user_id = ? AND start_date = ?`,
        [userId, newStartStr]
      );
      if ((existing as any).length > 0) {
        console.log(`Ya existe rutina para user ${userId} empezando en ${newStartStr}. Saltando.`);
        continue;
      }

      // Paso 4: Generar nuevas fechas con el patrón, horarios y current_user_time como '00:00' (para incluir todos)
      const newRoutineData = generateGlobalRoutine(
        selectedDays,
        newStartDate,
        newEndDate,
        period.routine_start_time,
        period.routine_end_time,
        '00:00:00',
        currentDateStr
      );

      if (newRoutineData.length === 0) {
        console.log(`No se generaron fechas nuevas para user ${userId}.`);
        continue;
      }

      // Paso 5: Insertar las nuevas filas (status default 'pending' en BD)
      const insertValues = newRoutineData.map(item => [
        userId,
        item.day,
        item.date,
        newStartStr,
        newEndStr,
        item.routine_start_time,
        item.routine_end_time
      ]);

      await pool.query(
        `INSERT INTO user_routine (user_id, day, date, start_date, end_date, routine_start_time, routine_end_time) VALUES ?`,
        [insertValues]
      );
      console.log(`Rutina renovada para user ${userId} en nuevo periodo ${newStartStr} - ${newEndStr}`);

      // Paso 6: Generar la rutina con IA inmediatamente después de insertar las nuevas fechas
      const genResult = await generateRoutinesIaBackground(userId, newStartStr, newEndStr);
      if (genResult.error) {
        console.error(`Error generando rutina IA para user ${userId}: ${genResult.message}`);
      } else {
        console.log(`Rutina IA generada exitosamente para user ${userId} con routine_id ${genResult.routine_id}`);
      }
    }
  } catch (error) {
    console.error("Error en renewRoutines:", error);
  }
};
