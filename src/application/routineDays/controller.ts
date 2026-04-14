// Función para armar el JSON final de rutina a partir de IDs de ejercicios
export async function buildRoutineWithExerciseDetails(routineFromIA: any[]) {
  // Normalización: siempre trabajar con array de semanas (array de arrays de días)
  let normalized: any[][];

  if (Array.isArray(routineFromIA)) {
    if (routineFromIA.length > 0 && Array.isArray(routineFromIA[0])) {
      // Ya es array de semanas
      normalized = routineFromIA;
    } else if (routineFromIA.length > 0 && typeof routineFromIA[0] === 'object' && routineFromIA[0] !== null && !Array.isArray(routineFromIA[0])) {
      // Es array de días
      normalized = [routineFromIA];
    } else {
      normalized = [];
    }
  } else if (typeof routineFromIA === 'object' && routineFromIA !== null) {
    // Es un solo objeto día
    normalized = [[routineFromIA]];
  } else {
    normalized = [];
  }

  // 3. Arma la rutina minimal para guardar en BD (solo db_id + exercise_id + Esquema)
  const rutinaFinal: any[] = [];
  for (let i = 0; i < normalized.length; i++) {
    const semanaArr = normalized[i];
    for (const dia of semanaArr) {
      const ejercicios = (dia.ejercicios || []).map((ej: any) => {
        // Normalizar esquema: quitar 'carga' de Detalle series, dejar solo Reps
        let esquema = ej.esquema || ej.Esquema || {};
        if (esquema && Array.isArray(esquema['Detalle series'])) {
          esquema = {
            ...esquema,
            ['Detalle series']: esquema['Detalle series'].map((serie: any) => ({ Reps: serie.Reps })),
          };
        }
        return {
          exercise_id: ej.exercise_id || uuidv4(), // UUID único por instancia (para editar/identificar)
          db_id: typeof ej.id === 'number' ? ej.id : Number(ej.id), // ID numérico de la tabla exercises
          Esquema: esquema,
        };
      });
      // Derivar nombre del día a partir de categorias si no existe
      let nombre = dia.nombre;
      if (!nombre && (dia.categorias || dia.exercise_category)) {
        const cats = dia.categorias || dia.exercise_category;
        if (Array.isArray(cats)) {
          nombre = cats.join(' + ');
        }
      }
      rutinaFinal.push({
        fecha: dia.fecha,
        semana: dia.semana || i + 1,
        nombre,
        ejercicios,
        exercise_category: dia.exercise_category || dia.categorias || [],
        status: dia.status || 'pending',
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
export const getLocalDateString = (date: Date) => {
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

    const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const rutinaConDia = Array.isArray(rutinaFinal)
      ? rutinaFinal.map((dia: any) => {
          if (dia.fecha) {
            const [year, month, day] = dia.fecha.split("-").map(Number);
            const dayIndex = new Date(year, month - 1, day).getDay();
            return { ...dia, day: DAYS_EN[dayIndex] };
          }
          return dia;
        })
      : rutinaFinal;

    return res.status(200).json({
      error: false,
      message: "Rutina obtenida exitosamente",
      data: rutinaConDia,
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



// Cambiar días de entrenamiento — reasigna fechas al plan existente, conserva historial y semanas
export const updateRoutineDays = async (req: Request, res: Response, next: NextFunction) => {
  const { selected_days } = req.body;

  if (!selected_days || !Array.isArray(selected_days) || selected_days.length === 0) {
    return res.status(400).json({ error: true, message: "Debes enviar al menos un día seleccionado." });
  }

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  try {
    // 1. Verificar plan activo y generaciones
    const [authRows]: any = await pool.execute(
      "SELECT plan_id, plan_valid_until, generations_remaining FROM auth WHERE id = ?",
      [userId]
    );
    if (!authRows.length) {
      return res.status(404).json({ error: true, message: "Usuario no encontrado.", code: "USER_NOT_FOUND" });
    }
    const auth = authRows[0];
    const todayForAuth = getLocalDateString(new Date());

    if (auth.plan_valid_until && auth.plan_valid_until < todayForAuth && auth.plan_id !== 0) {
      return res.status(403).json({
        error: true,
        message: "Tu plan ha vencido. Renueva tu suscripción para poder cambiar tus días.",
        code: "PLAN_EXPIRED"
      });
    }
    if (auth.generations_remaining <= 0) {
      return res.status(403).json({
        error: true,
        message: "No tienes generaciones disponibles. Actualiza tu plan para obtener más.",
        code: "NO_GENERATIONS",
        generations_remaining: 0
      });
    }

    // 2. Obtener periodo activo
    const todayStr = getLocalDateString(new Date());
    const [periodRows]: any = await pool.execute(
      `SELECT DISTINCT start_date, end_date FROM user_routine
       WHERE user_id = ? AND start_date <= ? AND end_date >= ?
       ORDER BY start_date DESC LIMIT 1`,
      [userId, todayStr, todayStr]
    );
    if (!periodRows.length) {
      return res.status(404).json({ error: true, message: "No se encontró un periodo activo de rutina." });
    }

    const startDateStr: string = periodRows[0].start_date instanceof Date
      ? getLocalDateString(periodRows[0].start_date)
      : String(periodRows[0].start_date).split('T')[0];
    const endDateStr: string = periodRows[0].end_date instanceof Date
      ? getLocalDateString(periodRows[0].end_date)
      : String(periodRows[0].end_date).split('T')[0];

    // 3. Obtener plan existente de BD
    const [planRows]: any = await pool.execute(
      "SELECT id, training_plan FROM user_training_plans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
      [userId]
    );
    if (!planRows.length) {
      return res.status(404).json({ error: true, message: "No se encontró un plan de entrenamiento activo." });
    }
    const planId = planRows[0].id;
    const existingPlan: any[] = typeof planRows[0].training_plan === 'string'
      ? JSON.parse(planRows[0].training_plan)
      : planRows[0].training_plan;

    // 4. Separar histórico (fecha < hoy) del futuro (fecha >= hoy)
    const historico = existingPlan.filter((d: any) => d.fecha < todayStr);
    const futuro    = existingPlan.filter((d: any) => d.fecha >= todayStr);

    // 5. Extraer templates únicos del plan completo por posición (orden de aparición)
    //    Un template = un día único del plan ya generado (con sus ejercicios y rutina_id)
    const seenRutinaIds = new Set<string>();
    const templates: any[] = [];
    for (const d of existingPlan) {
      if (d.rutina_id && !seenRutinaIds.has(d.rutina_id)) {
        seenRutinaIds.add(d.rutina_id);
        templates.push(d);
      }
    }

    // 6. Borrar días pending >= hoy en user_routine e insertar los nuevos
    await pool.execute(
      `DELETE FROM user_routine WHERE user_id = ? AND status = 'pending' AND date >= ? AND start_date = ?`,
      [userId, todayStr, startDateStr]
    );

    const endDate = new Date(endDateStr + 'T12:00:00Z');
    const todayDate = new Date(todayStr + 'T12:00:00Z');
    const newDays = generateGlobalRoutine(selected_days, todayDate, endDate, todayStr);

    if (newDays.length > 0) {
      await pool.query(
        `INSERT INTO user_routine (user_id, day, date, start_date, end_date) VALUES ?`,
        [newDays.map(item => [userId, item.day, item.date, startDateStr, endDateStr])]
      );
    }

    // 7. Construir nuevos días del plan reutilizando templates por posición
    //    Si hay más días nuevos que templates → llamar IA para los extras
    const startMs = new Date(startDateStr + 'T12:00:00Z').getTime();

    const needsAI: any[] = [];
    const newPlanDays: any[] = [];

    for (let i = 0; i < newDays.length; i++) {
      const newDay = newDays[i];
      const template = templates[i % templates.length]; // ciclar si hay más días que templates
      const isExtra = (i % selected_days.length) >= templates.length; // día que no tenía template propio

      // Calcular semana correcta según la fecha real dentro del periodo
      const dayMs = new Date(newDay.date + 'T12:00:00Z').getTime();
      const semana = Math.min(Math.floor((dayMs - startMs) / (7 * 24 * 60 * 60 * 1000)) + 1, 4);

      if (!isExtra) {
        // Reusar template: mismos ejercicios, nueva fecha, semana recalculada, nuevos exercise_id
        newPlanDays.push({
          ...template,
          fecha: newDay.date,
          semana,
          ejercicios: template.ejercicios.map((ej: any) => ({
            ...ej,
            exercise_id: uuidv4(),
          })),
        });
      } else {
        // Día extra sin template → necesita IA
        needsAI.push({ date: newDay.date, day: newDay.day, semana });
      }
    }

    // 8. Si hay días que necesitan IA, generarlos en background y actualizar plan después
    if (needsAI.length > 0) {
      // Guardar plan sin los días extra por ahora (se actualizará cuando termine IA)
      const planSinExtras = [...historico, ...newPlanDays];
      await pool.execute(
        "UPDATE user_training_plans SET training_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [JSON.stringify(planSinExtras), planId]
      );

      // Lanzar generación IA para los días extra en background
      (async () => {
        try {
          const [rows]: any = await pool.execute("SELECT * FROM formulario WHERE usuario_id = ?", [userId]);
          if (!rows?.[0]) return;
          const personData = adapter(rows[0]);
          const favs: string[] = Array.isArray(personData.grupo_muscular_favorito) ? personData.grupo_muscular_favorito : [];
          const splitGroups = buildDaySplit(favs, needsAI.length);

          for (let i = 0; i < needsAI.length; i++) {
            const extra = needsAI[i];
            const cats = splitGroups[i] || splitGroups[0];
            const dayInput = [{ date: extra.date, day: extra.day, categorias: cats }];
            const dayPrompt = await readFiles({ ...personData, grupo_muscular_favorito: cats }, dayInput);
            const aiResult = await getOpenAI(dayPrompt);
            const rawContent = aiResult?.response?.choices?.[0]?.message?.content || "";
            if (!rawContent) continue;
            const parsed = JSON.parse(rawContent);
            let parsedDay: any = Array.isArray(parsed) ? parsed.flat(2)[0] : parsed?.weeks ? parsed.weeks.flat()[0] : parsed;
            if (!parsedDay) continue;
            parsedDay.fecha = extra.date;
            parsedDay.semana = extra.semana;
            const [builtDay] = await buildRoutineWithExerciseDetails([parsedDay]);
            if (builtDay) {
              newPlanDays.push({ ...builtDay, rutina_id: uuidv4() });
            }
          }

          // Actualizar plan completo con los días extra ya generados
          const planFinal = [...historico, ...newPlanDays].sort((a, b) => a.fecha.localeCompare(b.fecha));
          await pool.execute(
            "UPDATE user_training_plans SET training_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [JSON.stringify(planFinal), planId]
          );
          console.log(`[updateRoutineDays] Días extra IA generados para user ${userId}`);
        } catch (err) {
          console.error(`[updateRoutineDays] Error generando días extra con IA para user ${userId}:`, err);
        }
      })();

    } else {
      // Sin días extra — guardar plan directamente
      const planFinal = [...historico, ...newPlanDays].sort((a, b) => a.fecha.localeCompare(b.fecha));
      await pool.execute(
        "UPDATE user_training_plans SET training_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [JSON.stringify(planFinal), planId]
      );
    }

    // 9. Descontar 1 generación
    await pool.execute(
      `UPDATE auth SET generations_remaining = generations_remaining - 1 WHERE id = ?`,
      [userId]
    );

    return res.status(200).json({
      error: false,
      message: needsAI.length > 0
        ? "Días actualizados. Los días nuevos se están generando con IA."
        : "Días actualizados correctamente.",
      isGeneratingRoutine: needsAI.length > 0,
      periodo: { start_date: startDateStr, end_date: endDateStr },
    });

  } catch (error) {
    console.error("Error en updateRoutineDays:", error);
    next(error);
    return res.status(500).json({ error: true, message: "Error al actualizar los días de la rutina." });
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


// Popula detalles de ejercicios desde la tabla exercises (para responder al cliente)
export async function populateExerciseDetails(plan: any[]): Promise<any[]> {
  const allDbIds: number[] = [];
  plan.forEach((day: any) => {
    (day.ejercicios || []).forEach((ej: any) => {
      if (ej.db_id) allDbIds.push(Number(ej.db_id));
    });
  });
  const uniqueIds = [...new Set(allDbIds)].filter(id => !isNaN(id));
  const exerciseMap = new Map<number, any>();
  if (uniqueIds.length > 0) {
    const [exRows]: any = await pool.execute(
      `SELECT * FROM exercises WHERE id IN (${uniqueIds.map(() => '?').join(',')})`,
      uniqueIds
    );
    exRows.forEach((ex: any) => exerciseMap.set(ex.id, ex));
  }
  return plan.map((day: any) => ({
    ...day,
    ejercicios: (day.ejercicios || []).map((ej: any) => {
      const ex = exerciseMap.get(Number(ej.db_id));
      return {
        exercise_id: ej.exercise_id,
        nombre_ejercicio: ex?.exercise || "",
        description: ex?.description || "",
        video_url: ex?.video_url || "",
        thumbnail_url: ex?.thumbnail_url || "",
        muscle_group: ex?.muscle_group || null,
        Esquema: ej.Esquema,
      };
    }),
  }));
}

// Distribuye grupos musculares del usuario en splits diarios (push/pull/shoulders/legs/other)
function buildDaySplit(favs: string[], numDays: number): string[][] {
  // Push: PECHO + TRÍCEPS (sin HOMBRO, va aparte)
  const push: string[] = [];
  if (favs.includes('PECHO')) push.push('PECHO');
  if (favs.includes('PECHO') || favs.includes('TRICEPS')) push.push('TRICEPS');

  // Pull: ESPALDA + BÍCEPS
  const pull: string[] = [];
  if (favs.includes('ESPALDA')) pull.push('ESPALDA');
  if (favs.includes('ESPALDA') || favs.includes('BICEPS')) pull.push('BICEPS');

  // Shoulders: HOMBRO solo
  const shoulders: string[] = favs.includes('HOMBRO') ? ['HOMBRO'] : [];

  // Legs
  const legs = favs.filter(g => ['CUADRICEPS', 'ISQUITIBIALES', 'GLUTEO', 'PANTORRILLA'].includes(g));

  // Core
  const core = favs.filter(g => g === 'ABDOMEN');

  // Construir lista de splits en orden push → pull → shoulders → legs → core
  const available: string[][] = [];
  if (push.length > 0) available.push(push);
  if (pull.length > 0) available.push(pull);
  if (shoulders.length > 0) available.push(shoulders);
  if (legs.length > 0) available.push(legs);
  if (core.length > 0) available.push(core);
  if (available.length === 0) available.push(['PECHO', 'TRICEPS'], ['ESPALDA', 'BICEPS'], ['HOMBRO']);

  // Asignar un split diferente a cada día (ciclar si hay más días que splits)
  return Array.from({ length: numDays }, (_, i) => available[i % available.length]);
}

export const generateRoutinesIaBackground = async (
  userId: number,
  startDate: string,
  endDate: string,
  routineId?: number
): Promise<{ error: boolean; message: string; routine_id?: number; isGeneratingRoutine?: boolean }> => {
  try {
    // Obtener todos los días del período
    const [userRoutineRows]: any = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? AND start_date = ? AND end_date = ? ORDER BY date",
      [userId, startDate, endDate]
    );

    let daysData: any[] = userRoutineRows.length > 0 ? userRoutineRows : generateDefaultRoutineDays();

    // Normalizar fechas a string YYYY-MM-DD
    daysData = daysData.map((d: any) => ({
      ...d,
      dateStr: d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date).split('T')[0],
    }));

    // Agrupar en semanas de 7 días desde start_date
    const startMs = new Date(startDate + 'T12:00:00Z').getTime();
    const weekMap = new Map<number, any[]>();
    for (const day of daysData) {
      const dayMs = new Date(day.dateStr + 'T12:00:00Z').getTime();
      const weekNum = Math.floor((dayMs - startMs) / (7 * 24 * 60 * 60 * 1000)) + 1;
      if (!weekMap.has(weekNum)) weekMap.set(weekNum, []);
      weekMap.get(weekNum)!.push(day);
    }
    const weeks = [...weekMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([semana, days]) => ({ semana, days }));

    // Obtener datos del usuario
    const [rows]: any = await pool.execute("SELECT * FROM formulario WHERE usuario_id = ?", [userId]);
    if (!rows?.[0]) return { error: true, message: "No se encontró formulario para el usuario." };
    const personData = adapter(rows[0]);

    // Usar la semana con más días como template para la IA
    const templateWeek = weeks.reduce((max, w) => w.days.length >= max.days.length ? w : max, weeks[0]);

    // Pre-asignar categorías distintas a cada día del template (push/pull/other)
    const favs: string[] = Array.isArray(personData.grupo_muscular_favorito) ? personData.grupo_muscular_favorito : [];
    const splitGroups = buildDaySplit(favs, templateWeek.days.length);

    // UUID fijo por día-de-semana: todos los lunes comparten el mismo rutina_id, etc.
    const dayTemplateIds = new Map<string, string>();
    templateWeek.days.forEach((wd: any) => dayTemplateIds.set(wd.day, uuidv4()));

    // Generar ejercicios: UNA llamada por día con la categoría pre-asignada
    const dayOfWeekMap = new Map<string, any>();
    for (let i = 0; i < templateWeek.days.length; i++) {
      const wd = templateWeek.days[i];
      const cats = splitGroups[i] || splitGroups[0];
      const dayInput = [{ date: wd.dateStr, day: wd.day, categorias: cats }];
      const dayPrompt = await readFiles({ ...personData, grupo_muscular_favorito: cats }, dayInput);
      try {
        const aiResult = await withTimeout(
          getOpenAI(dayPrompt),
          OPENAI_TIMEOUT_MS,
          `Timeout OpenAI background user ${userId} day ${wd.day}`
        );
        const rawContent = aiResult?.response?.choices?.[0]?.message?.content || "";
        if (!rawContent) { console.error(`[BG] Sin contenido para ${wd.day}`); continue; }
        const parsed = JSON.parse(rawContent);
        let parsedDay: any = Array.isArray(parsed) ? parsed.flat(2)[0] : parsed?.weeks ? parsed.weeks.flat()[0] : parsed;
        if (!parsedDay) continue;
        parsedDay.fecha = wd.dateStr;
        parsedDay.semana = 1;
        if (!parsedDay.categorias || parsedDay.categorias.length === 0) parsedDay.categorias = cats;
        if (!parsedDay.nombre) parsedDay.nombre = cats.join(' + ');
        const [builtDay] = await buildRoutineWithExerciseDetails([parsedDay]);
        if (builtDay) {
          // Guardar con el rutina_id fijo para este día de semana
          dayOfWeekMap.set(wd.day, { ...builtDay, rutina_id: dayTemplateIds.get(wd.day) });
          console.log(`[BG] ${wd.day} → ${builtDay.nombre} (${builtDay.ejercicios?.length} ejercicios)`);
        }
      } catch (err) {
        console.error(`[BG] Error generando ${wd.day}:`, err);
      }
    }
    console.log("[BG] dayOfWeekMap keys:", [...dayOfWeekMap.keys()]);

    // Construir plan completo: distribuir template a todas las semanas
    const fullPlan: any[] = [];
    const MAX_WEEKS = 4;
    for (const { semana, days } of weeks) {
      const semanaFinal = Math.min(semana, MAX_WEEKS); // días sobrantes van a semana 4
      for (const wd of days) {
        const templateDay = dayOfWeekMap.get(wd.day);
        if (!templateDay) continue;
        fullPlan.push({
          ...templateDay,
          fecha: wd.dateStr,
          semana: semanaFinal,
          ejercicios: templateDay.ejercicios.map((ej: any) => ({
            ...ej,
            exercise_id: uuidv4(),
          })),
        });
      }
    }

    // Guardar plan completo en BD
    if (routineId) {
      await pool.execute(
        "UPDATE user_training_plans SET training_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [JSON.stringify(fullPlan), routineId]
      );
    } else {
      const [insertResult]: any = await pool.execute(
        "INSERT INTO user_training_plans (user_id, training_plan, created_at, updated_at) VALUES (?, ?, ?, ?)",
        [userId, JSON.stringify(fullPlan), new Date(), new Date()]
      );
      routineId = insertResult?.insertId;
    }

    console.log(`[BG] Rutina completa (${fullPlan.length} días) guardada para user_id: ${userId}`);
    return { error: false, message: "Rutina generada.", routine_id: routineId, isGeneratingRoutine: false };
  } catch (error) {
    console.error("[BG] Error generando rutina:", error);
    return { error: true, message: "Error al generar rutina en background." };
  }
};
// Regenera solo los días futuros (>= hoy) de un periodo, conservando el histórico intacto
export const regenerateRoutinesIaBackground = async (
  userId: number,
  startDate: string,
  endDate: string,
  routineId: number,
  historicalDays: any[]
): Promise<{ error: boolean; message: string }> => {
  try {
    const todayStr = getLocalDateString(new Date());

    // Solo días futuros del periodo
    const [futureDaysRows]: any = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? AND start_date = ? AND end_date = ? AND date >= ? ORDER BY date",
      [userId, startDate, endDate, todayStr]
    );

    if (!futureDaysRows.length) {
      // Sin días futuros: solo guardar el histórico
      await pool.execute(
        "UPDATE user_training_plans SET training_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [JSON.stringify(historicalDays), routineId]
      );
      return { error: false, message: "Sin días futuros, histórico conservado." };
    }

    // Normalizar fechas
    const daysData: any[] = futureDaysRows.map((d: any) => ({
      ...d,
      dateStr: d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date).split('T')[0],
    }));

    // Agrupar en semanas desde start_date original (misma lógica que el background normal)
    const startMs = new Date(startDate + 'T12:00:00Z').getTime();
    const weekMap = new Map<number, any[]>();
    for (const day of daysData) {
      const dayMs = new Date(day.dateStr + 'T12:00:00Z').getTime();
      const weekNum = Math.min(Math.floor((dayMs - startMs) / (7 * 24 * 60 * 60 * 1000)) + 1, 4);
      if (!weekMap.has(weekNum)) weekMap.set(weekNum, []);
      weekMap.get(weekNum)!.push(day);
    }
    const weeks = [...weekMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([semana, days]) => ({ semana, days }));

    // Perfil del usuario
    const [rows]: any = await pool.execute("SELECT * FROM formulario WHERE usuario_id = ?", [userId]);
    if (!rows?.[0]) return { error: true, message: "No se encontró formulario para el usuario." };
    const personData = adapter(rows[0]);

    // Semana template = la semana con más días entre las futuras
    const templateWeek = weeks.reduce((max, w) => w.days.length >= max.days.length ? w : max, weeks[0]);

    const favs: string[] = Array.isArray(personData.grupo_muscular_favorito) ? personData.grupo_muscular_favorito : [];
    const splitGroups = buildDaySplit(favs, templateWeek.days.length);

    // Nuevos rutina_id por día-de-semana (todos los lunes futuros comparten uno, etc.)
    const dayTemplateIds = new Map<string, string>();
    templateWeek.days.forEach((wd: any) => dayTemplateIds.set(wd.day, uuidv4()));

    // 1 llamada IA por día único del template
    const dayOfWeekMap = new Map<string, any>();
    for (let i = 0; i < templateWeek.days.length; i++) {
      const wd = templateWeek.days[i];
      const cats = splitGroups[i] || splitGroups[0];
      const dayPrompt = await readFiles({ ...personData, grupo_muscular_favorito: cats }, [{ date: wd.dateStr, day: wd.day, categorias: cats }]);
      try {
        const aiResult = await withTimeout(
          getOpenAI(dayPrompt),
          OPENAI_TIMEOUT_MS,
          `Timeout OpenAI regen user ${userId} day ${wd.day}`
        );
        const rawContent = aiResult?.response?.choices?.[0]?.message?.content || "";
        if (!rawContent) { console.error(`[REGEN] Sin contenido para ${wd.day}`); continue; }
        const parsed = JSON.parse(rawContent);
        let parsedDay: any = Array.isArray(parsed) ? parsed.flat(2)[0] : parsed?.weeks ? parsed.weeks.flat()[0] : parsed;
        if (!parsedDay) continue;
        parsedDay.fecha = wd.dateStr;
        parsedDay.semana = templateWeek.semana;
        if (!parsedDay.categorias || parsedDay.categorias.length === 0) parsedDay.categorias = cats;
        if (!parsedDay.nombre) parsedDay.nombre = cats.join(' + ');
        const [builtDay] = await buildRoutineWithExerciseDetails([parsedDay]);
        if (builtDay) {
          dayOfWeekMap.set(wd.day, { ...builtDay, rutina_id: dayTemplateIds.get(wd.day) });
          console.log(`[REGEN] ${wd.day} → ${builtDay.nombre} (${builtDay.ejercicios?.length} ejercicios)`);
        }
      } catch (err) {
        console.error(`[REGEN] Error generando ${wd.day}:`, err);
      }
    }

    // Distribuir template a todas las semanas futuras
    const futurePlan: any[] = [];
    for (const { semana, days } of weeks) {
      for (const wd of days) {
        const templateDay = dayOfWeekMap.get(wd.day);
        if (!templateDay) continue;
        futurePlan.push({
          ...templateDay,
          fecha: wd.dateStr,
          semana,
          ejercicios: templateDay.ejercicios.map((ej: any) => ({
            ...ej,
            exercise_id: uuidv4(),
          })),
        });
      }
    }

    // Histórico + nuevos días futuros
    const fullPlan = [...historicalDays, ...futurePlan];

    await pool.execute(
      "UPDATE user_training_plans SET training_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [JSON.stringify(fullPlan), routineId]
    );

    console.log(`[REGEN] Plan listo: ${historicalDays.length} días histórico + ${futurePlan.length} días nuevos para user_id: ${userId}`);
    return { error: false, message: "Rutina regenerada." };
  } catch (error) {
    console.error("[REGEN] Error:", error);
    return { error: true, message: "Error al regenerar rutina en background." };
  }
};

// Exportar la función principal para renovación de rutinas
export const renewRoutines = async () => {
  if (isRenewRoutinesRunning) {
    console.log("renewRoutines ya está corriendo, se omite esta ejecución.");
    return;
  }
  isRenewRoutinesRunning = true;
  console.time('renewRoutines');
  try {
    // Obtener periodos únicos que vencen exactamente hoy (DISTINCT para evitar duplicados)
    const todayStr = getLocalDateString(new Date());
    const [periodRows] = await pool.execute(
      `SELECT DISTINCT user_id, start_date, end_date 
       FROM user_routine 
       WHERE end_date = ?`,
      [todayStr]
    );

    const periods = periodRows as Array<{
      user_id: number;
      start_date: string;
      end_date: string;
    }>;

    // Bajar plan a usuarios con plan_valid_until vencido (corre siempre, independiente de rutinas)
    try {
      const [expiredPlans] = await pool.execute(
        `SELECT a.id AS user_id
         FROM auth a
         WHERE a.plan_valid_until IS NOT NULL
           AND a.plan_valid_until < ?
           AND a.plan_id != 0`,
        [todayStr]
      );
      const expiredUsers = expiredPlans as Array<{ user_id: number }>;

      for (const { user_id } of expiredUsers) {
        await pool.execute(
          `UPDATE auth SET plan_id = 0, generations_remaining = 1, entrenador_id = NULL, plan_valid_until = NULL WHERE id = ?`,
          [user_id]
        );
        await pool.execute(
          `UPDATE asignaciones SET status = 'expired' WHERE usuario_id = ? AND status = 'cancelled'`,
          [user_id]
        );
        console.log(`Plan vencido bajado a básico para user ${user_id}`);
      }

      if (expiredUsers.length === 0) {
        console.log("No hay planes vencidos hoy.");
      }
    } catch (expiredError) {
      console.error("Error bajando planes vencidos:", expiredError);
    }

    if (periods.length === 0) {
      console.log("No hay rutinas que vencen hoy.");
      console.timeEnd('renewRoutines');
      return { error: false, message: "No hay rutinas que renovar hoy." };
    }

    for (const period of periods) {
      try {
        const userId = period.user_id;

        // Paso 1: Actualizar 'pending' a 'failed' en TODOS los días anteriores a hoy (cualquier periodo)
        await pool.execute(
          `UPDATE user_routine
           SET status = 'failed'
           WHERE user_id = ? AND date < ? AND status = 'pending'`,
          [userId, todayStr]
        );
        console.log(`Actualizados a 'failed' todos los días pendientes anteriores a hoy para user ${userId}`);

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
          period.end_date
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
