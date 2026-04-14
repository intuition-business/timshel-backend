import { NextFunction, Request, Response } from "express";
const fs = require("fs").promises;
import path from "path";
import { readFiles } from "./useCase/readFiles";
import { getOpenAI } from "../../infrastructure/openIA";
import { adapter } from "./useCase/adapter";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import pool from "../../config/db";
import { any } from "joi";
import { v4 as uuidv4 } from "uuid";
import { generateRoutinesIaBackground, getLocalDateString } from "../routineDays/controller";
let uuidv4Sync: () => string;

interface Exercise {
  exercise_name: string;
  description: string;
  thumbnail_url: string;
  video_url: string;
  liked: boolean | null;
  liked_reason: string | null;
  series_completed: { reps: number, load: number, breakTime: number }[];  // Definimos las series completadas como un arreglo de objetos
}

interface JwtPayload {
  userId: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface EditExerciseRequest {
  fecha_rutina: string;
  exercise_name: string;
  rutina_id?: string;
  updates: {
    Series?: number;
    Descanso?: string;
    "Detalle series"?: { Reps: number }[];
    description?: string;
    video_url?: string;
    thumbnail_url?: string;
  };
}

interface RoutineRow {
  fecha_rutina: string;
  routine_name: string;
  rutina_id: number | string;  // UUID como string
  exercise_name: string;
  description: string;
  thumbnail_url: string;
  video_url: string;
  liked: boolean | null;
  liked_reason: string;
  series_completed: string | object;
  last_weight_comparation?: number;  // Nuevo campo agregado
}

interface Exercise {
  exercise_name: string;
  description: string;
  thumbnail_url: string;
  video_url: string;
  liked: boolean | null;
  liked_reason: string | null;
  series_completed: { reps: number; load: number; breakTime: number }[]; // Definimos las series completadas como un arreglo de objetos
  last_weight_comparation: number | null;  // Nuevo campo
}

interface RoutineResponse {
  fecha_rutina: string;
  routines: { rutina_id: number | string; routine_name: string; exercises: Exercise[] }[];
}
// Carga asíncrona una sola vez al iniciar el módulo
(async () => {
  const { v4 } = await import('uuid');
  uuidv4Sync = v4;
})();

// Función helper para usar en contextos síncronos (lanzará error si se llama antes de que cargue)
function getUuidv4(): string {
  if (!uuidv4Sync) {
    throw new Error('uuid no ha terminado de cargarse aún. Intenta nuevamente en unos milisegundos.');
  }
  return uuidv4Sync();
}
export const getRoutines = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const filePath = path.join(__dirname, "training_plan.json");
  try {
    const data = await fs.readFile(filePath, "utf8");
    res.json(JSON.parse(data)); // Express automáticamente establece el Content-Type a application/json y envía el JSON
  } catch (error) {
    console.error("Error al leer el archivo JSON:", error);
    //res.status(500).send("Error interno del servidor al leer el archivo JSON.");
    next(error);
  }
};

export const getGeneratedRoutinesIa = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { headers, query } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userIdFromToken = (<any>(<unknown>decode)).userId;

  const month = query.month as string;
  const date = query.date as string;
  const adminUserId = query.user_id as string; // ← NUEVO: solo para admin

  // ← NUEVO BLOQUE: decidir qué userId usar
  const targetUserId = adminUserId ? adminUserId : userIdFromToken;

  try {
    let sql = "SELECT id, training_plan, created_at FROM user_training_plans WHERE user_id = ?";
    let params: any[] = [targetUserId]; // ← usamos targetUserId (puede ser del token o del query)

    // Si se pasa un mes, filtrar por mes en created_at (ej: created_at LIKE '2025-09%')
    if (month) {
      sql += " AND created_at LIKE ?";
      params.push(`${month}%`);
    }
    // Si se pasa una fecha específica, filtrar por mes de esa fecha
    else if (date) {
      const targetDate = new Date(date);
      const targetMonth = targetDate.toISOString().slice(0, 7); // 'YYYY-MM'
      sql += " AND created_at LIKE ?";
      params.push(`${targetMonth}%`);
    }
    // Por defecto: Ordenar por created_at DESC y limitar a 1 (la última)
    sql += " ORDER BY created_at DESC LIMIT 1";

    const [planRows]: any = await pool.execute(sql, params);

    if (planRows.length === 0) {
      res.status(404).json({
        response: "",
        error: true,
        message: "No se encontró un plan de entrenamiento para este usuario (o para el mes/fecha especificado)."
      });
      return;
    }

    let trainingPlan;
    if (typeof planRows[0].training_plan === "string") {
      try {
        trainingPlan = JSON.parse(planRows[0].training_plan);
      } catch (parseError) {
        console.error("Error al parsear training_plan:", parseError);
        res.status(500).json({
          response: "",
          error: true,
          message: "El plan de entrenamiento tiene un formato inválido."
        });
        return;
      }
    } else {
      trainingPlan = planRows[0].training_plan;
    }

    if (!Array.isArray(trainingPlan)) {
      console.error("training_plan no es un array:", trainingPlan);
      res.status(500).json({
        response: "",
        error: true,
        message: "El plan de entrenamiento no es un array válido."
      });
      return;
    }

    // Obtener los días y estados desde user_routine (sin cambios)
    const [routineRows]: any = await pool.execute(
      "SELECT date, status FROM user_routine WHERE user_id = ? ORDER BY date",
      [targetUserId] // ← también aquí usamos targetUserId
    );

    const statusMap: { [key: string]: string } = {};
    routineRows.forEach((row: any) => {
      const normalizedDate = new Date(row.date).toISOString().split("T")[0];
      if (["pending", "completed", "failed"].includes(row.status)) {
        statusMap[normalizedDate] = row.status;
      }
    });

    // Poblar detalles de ejercicios desde la tabla exercises usando db_id
    const allDbIds: number[] = [];
    trainingPlan.forEach((day: any) => {
      (day.ejercicios || []).forEach((ej: any) => {
        if (ej.db_id) allDbIds.push(Number(ej.db_id));
      });
    });
    const uniqueDbIds = [...new Set(allDbIds)].filter(id => !isNaN(id));
    const exerciseMap = new Map<number, any>();
    if (uniqueDbIds.length > 0) {
      const [exRows]: any = await pool.execute(
        `SELECT * FROM exercises WHERE id IN (${uniqueDbIds.map(() => '?').join(',')})`,
        uniqueDbIds
      );
      exRows.forEach((ex: any) => exerciseMap.set(ex.id, ex));
    }

    // Integrar estados y poblar ejercicios
    trainingPlan = trainingPlan.map((day: any) => {
      const normalizedDayDate = day.fecha ? new Date(day.fecha).toISOString().split("T")[0] : null;
      const status = normalizedDayDate ? statusMap[normalizedDayDate] || "pending" : "pending";
      return {
        ...day,
        status,
        ejercicios: (day.ejercicios || []).map((ej: any) => {
          const ex = exerciseMap.get(Number(ej.db_id));
          return {
            exercise_id: ej.exercise_id,
            db_id: Number(ej.db_id),
            nombre_ejercicio: ex?.exercise || "",
            description: ex?.description || "",
            video_url: ex?.video_url || "",
            thumbnail_url: ex?.thumbnail_url || "",
            muscle_group: ex?.muscle_group || null,
            Esquema: ej.Esquema,
          };
        }),
      };
    });

    res.json({
      response: trainingPlan,
      error: false,
      message: "Plan de entrenamiento obtenido con éxito.",
      routine_id: planRows[0].id,
      user_id: targetUserId, // ← devuelve el ID real consultado
      queried_by_admin: !!adminUserId, // ← opcional: para saber si fue consulta externa
      created_at: planRows[0].created_at
    });
  } catch (error: any) {
    console.error("Error al obtener el plan de entrenamiento:", error);
    res.status(500).json({
      response: "",
      error: true,
      message: "Ocurrió un error al obtener el plan de entrenamiento.",
      details: error.message
    });
  }
};

