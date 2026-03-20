// Función para armar el JSON final de rutina a partir de IDs de ejercicios
export async function buildRoutineWithExerciseDetails(routineFromIA: any[]) {
  // 1. Junta todos los IDs únicos de ejercicios
  let allIds = Array.from(
    new Set(
      routineFromIA.flatMap((semana: any) =>
        semana.dias.flatMap((dia: any) => dia.ejercicios)
      )
    )
  );
  // Filtrar IDs inválidos (undefined, null, string vacía, NaN)
  allIds = allIds.filter(id => id !== undefined && id !== null && id !== '' && !(typeof id === 'number' && isNaN(id)));

  if (allIds.length === 0) return [];

  // 2. Consulta la base de datos por esos IDs
  const [exerciseRows]: any = await pool.execute(
    `SELECT * FROM exercises WHERE id IN (${allIds.map(() => '?').join(',')})`,
    allIds
  );

  // 3. Crea un mapa id -> ejercicio
  const exerciseMap = new Map<number, any>();
  exerciseRows.forEach((ex: any) => exerciseMap.set(ex.id, ex));

  // 4. Arma la rutina final
  const rutinaFinal = [];
  for (const semana of routineFromIA) {
    for (const dia of semana.dias) {
      const ejercicios = dia.ejercicios.map((id: number) => {
        const ex = exerciseMap.get(id);
        return ex
          ? {
            exercise_id: ex.id,
            nombre_ejercicio: ex.exercise,
            description: ex.description,
            video_url: ex.video_url,
            thumbnail_url: ex.thumbnail_url,
            muscle_group: ex.muscle_group,
            category: ex.category
          }
          : null;
      }).filter(Boolean);

      rutinaFinal.push({
        fecha: dia.fecha,
        nombre: dia.nombre,
        semana: semana.semana,
        ejercicios,
        exercise_category: ejercicios.map((e: any) => e?.category).filter(Boolean),
        status: "pending"
      });
    }
  }
  return rutinaFinal;
}
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
import { v4 as uuidv4 } from "uuid";

interface Routine {
  day: string;
  date: string;
  start_date: string;
  end_date: string;
  status: string;
}

const OPENAI_TIMEOUT_MS = 300000;
const CHUNK_SIZE = 3;
let isRenewRoutinesRunning = false;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

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

// Ajustamos el código de creación de la rutina
export const createRoutine = async (req: Request, res: Response, next: NextFunction) => {
  const { selected_days, start_date } = req.body;

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

    const routineData = generateGlobalRoutine(selected_days, effectiveStart, endDate, todayStr);

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

    const query = "INSERT INTO user_routine (user_id, day, date, start_date, end_date) VALUES ?";
    const [result]: any = await pool.query(query, [routineData.map(item => [userId, item.day, item.date, startDateStr, endDateStr])]);

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
const generateGlobalRoutine = (selectedDays: string[], startDate: Date, endDate: Date, currentDateStr: string) => {
  const routine: { day: string; date: string }[] = [];
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
      routine.push({
        day: dayName,
        date: dateStr,
      });
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

  try {
    // Buscar el último plan de entrenamiento generado para el usuario
    const [planRows]: any = await pool.execute(
      "SELECT id, training_plan FROM user_training_plans WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
      [userId]
    );

    if (!planRows || planRows.length === 0) {
      return res.status(404).json({ error: true, message: "No se encontró rutina generada para este usuario." });
    }

    let trainingPlan = planRows[0].training_plan;
    if (typeof trainingPlan === "string") {
      try {
        trainingPlan = JSON.parse(trainingPlan);
      } catch (e) {
        return res.status(500).json({ error: true, message: "Error al parsear el plan de entrenamiento." });
      }
    }

    // Si el plan ya está poblado (tiene los detalles de los ejercicios), lo devolvemos tal cual
    // Si solo tiene IDs, lo poblamos usando buildRoutineWithExerciseDetails
    let rutinaFinal = trainingPlan;
    if (
      Array.isArray(trainingPlan) &&
      trainingPlan.length > 0 &&
      trainingPlan[0].dias &&
      Array.isArray(trainingPlan[0].dias) &&
      typeof trainingPlan[0].dias[0]?.ejercicios[0] !== "object"
    ) {
      // Solo tiene IDs, poblar detalles
      const { buildRoutineWithExerciseDetails } = require("./controller");
      rutinaFinal = await buildRoutineWithExerciseDetails(trainingPlan);
    }

    return res.status(200).json({
      error: false,
      message: "Rutina obtenida exitosamente",
      data: rutinaFinal,
    });
  } catch (error) {
    console.error("Error al obtener la rutina del usuario:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener la rutina." });
  }
};

