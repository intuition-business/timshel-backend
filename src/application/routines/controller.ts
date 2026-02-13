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

    // Integrar estados (sin cambios)
    trainingPlan = trainingPlan.map((day: any) => {
      const normalizedDayDate = day.fecha ? new Date(day.fecha).toISOString().split("T")[0] : null;
      const status = normalizedDayDate ? statusMap[normalizedDayDate] || "pending" : "pending";
      return {
        ...day,
        status
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

    // Consultamos los días seleccionados por el usuario
    const [userRoutineRows]: any = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? ORDER BY date",
      [userId]
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
    const newId = await getUuidv4();
    const personData = adapter(rows?.[0]);

    // Generar los primeros 3 días sincronamente
    const firstThreeDays = daysData.slice(0, 3);
    let prompt = await readFiles(personData, firstThreeDays);

    // Llamamos a la IA para generar la rutina
    const { response, error } = await getOpenAI(prompt);

    // Validamos si la respuesta de OpenAI es válida
    if (response?.choices?.[0]?.message?.content) {
      let parsed;
      try {
        parsed = JSON.parse(response.choices[0].message.content || "");
      } catch (parseError: unknown) {
        handleParseError(parseError, res);
        return;
      }

      // Verificamos que parsed tenga la propiedad 'workouts' o 'training_plan' y que sea un array
      let trainingPlan =
        parsed.workouts ||
        parsed.training_plan ||
        parsed.workout_plan ||
        (Array.isArray(parsed) ? parsed : [parsed]);
      if (parsed && Array.isArray(trainingPlan)) {
        // Asociamos las fechas con la rutina generada
        trainingPlan.forEach((day: any, index: number) => {
          const dateData = firstThreeDays[index];
          day.fecha = dateData ? dateData.date : null;

          if (Array.isArray(day.ejercicios)) {
            day.ejercicios.forEach((ex: any) => {
              if (!ex.exercise_id) {
                ex.exercise_id = uuidv4();
              }
            });
          }
        });

        // Guardar los primeros 3 días en la DB (parcial)
        const trainingPlanJson = JSON.stringify(trainingPlan); // Convertir a string si usas TEXT; si usas JSON, usa el objeto directamente

        // Insertar o actualizar el registro
        await pool.execute(
          "INSERT INTO user_training_plans (user_id, training_plan) VALUES (?, ?) ON DUPLICATE KEY UPDATE training_plan = ?",
          [userId, trainingPlanJson, trainingPlanJson]
        );

        // Obtener el ID del registro (para INSERT o UPDATE)
        const [result]: any = await pool.execute(
          "SELECT id FROM user_training_plans WHERE user_id = ?",
          [userId]
        );
        const routineId = result?.[0]?.id;

        if (!routineId) {
          throw new Error("No se pudo obtener el ID del registro");
        }

        res.json({
          response: "Documento generado.",
          error: false,
          message: "Documento generado.",
          routine_id: routineId,
          user_id: userId
        });

        // Generar el resto en segundo plano
        setImmediate(async () => {
          try {
            const fullPrompt = await readFiles(personData, daysData);
            const { response: fullResponse } = await getOpenAI(fullPrompt);
            let parsedFull = JSON.parse(fullResponse?.choices[0].message.content || "");
            let fullTrainingPlan = parsedFull.workouts || parsedFull.training_plan || parsedFull.workout_plan;
            if (Array.isArray(fullTrainingPlan)) {
              fullTrainingPlan.forEach((day: any, index: number) => {
                const dateData = daysData[index];
                day.fecha = dateData ? dateData.date : null;

                if (Array.isArray(day.ejercicios)) {
                  day.ejercicios.forEach((ex: any) => {
                    if (!ex.exercise_id) {
                      ex.exercise_id = uuidv4();
                    }
                  });
                }
              });
              const fullTrainingPlanJson = JSON.stringify(fullTrainingPlan);
              await pool.execute(
                "UPDATE user_training_plans SET training_plan = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                [fullTrainingPlanJson, userId]
              );
              console.log('Rutina completa generada y guardada para user_id:', userId);
            }
          } catch (bgError) {
            console.error('Error en generación de rutina completa en segundo plano:', bgError);
          }
        });

        return;
      } else {
        console.error("La propiedad 'workouts' o 'training_plan' no es un array:", parsed);
        res.json({
          response: "",
          error: true,
          message: "La respuesta generada por la IA no es un array. Por favor intente nuevamente.",
          details: { responseContent: response.choices[0].message.content },
        });
        return;
      }
    }

    res.json({
      response: "",
      error: true,
      message: "No se generó respuesta de OpenAI. Intenta más tarde.",
      details: { openAiResponse: response },
    });
  } catch (error) {
    console.error("Error al generar la rutina con IA:", error);
    res.json({
      response: "",
      error: true,
      message: "Ocurrió un error al generar la rutina con IA.",
      details: error,
    });
    next(error);
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
    if (!exercise_name || typeof exercise_name !== "string") {
      res.status(400).json({ error: true, message: "Nombre del ejercicio es requerido y debe ser una cadena" });
      return;
    }

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

    // Construcción de consulta
    let query = `
      SELECT fecha_rutina, routine_name, rutina_id, exercise_name, description, thumbnail_url, video_url, liked, liked_reason, series_completed
      FROM complete_rutina
      WHERE user_id = ? AND LOWER(exercise_name) LIKE LOWER(?)
    `;
    const params: (string | number)[] = [userId, `%${exercise_name}%`];
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

    // 2. BODY - Ahora usa exercise_id + fecha_rutina para precisión
    const { rutina_id, fecha_rutina, exercise_id, updates } = req.body;
    if (!rutina_id || !fecha_rutina || !exercise_id || !updates || Object.keys(updates).length === 0) {
      res.status(400).json({ error: true, message: "Faltan: rutina_id, fecha_rutina, exercise_id, updates" });
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

    // 3. OBTENER PLAN + VALIDAR rutina_id (sin cambios)
    const [planRows]: any = await pool.execute(
      `SELECT id, training_plan FROM user_training_plans WHERE user_id = ? AND id = ?`,
      [targetUserId, rutina_id]
    );

    if (planRows.length === 0) {
      res.status(404).json({ error: true, message: "Rutina no encontrada" });
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

    // 4. BUSCAR POR FECHA + EXERCISE_ID Y ACTUALIZAR
    let found = false;
    let updatedExercise: any = null;

    for (const day of trainingPlan) {
      const dayFecha = new Date(day.fecha).toISOString().split("T")[0];
      if (dayFecha === formattedFecha) {
        const exerciseIndex = day.ejercicios.findIndex((e: any) => e.exercise_id === exercise_id);

        if (exerciseIndex !== -1) {
          const exercise = day.ejercicios[exerciseIndex];

          // APLICAR CAMBIOS - Ajustado para exercise_name
          if (updates.exercise_name !== undefined) exercise.nombre_ejercicio = updates.exercise_name;  // ← CORREGIDO: usa "exercise_name" en updates
          if (updates.Series !== undefined) exercise.Esquema.Series = updates.Series;
          if (updates.Descanso !== undefined) exercise.Esquema.Descanso = updates.Descanso;
          if (updates["Detalle series"]) exercise.Esquema["Detalle series"] = updates["Detalle series"];
          if (updates.description !== undefined) exercise.description = updates.description;
          if (updates.video_url !== undefined) exercise.video_url = updates.video_url;
          if (updates.thumbnail_url !== undefined) exercise.thumbnail_url = updates.thumbnail_url;

          updatedExercise = {
            fecha_rutina: formattedFecha,
            routine_name: day.nombre,
            exercise_id: exercise.exercise_id,
            exercise_name: exercise.nombre_ejercicio,  // Devuelve el nuevo nombre si cambió
          };
          found = true;
          break;
        }
      }
    }

    if (!found) {
      res.status(404).json({ error: true, message: "Ejercicio no encontrado en la fecha/rutina" });
      return;
    }

    // 5. GUARDAR (sin cambios)
    await pool.execute(
      `UPDATE user_training_plans SET training_plan = ?, updated_at = NOW() WHERE id = ?`,
      [JSON.stringify(trainingPlan), rutina_id]
    );

    res.json({
      error: false,
      message: "Ejercicio actualizado exitosamente",
      response: {
        user_id: targetUserId,
        rutina_id,
        ...updatedExercise,
      },
    });
  } catch (error) {
    console.error("Error:", error);
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