export const generateRoutinesIa = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;


    // Verificar plan activo y generaciones
    const [authRows]: any = await pool.execute(
      "SELECT plan_id, plan_valid_until, generations_remaining FROM auth WHERE id = ?",
      [userId]
    );

    if (!authRows.length) {
      res.status(404).json({ error: true, message: "Usuario no encontrado." });
      return;
    }

    const auth = authRows[0];
    const todayForAuth = getLocalDateString(new Date());

    // Plan vencido
    if (auth.plan_valid_until && auth.plan_valid_until < todayForAuth && auth.plan_id !== 0) {
      res.status(403).json({
        error: true,
        message: "Tu plan ha vencido. Renueva tu suscripción para seguir generando rutinas.",
        code: "PLAN_EXPIRED"
      });
      return;
    }

    // Sin generaciones disponibles
    if (auth.generations_remaining <= 0) {
      res.status(403).json({
        error: true,
        message: "No tienes generaciones disponibles. Actualiza tu plan para obtener más.",
        code: "NO_GENERATIONS",
        generations_remaining: 0
      });
      return;
    }

    // Obtener el período actual del usuario
    const [periodRows]: any = await pool.execute(
      `SELECT DISTINCT start_date, end_date FROM user_routine WHERE user_id = ? ORDER BY start_date DESC LIMIT 1`,
      [userId]
    );

    if (!periodRows || periodRows.length === 0) {
      res.status(400).json({
        error: true,
        message: "No tienes días de entrenamiento configurados. Selecciona tus días antes de generar la rutina.",
        code: "NO_ROUTINE_DAYS"
      });
      return;
    }

    const { start_date, end_date } = periodRows[0];

    const formatDate = (d: any): string => {
      if (typeof d === 'string') return d;
      if (d instanceof Date) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return String(d);
    };

    const startDateStr = formatDate(start_date);
    const endDateStr = formatDate(end_date);

    // Periodo vencido (end_date < hoy)
    if (endDateStr < todayForAuth) {
      res.status(400).json({
        error: true,
        message: "Tu periodo de entrenamiento ha terminado. El sistema renovará tus días automáticamente.",
        code: "PERIOD_EXPIRED"
      });
      return;
    }

    // Ya existe rutina para este periodo
    const [existingRoutine]: any = await pool.execute(
      "SELECT id FROM user_training_plans WHERE user_id = ? AND created_at >= ? AND created_at <= ? LIMIT 1",
      [userId, startDateStr, endDateStr]
    );
    if (existingRoutine && existingRoutine.length > 0) {
      res.status(409).json({
        error: true,
        message: "Ya tienes una rutina activa para este periodo. Usa la opción de cambiar días si deseas modificarla.",
        code: "ROUTINE_ALREADY_EXISTS"
      });
      return;
    }


    // --- Obtener todos los días del período ---
    const [userRoutineRows]: any = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? AND start_date = ? AND end_date = ? ORDER BY date",
      [userId, startDateStr, endDateStr]
    );

    let daysData: any[];
    if (userRoutineRows.length === 0) {
      const { generateDefaultRoutineDays } = require("../routineDays/controller");
      daysData = generateDefaultRoutineDays();
    } else {
      daysData = userRoutineRows;
    }

    // Normalizar fechas a string YYYY-MM-DD
    daysData = daysData.map((d: any) => ({
      ...d,
      dateStr: d.date instanceof Date ? d.date.toISOString().split('T')[0] : String(d.date).split('T')[0],
    }));

    // Obtener datos del usuario
    const [rows]: any = await pool.execute(
      "SELECT * FROM formulario WHERE usuario_id = ?",
      [userId]
    );

    if (!rows?.[0]) {
      res.status(400).json({
        error: true,
        message: "No has completado tu perfil de entrenamiento. Completa el formulario antes de generar una rutina.",
        code: "NO_PROFILE",
        routine_id: null
      });
      return;
    }

    const personData = require("../routines/useCase/adapter").adapter(rows[0]);
    const readFiles = require("../routines/useCase/readFiles").readFiles;
    const getOpenAI = require("../../infrastructure/openIA").getOpenAI;
    const { buildRoutineWithExerciseDetails, populateExerciseDetails } = require("../routineDays/controller");

    // --- Generar solo el PRIMER DÍA vía IA ---
    const firstDay = daysData[0];
    const firstPrompt = await readFiles(personData, [{ date: firstDay.dateStr, day: firstDay.day }]);

    let parsedFirstDay: any;
    try {
      const aiResult = await getOpenAI(firstPrompt);
      if (aiResult.error) {
        console.error("[IA] Error de OpenAI primer día:", aiResult.error);
        throw aiResult.error;
      }
      const rawContent = aiResult?.response?.choices?.[0]?.message?.content || "";
      console.log("[IA] rawContent primer día:", rawContent.slice(0, 300));
      if (!rawContent) {
        console.error("[IA] OpenAI devolvió contenido vacío. finish_reason:", aiResult?.response?.choices?.[0]?.finish_reason);
        throw new Error("OpenAI devolvió contenido vacío");
      }
      const parsed = JSON.parse(rawContent);

      // Normalizar: puede venir como array, { weeks: [...] }, objeto solo, etc.
      let days: any[];
      if (Array.isArray(parsed)) {
        days = parsed.flat(2);
      } else if (parsed?.weeks) {
        days = parsed.weeks.flat();
      } else {
        days = [parsed];
      }
      parsedFirstDay = days[0];
    } catch (err) {
      console.error("[IA] Error generando primer día:", err);
      res.status(503).json({
        error: true,
        message: "Hubo un problema al conectar con el servicio de IA. Intenta de nuevo en unos momentos.",
        code: "AI_ERROR",
        routine_id: null
      });
      return;
    }

    // Asignar fecha y semana=1 al primer día
    parsedFirstDay.fecha = firstDay.dateStr;
    parsedFirstDay.semana = 1;

    // Construir primer día (mínimo para BD)
    const [firstDayBuilt]: any[] = await buildRoutineWithExerciseDetails([parsedFirstDay]);

    // Guardar plan inicial con solo el primer día
    const [insertResult]: any = await pool.execute(
      "INSERT INTO user_training_plans (user_id, training_plan, created_at, updated_at) VALUES (?, ?, ?, ?)",
      [userId, JSON.stringify([firstDayBuilt]), new Date(), new Date()]
    );
    const routineId = insertResult?.insertId;

    // Descontar 1 generación — la generación inició exitosamente
    await pool.execute(
      "UPDATE auth SET generations_remaining = generations_remaining - 1 WHERE id = ?",
      [userId]
    );

    // Poblar primer día para responder al usuario
    const firstDayPopulated = await populateExerciseDetails([firstDayBuilt]);

    // Responder inmediatamente con el primer día
    res.json({
      response: firstDayPopulated,
      error: false,
      message: "Primer día generado. El resto se está procesando.",
      routine_id: routineId,
      user_id: userId,
      isGeneratingRoutine: true,
    });

    // --- Lanzar background: genera semana template y distribuye a todas las semanas ---
    require("../routineDays/controller")
      .generateRoutinesIaBackground(userId, startDateStr, endDateStr, routineId)
      .catch((err: any) => console.error("[BG] Error en background:", err));

  } catch (error) {
    console.error("Error en generateRoutinesIa:", error);
    res.status(500).json({
      response: "",
      error: true,
      message: "Ocurrió un error al generar la rutina.",
      details: error instanceof Error ? error.message : String(error)
    });
  }
};