// Actualizar la rutina de un usuario
export const updateRoutineDayStatus = async (req: Request, res: Response, next: NextFunction) => {
  const { selected_days, start_date, end_date, current_date } = req.body;

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

    const newRoutineData = generateGlobalRoutine(selected_days, startDate, endDate, currentDateStr);

    const startDateStr = getLocalDateString(startDate);
    const endDateStr = getLocalDateString(endDate);

    const query = "INSERT INTO user_routine (user_id, day, date, start_date, end_date) VALUES ?";
    const [result]: any = await pool.query(query, [newRoutineData.map(item => [userId, item.day, item.date, startDateStr, endDateStr])]);

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
  startDate: string,
  endDate: string,
  routineId?: number
): Promise<{ error: boolean; message: string; routine_id?: number; isGeneratingRoutine?: boolean }> => {
  try {
    const CHUNK_SIZE = 1;
    const OPENAI_TIMEOUT_MS = 300000;

    // Obtener los días seleccionados por el usuario (solo day y date)
    const [userRoutineRows]: any = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? AND start_date = ? AND end_date = ? ORDER BY date",
      [userId, startDate, endDate]
    );

    let daysData: any[] = [];
    if (!userRoutineRows || userRoutineRows.length === 0) {
      daysData = generateDefaultRoutineDays();
    } else {
      daysData = userRoutineRows;
    }

    // Obtener datos del usuario desde la tabla 'formulario'
    const [rows]: any = await pool.execute(
      "SELECT * FROM formulario WHERE usuario_id = ?",
      [userId]
    );

    if (!rows?.[0]) {
      return { error: true, message: "No se encontró formulario para el usuario." };
    }

    const personData = adapter(rows[0]);

    // Recuperar plan existente si routineId está definido
    let accumulatedPlan: any[] = [];
    if (routineId) {
      const [existingPlanRows]: any = await pool.execute(
        "SELECT training_plan FROM user_training_plans WHERE id = ? LIMIT 1",
        [routineId]
      );

      if (existingPlanRows?.[0]?.training_plan) {
        accumulatedPlan =
          typeof existingPlanRows[0].training_plan === "string"
            ? JSON.parse(existingPlanRows[0].training_plan)
            : existingPlanRows[0].training_plan;
      }
    }

    // Procesar solo los días restantes
    const remainingDays = daysData.slice(accumulatedPlan.length);

    for (let i = 0; i < remainingDays.length; i += CHUNK_SIZE) {
      const chunk = remainingDays.slice(i, i + CHUNK_SIZE);

      // Filtrar ejercicios usando solo el day como referencia de categoría
      const categories = [...new Set(chunk.map((d: any) => d.day).filter(Boolean))];
      const placeholders = categories.map(() => "?").join(",");
      const [exerciseRows] = await pool.execute(
        `SELECT category, exercise, description, video_url, thumbnail_url, muscle_group
         FROM exercises
         WHERE category IN (${placeholders})
         ORDER BY category ASC, exercise ASC`,
        categories
      );

      // Convertir ejercicios a CSV
      let ejerciciosCsv = "Categoria;Ejercicio;Descripción;Video_URL;Thumbnail_URL;muscle_group\n";
      (exerciseRows as any[]).forEach((row) => {
        const desc = row.description.replace(/"/g, '""').replace(/\n/g, ' ');
        const videoUrl = row.video_url ?? '';
        const thumbnailUrl = row.thumbnail_url ?? '';
        const muscleGroup = row.muscle_group ?? '';
        ejerciciosCsv += `${row.category};${row.exercise};"${desc}";${videoUrl};${thumbnailUrl};${muscleGroup}\n`;
      });

      // Construir prompt para OpenAI
      const chunkPrompt = await readFiles(personData, chunk);

      const chunkOpenAiResult = await withTimeout(
        getOpenAI(chunkPrompt),
        OPENAI_TIMEOUT_MS,
        `Timeout OpenAI en chunk ${i / CHUNK_SIZE + 1} para user ${userId}`
      );

      const rawChunk = chunkOpenAiResult?.response?.choices?.[0]?.message?.content || "";
      if (!rawChunk) {
        console.warn(`Chunk sin contenido para user ${userId}, bloque ${i / CHUNK_SIZE + 1}`);
        continue;
      }

      let parsedChunk;
      try {
        parsedChunk = JSON.parse(rawChunk);
      } catch (err) {
        console.error("Error parseando chunk:", err);
        continue;
      }

      let chunkPlan =
        parsedChunk.workouts ||
        parsedChunk.training_plan ||
        parsedChunk.workout_plan ||
        (Array.isArray(parsedChunk) ? parsedChunk : [parsedChunk]);

      if (!Array.isArray(chunkPlan)) continue;


      // Asignar fecha
      chunkPlan.forEach((day: any, index) => {
        const dateData = chunk[index];
        day.fecha = dateData ? dateData.date : null;
      });

      // Armar el JSON final con los detalles de los ejercicios para este chunk
      const { buildRoutineWithExerciseDetails } = require("./controller");
      const rutinaChunk = await buildRoutineWithExerciseDetails(
        [
          {
            semana: chunk[0]?.semana || 1, // puedes ajustar la lógica de semana si la IA la devuelve
            dias: chunkPlan.map((d: any) => ({
              fecha: d.fecha,
              nombre: d.nombre,
              ejercicios: d.ejercicios
            }))
          }
        ]
      );

      accumulatedPlan = [...accumulatedPlan, ...rutinaChunk];

      // Guardar plan acumulado
      if (routineId) {
        await pool.execute(
          "UPDATE user_training_plans SET training_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [JSON.stringify(accumulatedPlan), routineId]
        );
      } else {
        const [insertResult]: any = await pool.execute(
          "INSERT INTO user_training_plans (user_id, training_plan, created_at, updated_at) VALUES (?, ?, ?, ?)",
          [userId, JSON.stringify(accumulatedPlan), new Date(), new Date()]
        );
        routineId = insertResult?.insertId;
      }

      await sleep(100); // Pequeña pausa entre chunks
    }

    console.log("Rutina completa generada y guardada para user_id:", userId);
    return { error: false, message: "Documento generado.", routine_id: routineId, isGeneratingRoutine: false };
  } catch (error) {
    console.error("Error al generar la rutina con IA en background:", error);
    return { error: true, message: "Ocurrió un error al generar la rutina con IA." };
  }
};

