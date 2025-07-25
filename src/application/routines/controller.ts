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
import { v4 as uuidv4 } from 'uuid';

interface Exercise {
  exercise_name: string;
  description: string;
  thumbnail_url: string;
  video_url: string;
  liked: boolean | null;
  liked_reason: string | null;
  series_completed: { reps: number, load: number, breakTime: number }[];  // Definimos las series completadas como un arreglo de objetos
}

/* export const getRoutines = async (
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
}; */

export const getGeneratedRoutinesIa = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  try {
    // Obtener el plan de entrenamiento desde la base de datos
    const [planRows]: any = await pool.execute(
      "SELECT id, training_plan FROM user_training_plans WHERE user_id = ?",
      [userId]
    );

    if (planRows.length === 0) {
      res.status(404).json({
        response: "",
        error: true,
        message: "No se encontró un plan de entrenamiento para este usuario."
      });
      return;
    }

    let trainingPlan;
    if (typeof planRows[0].training_plan === "string") {
      // Si es TEXT, parsear el string a JSON
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
      // Si es JSON, ya es un objeto
      trainingPlan = planRows[0].training_plan;
    }

    // Validar que trainingPlan es un array
    if (!Array.isArray(trainingPlan)) {
      console.error("training_plan no es un array:", trainingPlan);
      res.status(500).json({
        response: "",
        error: true,
        message: "El plan de entrenamiento no es un array válido."
      });
      return;
    }

    // Obtener los días y estados desde la tabla user_routine
    const [routineRows]: any = await pool.execute(
      "SELECT date, status FROM user_routine WHERE user_id = ? ORDER BY date",
      [userId]
    );

    // Crear un mapa de fechas a estados
    const statusMap: { [key: string]: string } = {};
    routineRows.forEach((row: any) => {
      // Normalizar la fecha a ISO sin hora para comparación
      const normalizedDate = new Date(row.date).toISOString().split("T")[0];
      // Validar que el estado pertenece al ENUM
      if (["pending", "completed", "in-progress"].includes(row.status)) {
        statusMap[normalizedDate] = row.status;
      }
    });

    // Integrar los estados en el trainingPlan
    trainingPlan = trainingPlan.map((day: any) => {
      // Normalizar la fecha del día en trainingPlan
      const normalizedDayDate = day.fecha ? new Date(day.fecha).toISOString().split("T")[0] : null;
      const status = normalizedDayDate ? statusMap[normalizedDayDate] || "pending" : "pending";
      return {
        ...day,
        status // Agregar el campo status a cada día
      };
    });

    res.json({
      response: trainingPlan,
      error: false,
      message: "Plan de entrenamiento obtenido con éxito.",
      routine_id: planRows[0].id,
      user_id: userId
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
    console.log("Iniciando la generación de rutina con IA...");

    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    console.log("Token decodificado. userId:", userId);

    // Consultamos los días seleccionados por el usuario
    const [userRoutineRows]: any = await pool.execute(
      "SELECT day, date FROM user_routine WHERE user_id = ? ORDER BY date",
      [userId]
    );

    let daysData;
    if (userRoutineRows.length === 0) {
      daysData = generateDefaultRoutineDays();
      console.log("Días generados por defecto:", daysData);
    } else {
      daysData = userRoutineRows;
      console.log("Días obtenidos de la base de datos:", daysData);
    }

    // Consulta para obtener los datos del usuario desde la tabla 'formulario'
    const [rows]: any = await pool.execute(
      "SELECT * FROM formulario WHERE usuario_id = ?",
      [userId]
    );

    const personData = adapter(rows?.[0]);

    // Modificamos el prompt para incluir los días específicos
    let prompt = await readFiles(personData, daysData);
    console.log("Prompt generado para OpenAI:", prompt);

    // Llamamos a la IA para generar la rutina
    const { response, error } = await getOpenAI(prompt);

    // Validamos si la respuesta de OpenAI es válida
    if (response?.choices?.[0]?.message?.content) {
      console.log("Respuesta completa de OpenAI:", response);

      let parsed;
      try {
        parsed = JSON.parse(response.choices[0].message.content || "");
      } catch (parseError: unknown) {
        handleParseError(parseError, res);
        return;
      }

      console.log("Respuesta completa parseada de OpenAI:", parsed);

      // Verificamos que parsed tenga la propiedad 'workouts' o 'training_plan' y que sea un array
      const trainingPlan = parsed.workouts || parsed.training_plan;
      if (parsed && Array.isArray(trainingPlan)) {
        // Asociamos las fechas con la rutina generada
        trainingPlan.forEach((day: any, index: number) => {
          const dateData = daysData[index];
          day.fecha = dateData ? dateData.date : null;
        });

        // Guardar en la DB
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

        console.log("Plan de entrenamiento guardado en la DB para userId:", userId, "con routineId:", routineId);

        res.json({
          response: "Documento generado.",
          error: false,
          message: "Documento generado.",
          routine_id: routineId,
          user_id: userId
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

    // Selecciona todos los campos necesarios para reconstruir la rutina y sus ejercicios
    const [rows]: any = await pool.execute(
      "SELECT fecha_rutina, routine_name, rutina_id, exercise_name, description, thumbnail_url, video_url, liked, liked_reason, series_completed FROM complete_rutina WHERE user_id = ? ORDER BY fecha_rutina DESC, rutina_id, exercise_name",
      [userId]
    );

    if (rows.length > 0) {
      const routinesMap = new Map();

      for (const item of rows) {
        let seriesCompletedParsed = item.series_completed; // Asigna directamente si es JSON

        // Si 'series_completed' no es un JSON válido, asignamos un arreglo vacío
        if (typeof seriesCompletedParsed === 'string') {
          try {
            seriesCompletedParsed = JSON.parse(seriesCompletedParsed); // Solo parsear si es string
          } catch (jsonError) {
            console.error(`Error parsing series_completed for exercise ${item.exercise_name}:`, jsonError);
            seriesCompletedParsed = [];  // Si hay error, asignamos un arreglo vacío
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
        message: "Rutinas guardadas",
        response: responseData,
      });
      return;
    }

    res.status(404).json({
      error: true,
      response: undefined,
      message: "No se encontraron rutinas guardadas",
    });
  } catch (error) {
    console.error("Error al obtener rutinas guardadas:", error);
    next(error);
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

    // Cambiar para obtener fecha_rutina de query params
    const { fecha_rutina } = req.query;

    // Validar que la fecha se haya pasado correctamente
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

    // Convertir la fecha a formato adecuado
    const formattedFecha = convertDate(fecha_rutina);

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
    console.log(`UUID generado para rutina_id: ${rutinaId}`);

    let totalInsertedExercises = 0;
    const insertedExerciseResults = [];

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [rows]: any = await connection.execute(
        "SELECT id, status FROM user_routine WHERE date = ? AND status = 'pending'",
        [formattedFecha]
      );

      if (rows.length > 0) {
        const { id } = rows[0];

        // Actualizar el estado de la rutina a 'approved'
        const [updateResult]: any = await connection.execute(
          "UPDATE user_routine SET status = ? WHERE id = ?",
          ['completed', id]
        );

        if (updateResult.affectedRows > 0) {
          console.log(`Estado de la rutina para la fecha ${formattedFecha} actualizado a 'approved'.`);
        } else {
          console.error(`No se pudo actualizar el estado de la rutina para la fecha ${formattedFecha}`);
        }
      } else {
        console.log(`No se encontró una rutina pendiente para la fecha ${formattedFecha}`);
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