// Función para manejar errores de parseo
function handleParseError(parseError: unknown, res: Response) {
  if (parseError instanceof Error) {
    console.error("Error al parsear la respuesta de OpenAI:", parseError.message);
    res.json({
      response: "",
      error: true,
      message: `Error al parsear la respuesta de OpenAI: ${parseError.message}`,
      details: parseError,
    });
  } else {
    console.error("Error desconocido al parsear la respuesta de OpenAI");
    res.json({
      response: "",
      error: true,
      message: "Error desconocido al parsear la respuesta de OpenAI.",
      details: parseError,
    });
  }
}

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

// Función para generar series con repeticiones y detalles
function generateSeries(seriesCount: number, detaileSeries?: { Reps: number }[]): { reps: number; load: number; breakTime: number }[] {
  const series = [];
  for (let i = 0; i < seriesCount; i++) {
    const reps = detaileSeries && detaileSeries[i] ? detaileSeries[i].Reps : 0;
    series.push({
      reps: reps,
      load: 0,
      breakTime: 0
    });
  }
  return series;
}

export const getRoutinesSaved = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    // Start a transaction
    await pool.query("START TRANSACTION");

    // Fetch routines from complete_rutina
    const [rows]: any = await pool.execute(
      "SELECT fecha_rutina, routine_name, rutina_id, exercise_name, description, thumbnail_url, video_url, liked, liked_reason, series_completed FROM complete_rutina WHERE user_id = ? ORDER BY fecha_rutina DESC, rutina_id, exercise_name",
      [userId]
    );

    if (rows.length > 0) {
      const routinesMap = new Map();
      const datesToUpdate = new Set<string>();

      // Process rows and collect unique fecha_rutina values
      for (const item of rows) {
        let seriesCompletedParsed = item.series_completed;

        // Parse series_completed if it's a string
        if (typeof seriesCompletedParsed === 'string') {
          try {
            seriesCompletedParsed = JSON.parse(seriesCompletedParsed);
          } catch (jsonError) {
            console.error(`Error parsing series_completed for exercise ${item.exercise_name}:`, jsonError);
            seriesCompletedParsed = [];
          }
        }

        const routineKey = item.rutina_id;

        if (!routinesMap.has(routineKey)) {
          routinesMap.set(routineKey, {
            fecha_rutina: item.fecha_rutina,
            rutina_id: item.rutina_id,
            routine_name: item.routine_name,
            exercises: [],
          });
        }

        const routine = routinesMap.get(routineKey);
        routine.exercises.push({
          exercise_name: item.exercise_name,
          description: item.description,
          thumbnail_url: item.thumbnail_url,
          video_url: item.video_url,
          liked: item.liked,
          liked_reason: item.liked_reason,
          series_completed: Array.isArray(seriesCompletedParsed)
            ? seriesCompletedParsed
            : [],
        });

        // Collect fecha_rutina for status update
        datesToUpdate.add(item.fecha_rutina);
      }

      // Update user_routine status to 'completed' for each unique fecha_rutina
      for (const date of datesToUpdate) {
        const updateQuery = `
          UPDATE user_routine
          SET status = 'completed'
          WHERE user_id = ? AND date = ?
        `;
        const [updateResult]: any = await pool.execute(updateQuery, [userId, date]);
        if (updateResult.affectedRows === 0) {
          console.warn(`No user_routine found for user_id=${userId}, date=${date}`);
        }
      }

      // Commit transaction
      await pool.query("COMMIT");

      const responseData = Array.from(routinesMap.values());

      res.status(200).json({
        error: false,
        message: "Rutinas guardadas y estados actualizados",
        response: responseData,
      });
      return;
    }

    // Commit transaction even if no rows (no updates needed)
    await pool.query("COMMIT");

    res.status(404).json({
      error: true,
      response: undefined,
      message: "No se encontraron rutinas guardadas",
    });
  } catch (error) {
    // Rollback on error
    await pool.query("ROLLBACK");
    console.error("Error al obtener rutinas guardadas:", error);
    next(error);
    res.status(500).json({
      error: true,
      message: "Error al obtener rutinas guardadas",
    });
  }
};