// Función principal para renovar rutinas vencidas
export const renewRoutines = async () => {
  if (isRenewRoutinesRunning) {
    console.log("renewRoutines ya está en ejecución. Se omite este ciclo.");
    return;
  }

  isRenewRoutinesRunning = true;
  console.time('renewRoutines'); // Medición de tiempo total para optimización y depuración
  const currentDate = new Date(); // Para producción; para pruebas: new Date(2025, 8, 9); // Sept 09, 2025 (mes 8 es septiembre)
  const currentDateStr = getLocalDateString(currentDate);

  try {
    // Obtener periodos únicos que vencen exactamente hoy (DISTINCT para evitar duplicados)
    const [periodRows] = await pool.execute(
      `SELECT DISTINCT user_id, start_date, end_date 
       FROM user_routine 
       WHERE end_date = ?`,
      [currentDateStr]
    );

    const periods = periodRows as Array<{
      user_id: number;
      start_date: string;
      end_date: string;
    }>;

    if (periods.length === 0) {
      console.log("No hay rutinas que vencen hoy.");
      console.timeEnd('renewRoutines'); // Fin de medición si no hay nada que procesar
      return;
    }

    for (const period of periods) {
      try {
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
          newEndStr
        ]);

        await pool.query(
          `INSERT INTO user_routine (user_id, day, date, start_date, end_date) VALUES ?`,
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
      } catch (periodError) {
        console.error(`Error procesando renovación para user ${period.user_id}:`, periodError);
      }

      await sleep(150);
    }
  } catch (error) {
    console.error("Error en renewRoutines:", error);
  } finally {
    isRenewRoutinesRunning = false;
    console.timeEnd('renewRoutines'); // Siempre mide el tiempo total, incluso si hay error
  }
};