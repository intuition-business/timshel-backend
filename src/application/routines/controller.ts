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
) => {
  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId;

  // const filePath = path.join(
  //   __dirname,
  //   `data/${userId}/plan_entrenamiento.json`
  // );

  const filePath = `/usr/src/app/src/application/routines/data/${userId}/plan_entrenamiento.json`;
  try {
    const data = await fs.readFile(filePath, "utf8");
    res.json(JSON.parse(data)); // Express automáticamente establece el Content-Type a application/json y envía el JSON
  } catch (error) {
    console.error("Error al leer el archivo JSON:", error);
    //res.status(500).send("Error interno del servidor al leer el archivo JSON.");
    next(error);
  }
};

export const generateRoutinesIa = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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

    console.log("Días seleccionados por el usuario:", userRoutineRows);

    // Si la tabla está vacía, generamos días predeterminados
    let daysData;
    if (userRoutineRows.length === 0) {
      // Generamos los días de rutina por defecto: lunes, miércoles, viernes
      const currentDate = new Date(); // Fecha actual para comenzar
      const defaultDays = ['Monday', 'Wednesday', 'Friday'];
      daysData = defaultDays.map((day, index) => {
        let nextDate = new Date(currentDate);
        nextDate.setDate(currentDate.getDate() + (index * 2)); // Sumamos 2 días por cada día de la semana
        return {
          day: day,
          date: nextDate.toISOString().split('T')[0], // Formato: YYYY-MM-DD
        };
      });
      console.log("Días generados por defecto:", daysData);
    } else {
      daysData = userRoutineRows; // Usamos los días guardados en la tabla
      console.log("Días obtenidos de la base de datos:", daysData);
    }

    // Consulta para obtener los datos del usuario desde la tabla 'formulario'
    const [rows]: any = await pool.execute(
      "SELECT * FROM formulario WHERE usuario_id = ?",
      [userId]
    );

    console.log("Datos del formulario obtenidos:", rows);

    const personData = adapter(rows?.[0]);

    // Modificamos el prompt para incluir los días específicos
    let prompt = await readFiles(personData);
    prompt = prompt.replace("###DIAS###", JSON.stringify(daysData));

    console.log("Prompt generado para OpenAI:", prompt);

    // Llamamos a la IA para generar la rutina
    const { response, error } = await getOpenAI(prompt);

    if (response) {
      const userDirPath = path.join(__dirname, `data/${userId}`);
      await fs.mkdir(userDirPath, { recursive: true });

      const pathFilePrompt = path.join(userDirPath, "plan_entrenamiento.json");
      const parsed = JSON.parse(response.choices[0].message.content || "");

      console.log("Rutina generada por OpenAI:", parsed);

      // Asociamos las fechas con la rutina generada
      parsed.forEach((day: any, index: number) => {
        const dateData = daysData[index];
        day.date = dateData ? dateData.date : null;
      });

      await fs.writeFile(pathFilePrompt, JSON.stringify(parsed, null, 2), "utf-8");

      console.log("Documento guardado en:", pathFilePrompt);

      res.json({
        response: "Documento generado.",
        error: false,
        message: "Documento generado.",
        path_file: pathFilePrompt,
      });
      return;
    }

    console.error("No se generó respuesta de OpenAI");

    res.json({
      response: "",
      error: true,
      message: "Ocurrió un error al procesar los datos. Por favor intente más tarde.",
    });
  } catch (error) {
    console.error("Error al generar la rutina con IA:", error);
    next(error);
  }
};

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
    // ------------------------------------------

    let totalInsertedExercises = 0;
    const insertedExerciseResults = [];

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      for (const exercise of validExercises) {
        const { exercise_name, description, thumbnail_url, video_url, liked, liked_reason, series_completed } = exercise;

        const safeLiked = liked === undefined ? false : liked;
        const safeLikedReason = liked_reason === null || liked_reason === undefined ? '' : liked_reason;
        const safeSeriesCompleted = series_completed === null || series_completed === undefined ? '[]' : JSON.stringify(series_completed);

        const [exerciseInsertResult]: any = await connection.execute(
          "INSERT INTO complete_rutina (fecha_rutina, user_id, routine_name, exercise_name, description, thumbnail_url, video_url, liked, liked_reason, series_completed, rutina_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            fecha_rutina,
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

        console.log(`Resultado de inserción de ejercicio '${exercise_name}':`, exerciseInsertResult);

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