const convertDate = (date: string): string => {
  const [day, month, year] = date.split('/');
  const formattedDate = new Date(`${year}-${month}-${day}`);
  return formattedDate.toISOString().split('T')[0];
};

export const getRoutineByDate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    const { fecha_rutina } = req.query;

    if (!fecha_rutina) {
      res.status(400).json({
        error: true,
        message: "Fecha de rutina es requerida",
      });
      return;
    }

    const formattedFecha = convertDate(fecha_rutina as string);

    const [rows]: any = await pool.execute(
      "SELECT fecha_rutina, routine_name, rutina_id, exercise_name, description, thumbnail_url, video_url, liked, liked_reason, series_completed FROM complete_rutina WHERE user_id = ? AND fecha_rutina = ? ORDER BY fecha_rutina DESC, rutina_id, exercise_name",
      [userId, formattedFecha]
    );

    if (rows.length > 0) {
      const routinesMap = new Map();

      for (const item of rows) {
        let seriesCompletedParsed = item.series_completed;

        if (typeof seriesCompletedParsed === 'string') {
          try {
            seriesCompletedParsed = JSON.parse(seriesCompletedParsed);
          } catch (jsonError) {
            console.error(`Error parsing series_completed for exercise ${item.exercise_name}:`, jsonError);
            seriesCompletedParsed = [];
          }
        }

        const routineKey = item.rutina_id;

        if (!routinesMap.has(routineKey)) {
          routinesMap.set(routineKey, {
            fecha_rutina: item.fecha_rutina,
            rutina_id: item.rutina_id,
            routine_name: item.routine_name,
            exercises: [],
          });
        }

        const routine = routinesMap.get(routineKey);
        routine.exercises.push({
          exercise_name: item.exercise_name,
          description: item.description,
          thumbnail_url: item.thumbnail_url,
          video_url: item.video_url,
          liked: item.liked,
          liked_reason: item.liked_reason,
          series_completed: seriesCompletedParsed,
        });
      }

      const responseData = Array.from(routinesMap.values());

      res.status(200).json({
        error: false,
        message: "Rutina guardada para la fecha proporcionada",
        response: responseData,
      });
      return;
    }

    res.status(404).json({
      error: true,
      response: undefined,
      message: "No se encontraron rutinas para la fecha proporcionada",
    });
  } catch (error) {
    console.error("Error al obtener rutina por fecha:", error);
    next(error);
  }
};


