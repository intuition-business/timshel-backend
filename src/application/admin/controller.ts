import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterUsers } from "./adapter"; // Importa el adaptador para users
import { getUsersListDto } from "./dto"; // Importa el DTO para list
import { getExerciseDto } from "../exercises/dto";
import { adapterExercises } from "../exercises/adapter";

interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  fecha_registro: Date;
  trainer_id: number | null;
  trainer_name: string | null;
}

interface Exercise {
  id: number;
  category: string;
  exercise: string;
  description: string;
  video_url?: string;
  thumbnail_url?: string;
  at_home?: boolean;
}

interface GetUsersResponse {
  message: string;
  error: boolean;
  data: User[];
  current_page: number;
  total_users: number;
  total_pages: number;
}

export const getAllExercises = async (req: Request, res: Response, next: NextFunction) => {
  const { page, limit } = req.query; // page y limit opcionales para paginación
  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId; // Mantenemos auth

  // Response con paginación (o sin si no se pasa params)
  const response = {
    message: "",
    error: false,
    data: [] as Exercise[],
    current_page: 0,
    total_exercises: 0,
    total_pages: 0
  };

  try {
    // Validación con DTO si aplica (por ejemplo, para query params si hay filtros)
    const { error: dtoError } = getExerciseDto.validate(req.query);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    // Determina si paginar o traer todo
    const shouldPaginate = page !== undefined || limit !== undefined;
    let pageNum: number | null = null;
    let limitNum: number | null = null;
    let offset = 0;

    if (shouldPaginate) {
      pageNum = Math.max(1, parseInt(page as string, 10));
      limitNum = Math.max(1, Math.min(100, parseInt(limit as string, 10))); // Limita el límite entre 1 y 100
      offset = (pageNum - 1) * limitNum;
    }

    // Consulta para contar el total de ejercicios
    const [countRows] = await pool.execute(
      "SELECT COUNT(*) AS total FROM exercises"
    );
    const totalExercises = (countRows as any)[0].total;

    let exerciseRows: any[] = [];

    if (shouldPaginate) {
      const totalPages = Math.ceil(totalExercises / limitNum!);

      // Consulta paginada
      const [rows] = await pool.execute(
        "SELECT id, category, exercise, description, video_url, thumbnail_url, at_home FROM exercises ORDER BY id ASC LIMIT ? OFFSET ?",
        [limitNum, offset]
      );

      exerciseRows = rows as Array<{
        id: number;
        category: string;
        exercise: string;
        description: string;
        video_url?: string;
        thumbnail_url?: string;
        at_home?: number | null;  // De DB, mapea en adapter
      }>;

      response.current_page = pageNum!;
      response.total_exercises = totalExercises;
      response.total_pages = totalPages;
    } else {
      // Traer todos sin paginación
      const [rows] = await pool.execute(
        "SELECT id, category, exercise, description, video_url, thumbnail_url, at_home FROM exercises ORDER BY id ASC"
      );

      exerciseRows = rows as Array<{
        id: number;
        category: string;
        exercise: string;
        description: string;
        video_url?: string;
        thumbnail_url?: string;
        at_home?: number | null;  // De DB, mapea en adapter
      }>;

      response.current_page = 1;
      response.total_exercises = totalExercises;
      response.total_pages = 1;
    }

    // Enviar respuesta si hay datos
    if (exerciseRows.length > 0) {
      response.data = adapterExercises(exerciseRows);
      response.message = "Ejercicios obtenidos exitosamente";
      if (!shouldPaginate) {
        response.message += " (Todos los ejercicios sin paginación)";
      } else if (pageNum === 1 && exerciseRows.length <= 20) {
        response.message += " (Estás en la primera página)";
      }
      return res.status(200).json(response);
    } else {
      // Si no hay datos
      response.error = true;
      response.message = "No se encontraron ejercicios";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener los ejercicios:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener los ejercicios." });
  }
};