export const getRoutineByExerciseName = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Autenticación
    const token = req.headers["x-access-token"] as string;
    if (!token) {
      res.status(401).json({ error: true, message: "Token requerido" });
      return;
    }
    let decode: JwtPayload;
    try {
      decode = verify(token, SECRET) as JwtPayload;
    } catch (error) {
      res.status(401).json({ error: true, message: "Token inválido" });
      return;
    }
    const userId = decode.userId;

    // Validación de entrada
    const { exercise_name, fecha_rutina, routine_name } = req.query;

    // Formato de fecha
    let formattedFecha: string | null = null;
    if (fecha_rutina) {
      try {
        formattedFecha = convertDate(fecha_rutina as string);
      } catch (error) {
        res.status(400).json({ error: true, message: "Formato de fecha inválido" });
        return;
      }
    }

    // Construcción de consulta — exercise_name es opcional
    let query = `
      SELECT fecha_rutina, routine_name, rutina_id, exercise_name, description, thumbnail_url, video_url, liked, liked_reason, series_completed
      FROM complete_rutina
      WHERE user_id = ?
    `;
    const params: (string | number)[] = [userId];
    if (exercise_name && typeof exercise_name === "string") {
      query += " AND LOWER(exercise_name) LIKE LOWER(?)";
      params.push(`%${exercise_name}%`);
    }
    if (routine_name && typeof routine_name === "string") {
      query += " AND LOWER(routine_name) LIKE LOWER(?)";
      params.push(`%${routine_name}%`);
    }
    if (formattedFecha) {
      query += " AND fecha_rutina = ?";
      params.push(formattedFecha);
    }
    query += " ORDER BY fecha_rutina DESC, rutina_id ASC, exercise_name LIMIT 100";

    // Ejecutar consulta
    const [rows]: any = await pool.execute(query, params);

    // Procesar series_completed y calcular avg_load
    const exerciseGroups = new Map<string, { row: RoutineRow; avg_load: number; fecha: Date; rutina_id: string }[]>();

    for (const item of rows) {
      let seriesCompletedParsed: any[] = [];
      if (typeof item.series_completed === "string") {
        try {
          seriesCompletedParsed = JSON.parse(item.series_completed);
        } catch (jsonError) {
          console.error(`Error al parsear series_completed para el ejercicio ${item.exercise_name}:`, jsonError);
          seriesCompletedParsed = [];
        }
      } else if (Array.isArray(item.series_completed)) {
        seriesCompletedParsed = item.series_completed;
      }

      // Calcular avg_load
      let avg_load = 0;
      if (Array.isArray(seriesCompletedParsed) && seriesCompletedParsed.length > 0) {
        const sum_load = seriesCompletedParsed.reduce((acc: number, s: any) => acc + (Number(s.load) || 0), 0);
        avg_load = sum_load / seriesCompletedParsed.length;
        avg_load = Math.round(avg_load * 100) / 100; // Redondear a 2 decimales
      }

      // Almacenar series parseadas
      item.series_completed = seriesCompletedParsed;

      const groupKey = item.exercise_name;
      if (!exerciseGroups.has(groupKey)) {
        exerciseGroups.set(groupKey, []);
      }
      exerciseGroups.get(groupKey)!.push({
        row: item,
        avg_load,
        fecha: new Date(item.fecha_rutina),
        rutina_id: item.rutina_id.toString(),
      });
    }

    // Calcular last_weight_comparation
    for (const group of exerciseGroups.values()) {
      // Ordenar DESC por fecha y ASC por rutina_id (como en la respuesta)
      group.sort((a, b) => {
        if (a.fecha.getTime() !== b.fecha.getTime()) {
          return b.fecha.getTime() - a.fecha.getTime(); // DESC
        }
        return a.rutina_id.localeCompare(b.rutina_id); // ASC
      });

      // Asignar diferencias
      for (let i = 0; i < group.length; i++) {
        const diff = i === 0 ? 0 : group[i].avg_load - group[i - 1].avg_load;
        group[i].row.last_weight_comparation = Math.round(diff * 100) / 100; // Redondear a 2 decimales
      }
    }

    // Construir respuesta
    if (rows.length > 0) {
      const datesMap = new Map<string, { fecha_rutina: string; routines: Map<string, { rutina_id: string; routine_name: string; exercises: Exercise[] }> }>();
      for (const item of rows) {
        const dateKey = item.fecha_rutina;
        const routineKey = item.rutina_id.toString();
        if (!datesMap.has(dateKey)) {
          datesMap.set(dateKey, { fecha_rutina: dateKey, routines: new Map() });
        }
        const dateEntry = datesMap.get(dateKey)!;
        if (!dateEntry.routines.has(routineKey)) {
          dateEntry.routines.set(routineKey, { rutina_id: routineKey, routine_name: item.routine_name, exercises: [] });
        }
        dateEntry.routines.get(routineKey)!.exercises.push({
          exercise_name: item.exercise_name,
          description: item.description,
          thumbnail_url: item.thumbnail_url,
          video_url: item.video_url,
          liked: item.liked,
          liked_reason: item.liked_reason,
          series_completed: item.series_completed,
          last_weight_comparation: item.last_weight_comparation ?? 0,
        });
      }

      const responseData: RoutineResponse[] = Array.from(datesMap.values()).map(dateEntry => ({
        fecha_rutina: dateEntry.fecha_rutina,
        routines: Array.from(dateEntry.routines.values()),
      }));

      let message = "Rutinas encontradas con el ejercicio especificado";
      if (routine_name) message += " en la rutina especificada";
      if (formattedFecha) message = `Rutina encontrada para la fecha y ejercicio especificado${routine_name ? " en la rutina especificada" : ""}`;

      res.status(200).json({ error: false, message, response: responseData });
      return;
    }

    let notFoundMessage = "No se encontraron rutinas con el ejercicio especificado";
    if (routine_name) notFoundMessage += " en la rutina especificada";
    if (formattedFecha) notFoundMessage = `No se encontró la rutina con el ejercicio especificado en la fecha proporcionada${routine_name ? " en la rutina especificada" : ""}`;

    res.status(404).json({ error: true, message: notFoundMessage, response: [] });
  } catch (error) {
    console.error("Error al obtener rutina por nombre de ejercicio:", error);
    next(error);
  }
};


export const routinesSaved = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { headers, body } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    if (!body.fecha_rutina || !body.rutina) {
      res.status(400).json({
        error: true,
        message: "El campo 'fecha_rutina' y 'rutina' son obligatorios.",
      });
      return;
    }

    const { fecha_rutina, rutina } = body;

    const formattedFecha = convertDate(fecha_rutina as string);

    const { routine_name, exercises } = rutina;

    if (!routine_name) {
      res.status(400).json({
        error: true,
        message: "'routine_name' es obligatorio.",
      });
      return;
    }

    const validExercises = exercises.filter((exercise: any, index: number) => {
      const valid = exercise.exercise_name && exercise.series_completed && exercise.series_completed.length > 0;
      if (!valid) {
        console.log(`Ejercicio inválido en el índice ${index}: ${exercise.exercise_name}`);
      }
      return valid;
    });

    console.log(`Ejercicios a insertar (validados): ${validExercises.length}`);

    if (validExercises.length === 0) {
      res.status(400).json({
        error: true,
        message: "No se encontraron ejercicios válidos para insertar.",
      });
      return;
    }

    const rutinaId = uuidv4();

    let totalInsertedExercises = 0;
    const insertedExerciseResults = [];

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Actualizar el estado de la rutina a 'completed' directamente
      const [updateResult]: any = await connection.execute(
        "UPDATE user_routine SET status = ? WHERE user_id = ? AND date = ?",
        ['completed', userId, formattedFecha]
      );

      if (updateResult.affectedRows > 0) {
        console.log(`Estado de la rutina para la fecha ${formattedFecha} actualizado a 'completed'.`);
      } else {
        console.log(`No se encontró una rutina para actualizar en la fecha ${formattedFecha}`);
      }

      for (const exercise of validExercises) {
        const { exercise_name, description, thumbnail_url, video_url, liked, liked_reason, series_completed } = exercise;

        const safeLiked = liked === undefined ? false : liked;
        const safeLikedReason = liked_reason === null || liked_reason === undefined ? '' : liked_reason;
        const safeSeriesCompleted = series_completed === null || series_completed === undefined ? '[]' : JSON.stringify(series_completed);

        const [exerciseInsertResult]: any = await connection.execute(
          "INSERT INTO complete_rutina (fecha_rutina, user_id, routine_name, exercise_name, description, thumbnail_url, video_url, liked, liked_reason, series_completed, rutina_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            formattedFecha,
            userId,
            routine_name,
            exercise_name,
            description,
            thumbnail_url,
            video_url,
            safeLiked,
            safeLikedReason,
            safeSeriesCompleted,
            rutinaId,
          ]
        );


        if (exerciseInsertResult && exerciseInsertResult.insertId) {
          totalInsertedExercises++;
          insertedExerciseResults.push(exerciseInsertResult);
        }
      }

      await connection.commit();

      if (totalInsertedExercises > 0) {
        res.status(200).json({
          error: false,
          message: `Rutina y ${totalInsertedExercises} ejercicios guardados correctamente con rutina_id: ${rutinaId}`,
          response: {
            rutinaId: rutinaId,
            exerciseResults: insertedExerciseResults,
          },
        });
      } else {
        await connection.rollback();
        res.status(400).json({
          error: true,
          message: "No se insertó ningún ejercicio válido.",
          response: undefined,
        });
      }
    } catch (transactionError) {
      await connection.rollback();
      console.error("Error en la transacción al guardar rutinas:", transactionError);
      next(transactionError);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error general al guardar rutinas:", error);
    next(error);
  }
};

export const editExercise = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers["x-access-token"] as string;
    if (!token) { res.status(401).json({ error: true, message: "Token requerido" }); return; }

    let targetUserId: string;
    try {
      verify(token, SECRET) as JwtPayload;
      targetUserId = req.query.user_id as string;
      if (!targetUserId) { res.status(400).json({ error: true, message: "user_id requerido en query" }); return; }
    } catch {
      res.status(401).json({ error: true, message: "Token inválido" }); return;
    }

    // Body: plan_id + day_rutina_id + db_id (ejercicio a modificar)
    //       + new_db_id (opcional, nuevo ejercicio) + Esquema (opcional)
    const { plan_id, day_rutina_id, db_id, new_db_id, Esquema } = req.body;

    if (!plan_id || !day_rutina_id || !db_id) {
      res.status(400).json({ error: true, message: "Faltan: plan_id, day_rutina_id, db_id" });
      return;
    }

    // Obtener plan
    const [planRows]: any = await pool.execute(
      "SELECT id, training_plan FROM user_training_plans WHERE user_id = ? AND id = ?",
      [targetUserId, plan_id]
    );
    if (planRows.length === 0) { res.status(404).json({ error: true, message: "Plan no encontrado" }); return; }

    let trainingPlan: any[];
    try {
      trainingPlan = typeof planRows[0].training_plan === "string"
        ? JSON.parse(planRows[0].training_plan)
        : planRows[0].training_plan;
    } catch { res.status(500).json({ error: true, message: "JSON inválido" }); return; }

    // Validar new_db_id si viene
    if (new_db_id !== undefined) {
      const [exRows]: any = await pool.execute("SELECT id FROM exercises WHERE id = ? LIMIT 1", [new_db_id]);
      if (exRows.length === 0) { res.status(404).json({ error: true, message: "Ejercicio nuevo no encontrado" }); return; }
    }

    // Actualizar TODOS los días con ese day_rutina_id
    let updatedCount = 0;
    for (const day of trainingPlan) {
      if (day.rutina_id !== day_rutina_id) continue;
      for (const ej of day.ejercicios) {
        if (Number(ej.db_id) !== Number(db_id)) continue;
        if (new_db_id !== undefined) ej.db_id = Number(new_db_id);
        if (Esquema) {
          if (Esquema.Series !== undefined) ej.Esquema.Series = Esquema.Series;
          if (Esquema.Descanso !== undefined) ej.Esquema.Descanso = Esquema.Descanso;
          if (Esquema["Detalle series"]) ej.Esquema["Detalle series"] = Esquema["Detalle series"];
        }
        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      res.status(404).json({ error: true, message: "Ejercicio no encontrado en ningún día con ese day_rutina_id" });
      return;
    }

    await pool.execute(
      "UPDATE user_training_plans SET training_plan = ?, updated_at = NOW() WHERE id = ?",
      [JSON.stringify(trainingPlan), plan_id]
    );

    res.json({
      error: false,
      message: `Ejercicio actualizado en ${updatedCount} días (todos los que comparten day_rutina_id)`,
      response: { user_id: targetUserId, plan_id, day_rutina_id, db_id, new_db_id },
    });
  } catch (error) {
    console.error("Error editExercise:", error);
    next(error);
  }
};

export const addExercise = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. TOKEN (sin cambios)
    const token = req.headers["x-access-token"] as string;
    if (!token) {
      res.status(401).json({ error: true, message: "Token requerido" });
      return;
    }

    let currentUserId: string;
    let targetUserId: string;
    try {
      const decoded = verify(token, SECRET) as JwtPayload;
      currentUserId = decoded.userId;
      targetUserId = req.query.user_id as string;
      if (!targetUserId) {
        res.status(400).json({ error: true, message: "user_id requerido en query" });
        return;
      }
    } catch {
      res.status(401).json({ error: true, message: "Token inválido" });
      return;
    }

    // 2. BODY (sin cambios)
    const { rutina_id, day_fecha, new_exercise, updates } = req.body;
    if (!rutina_id || !day_fecha || !new_exercise || !updates || Object.keys(updates).length === 0) {
      res.status(400).json({ error: true, message: "Faltan: rutina_id, day_fecha, new_exercise, updates" });
      return;
    }

    // 3. OBTENER PLAN + VALIDAR rutina_id (sin cambios)
    const [planRows]: any = await pool.execute(
      `SELECT id, training_plan FROM user_training_plans WHERE user_id = ? AND id = ?`,
      [targetUserId, rutina_id]
    );

    if (planRows.length === 0) {
      res.status(404).json({ error: true, message: "Rutina no encontrada (user_id o rutina_id inválido)" });
      return;
    }

    let trainingPlan: any[];
    try {
      trainingPlan = typeof planRows[0].training_plan === "string"
        ? JSON.parse(planRows[0].training_plan)
        : planRows[0].training_plan;
    } catch {
      res.status(500).json({ error: true, message: "JSON inválido" });
      return;
    }

    // 4. CONSTRUIR EL NUEVO EJERCICIO - AGREGAR exercise_id
    const constructedExercise = {
      nombre_ejercicio: new_exercise,
      exercise_id: uuidv4(),  // ← Nuevo: genera UUID único
      Esquema: {
        Series: updates.Series,
        Descanso: updates.Descanso,
        "Detalle series": updates["Detalle series"]
      },
      description: updates.description,
      video_url: updates.video_url,
      thumbnail_url: updates.thumbnail_url
    };

    // 5. BUSCAR EL DÍA POR FECHA Y AGREGAR EL EJERCICIO (sin cambios)
    let found = false;

    for (const day of trainingPlan) {
      if (new Date(day.fecha).toISOString().split("T")[0] === day_fecha) {
        // AGREGAR EL NUEVO EJERCICIO
        day.ejercicios.push(constructedExercise);
        found = true;
        break;
      }
    }

    if (!found) {
      res.status(404).json({ error: true, message: "Día no encontrado en la rutina" });
      return;
    }

    // 6. GUARDAR (sin cambios)
    await pool.execute(
      `UPDATE user_training_plans SET training_plan = ?, updated_at = NOW() WHERE id = ?`,
      [JSON.stringify(trainingPlan), rutina_id]
    );

    // 7. RESPUESTA - Agrego exercise_id en la response para que el frontend lo sepa
    res.json({
      error: false,
      message: "Nuevo ejercicio agregado a la rutina",
      response: {
        user_id: targetUserId,
        rutina_id,
        day_fecha,
        exercise_name: new_exercise,
        exercise_id: constructedExercise.exercise_id  // ← Nuevo: devuelve el ID generado
      },
    });
  } catch (error) {
    console.error("Error:", error);
    next(error);
  }
};

export const deleteExercise = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. TOKEN
    const token = req.headers["x-access-token"] as string;
    if (!token) {
      res.status(401).json({ error: true, message: "Token requerido" });
      return;
    }

    let currentUserId: string;
    let targetUserId: string;
    try {
      const decoded = verify(token, SECRET) as JwtPayload;
      currentUserId = decoded.userId;
      targetUserId = req.query.user_id as string;
      if (!targetUserId) {
        res.status(400).json({ error: true, message: "user_id requerido en query" });
        return;
      }
    } catch {
      res.status(401).json({ error: true, message: "Token inválido" });
      return;
    }

    // 2. BODY
    const { rutina_id, fecha_rutina, exercise_id } = req.body;
    if (!rutina_id || !fecha_rutina || !exercise_id) {
      res.status(400).json({ error: true, message: "Faltan: rutina_id, fecha_rutina, exercise_id" });
      return;
    }

    // Formatear fecha_rutina a YYYY-MM-DD
    let formattedFecha: string;
    try {
      formattedFecha = convertDate(fecha_rutina);  // Asume tu función convertDate
    } catch {
      res.status(400).json({ error: true, message: "Formato de fecha_rutina inválido (usa DD/MM/YYYY)" });
      return;
    }

    // 3. OBTENER PLAN + VALIDAR rutina_id
    const [planRows]: any = await pool.execute(
      `SELECT id, training_plan FROM user_training_plans WHERE user_id = ? AND id = ?`,
      [targetUserId, rutina_id]
    );

    if (planRows.length === 0) {
      res.status(404).json({ error: true, message: "Rutina no encontrada (user_id o rutina_id inválido)" });
      return;
    }

    let trainingPlan: any[];
    try {
      trainingPlan = typeof planRows[0].training_plan === "string"
        ? JSON.parse(planRows[0].training_plan)
        : planRows[0].training_plan;
    } catch {
      res.status(500).json({ error: true, message: "JSON inválido" });
      return;
    }

    // 4. BUSCAR EL DÍA POR FECHA Y ELIMINAR EL EJERCICIO
    let found = false;

    for (const day of trainingPlan) {
      const dayFecha = new Date(day.fecha).toISOString().split("T")[0];
      if (dayFecha === formattedFecha) {
        const exerciseIndex = day.ejercicios.findIndex((e: any) => e.exercise_id === exercise_id);

        if (exerciseIndex !== -1) {
          // ELIMINAR EL EJERCICIO DEL ARRAY
          day.ejercicios.splice(exerciseIndex, 1);
          found = true;
          break;
        }
      }
    }

    if (!found) {
      res.status(404).json({ error: true, message: "Ejercicio no encontrado en la fecha/rutina" });
      return;
    }

    // 5. GUARDAR
    await pool.execute(
      `UPDATE user_training_plans SET training_plan = ?, updated_at = NOW() WHERE id = ?`,
      [JSON.stringify(trainingPlan), rutina_id]
    );

    res.json({
      error: false,
      message: "Ejercicio eliminado exitosamente",
      response: {
        user_id: targetUserId,
        rutina_id,
        fecha_rutina: formattedFecha,
        exercise_id,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    next(error);
  }
};

export const searchInGeneratedRoutine = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Autenticación
    const token = req.headers["x-access-token"] as string;
    if (!token) {
      res.status(401).json({ error: true, message: "Token requerido" });
      return;
    }

    let currentUserId: string;
    let targetUserId: string;
    try {
      const decoded = verify(token, SECRET) as JwtPayload;
      currentUserId = decoded.userId;
      targetUserId = (req.query.user_id as string) || currentUserId;
    } catch {
      res.status(401).json({ error: true, message: "Token inválido" });
      return;
    }

    // 2. Parámetros
    const { fecha_rutina, exercise_id } = req.query;

    if (!fecha_rutina) {
      res.status(400).json({
        error: true,
        message: "El parámetro 'fecha_rutina' es obligatorio",
      });
      return;
    }

    const formattedFecha = convertDate(fecha_rutina as string);

    // 3. Obtener la rutina más reciente + su id
    const [planRows]: any = await pool.execute(
      `SELECT id, training_plan 
       FROM user_training_plans 
       WHERE user_id = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [targetUserId]
    );

    if (planRows.length === 0) {
      res.status(404).json({ error: true, message: "No hay rutina generada para este usuario" });
      return;
    }

    const rutina_id = planRows[0].id;

    // Parsear el plan de entrenamiento
    let trainingPlan: any[];
    const rawData = planRows[0].training_plan;
    console.log("Longitud respuesta:", rawData.length);
    console.log("Termina con:", rawData.slice(-50));
    try {
      if (typeof rawData === "string") {
        const cleaned = rawData
          .replace(/'/g, '"')
          .replace(/\r\n|\r|\n/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        trainingPlan = JSON.parse(cleaned);
      } else if (Array.isArray(rawData)) {
        trainingPlan = rawData;
      } else {
        throw new Error("Formato no soportado");
      }
    } catch (error) {
      console.error("Error parseando training_plan:", error);
      res.status(500).json({ error: true, message: "JSON del plan inválido" });
      return;
    }

    // 4. Buscar el día correspondiente a la fecha
    const day = trainingPlan.find((d: any) =>
      new Date(d.fecha).toISOString().split("T")[0] === formattedFecha
    );

    if (!day) {
      res.status(404).json({ error: true, message: "Fecha no encontrada en la rutina generada" });
      return;
    }

    // 5. Base de la respuesta común
    const baseResponse = {
      error: false,
      rutina_id,
      user_id: targetUserId,
      fecha_rutina: formattedFecha,
      routine_name: day.nombre,
      queried_by_admin: targetUserId !== currentUserId,
    };

    // 6. Caso: se proporciona exercise_id → devolver solo ese ejercicio
    if (exercise_id) {
      const exercise = day.ejercicios.find((e: any) => e.exercise_id === exercise_id);

      if (!exercise) {
        res.status(404).json({
          error: true,
          message: "Ejercicio no encontrado con ese exercise_id en esta fecha",
        });
        return;
      }

      res.json({
        ...baseResponse,
        message: "Ejercicio específico encontrado",
        response: {
          exercise: {
            nombre_ejercicio: exercise.nombre_ejercicio,
            exercise_id: exercise.exercise_id,
            description: exercise.description || "",
            video_url: exercise.video_url || "",
            thumbnail_url: exercise.thumbnail_url || "",
            Esquema: exercise.Esquema,
          },
        },
      });
      return;
    }

    // 7. Caso: solo fecha_rutina → devolver todos los ejercicios del día
    const ejerciciosFormateados = day.ejercicios.map((e: any) => ({
      nombre_ejercicio: e.nombre_ejercicio,
      exercise_id: e.exercise_id,
      description: e.description || "",
      video_url: e.video_url || "",
      thumbnail_url: e.thumbnail_url || "",
      Esquema: e.Esquema,
    }));

    res.json({
      ...baseResponse,
      message: "Día completo encontrado",
      response: {
        ejercicios: ejerciciosFormateados,
        status: day.status || "pending",
      },
    });
  } catch (error) {
    console.error("Error en searchInGeneratedRoutine:", error);
    next(error);
  }
};