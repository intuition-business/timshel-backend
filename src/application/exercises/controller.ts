import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterExercises } from "./adapter";
import { createExerciseDto, getExerciseDto, updateExerciseDto, deleteExerciseDto } from "./dto"; // Importamos los DTOs
// Agrega estas importaciones (de mi código anterior)
import path from "path";
import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// S3 config (cópialo de antes si no lo tienes)
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_BUCKET_NAME!,
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    let folder = 'exercise-videos';
    if (file.fieldname === 'thumbnail') folder = 'exercise-thumbnails';
    cb(null, `${folder}/${uniqueSuffix}${ext}`);
  },
});

// Multer (cópialo de antes)
export const uploadExerciseMedia = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video' && file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else if (file.fieldname === 'thumbnail' && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 },
});

interface Exercise {
  id: number;
  category: string;
  exercise: string;
  description: string;
  video_url?: string;
  thumbnail_url?: string;
  at_home?: boolean;
}

// Create con uploads integrados
export const createExercise = async (req: Request, res: Response, next: NextFunction) => {
  const { category, exercise, description, at_home } = req.body; // Campos de texto
  const files = req.files as { [fieldname: string]: Express.MulterS3.File[] } | undefined;

  const response = { message: "", error: false };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    // Validación DTO (actualiza DTO para no requerir video/thumbnail)
    const { error: dtoError } = createExerciseDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    if (!category || !exercise || !description) {
      response.error = true;
      response.message = "Faltan campos requeridos.";
      return res.status(400).json(response);
    }

    // Verificar existencia
    const [existing] = await pool.execute(
      "SELECT id FROM exercises WHERE category = ? AND exercise = ?",
      [category.toUpperCase(), exercise]
    );
    if ((existing as any).length > 0) {
      response.error = true;
      response.message = "Ya existe el ejercicio.";
      return res.status(400).json(response);
    }

    // Obtener URLs de S3 si se subieron archivos
    let video_url = null;
    let thumbnail_url = null;
    if (files && files['video'] && files['video'][0]) {
      video_url = files['video'][0].location;
    }
    if (files && files['thumbnail'] && files['thumbnail'][0]) {
      thumbnail_url = files['thumbnail'][0].location;
    }

    // Insert dinámico
    let query = "INSERT INTO exercises (category, exercise, description";
    const values: any[] = [category.toUpperCase(), exercise, description];

    let at_home_value = null;
    if (at_home !== undefined && at_home !== null) {
      at_home_value = at_home ? 1 : 0;
      query += ", at_home";
      values.push(at_home_value);
    }
    if (video_url) {
      query += ", video_url";
      values.push(video_url);
    }
    if (thumbnail_url) {
      query += ", thumbnail_url";
      values.push(thumbnail_url);
    }

    query += ") VALUES (?, ?, ?";
    if (at_home_value !== null) query += ", ?";
    if (video_url) query += ", ?";
    if (thumbnail_url) query += ", ?";
    query += ")";

    const [result]: any = await pool.query(query, values);

    if (result) {
      // Consulta el ejercicio creado para obtener todos los campos, incluyendo at_home
      const [newExercise]: any = await pool.execute(
        "SELECT id, category, exercise, description, at_home, video_url, thumbnail_url FROM exercises WHERE id = ?",
        [result.insertId]
      );
      const createdExercise = newExercise[0] || {};
      // Mapea at_home a boolean o null
      createdExercise.at_home = createdExercise.at_home === null ? null : Boolean(createdExercise.at_home);

      response.message = "Ejercicio creado exitosamente";
      return res.status(201).json({
        exercise: createdExercise,
      });
    } else {
      response.error = true;
      response.message = "No se pudo guardar.";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al crear:", error);
    next(error);
    return res.status(500).json({ message: "Error interno." });
  }
};

// Update con uploads integrados (sobrescribe si se suben nuevos archivos)
export const updateExercise = async (req: Request, res: Response, next: NextFunction) => {
  const exerciseId = req.params.id; // De la ruta, ej: /api/exercises/59
  const { new_category, new_exercise, new_description, new_at_home, new_video_url: bodyVideoUrl, new_thumbnail_url: bodyThumbnailUrl } = req.body; // Campos de texto opcionales
  const files = req.files as { [fieldname: string]: Express.MulterS3.File[] } | undefined;

  const response = { message: "", error: false };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    // Validación DTO (todo opcional ahora)
    const { error: dtoError } = updateExerciseDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    // Validación manual para exerciseId
    if (!exerciseId || isNaN(Number(exerciseId))) {
      response.error = true;
      response.message = "exerciseId inválido o faltante en la ruta.";
      return res.status(400).json(response);
    }

    // Obtener actuales para eliminar viejos si se suben nuevos o se proporcionan URLs en body
    const [current] = await pool.execute(
      "SELECT video_url, thumbnail_url FROM exercises WHERE id = ?",
      [exerciseId]
    );
    const currentData = (current as any[])[0] || {};

    // URLs nuevas: prioriza files, luego body (si soportas URLs en body)
    let new_video_url = undefined; // undefined significa no cambiar
    let new_thumbnail_url = undefined;

    if (files && files['video'] && files['video'][0]) {
      new_video_url = files['video'][0].location;
      // Eliminar viejo de S3 si existe
      if (currentData.video_url) {
        const oldKey = currentData.video_url.split('/').slice(3).join('/');
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Key: oldKey }));
      }
    } else if (bodyVideoUrl) {
      new_video_url = bodyVideoUrl; // Usa URL de body si no hay file
    }

    if (files && files['thumbnail'] && files['thumbnail'][0]) {
      new_thumbnail_url = files['thumbnail'][0].location;
      if (currentData.thumbnail_url) {
        const oldKey = currentData.thumbnail_url.split('/').slice(3).join('/');
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Key: oldKey }));
      }
    } else if (bodyThumbnailUrl) {
      new_thumbnail_url = bodyThumbnailUrl; // Usa URL de body si no hay file
    }

    // Construir update
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (new_description) {
      updateFields.push("description = ?");
      updateValues.push(new_description);
    }
    if (new_category) {
      updateFields.push("category = ?");
      updateValues.push(new_category.toUpperCase());
    }
    if (new_exercise) {
      updateFields.push("exercise = ?");
      updateValues.push(new_exercise);
    }
    if (new_at_home !== undefined) {
      updateFields.push("at_home = ?");
      updateValues.push(new_at_home === null ? null : (new_at_home ? 1 : 0)); // Maneja null o 1/0
    }
    if (new_video_url !== undefined) {
      updateFields.push("video_url = ?");
      updateValues.push(new_video_url);
    }
    if (new_thumbnail_url !== undefined) {
      updateFields.push("thumbnail_url = ?");
      updateValues.push(new_thumbnail_url);
    }

    // Verifica si hay al menos un cambio (incluyendo files o body URLs)
    if (updateFields.length === 0) {
      response.error = true;
      response.message = "No hay cambios para actualizar.";
      return res.status(400).json(response);
    }

    const query = `UPDATE exercises SET ${updateFields.join(", ")} WHERE id = ?`;
    updateValues.push(exerciseId);

    const [result]: any = await pool.query(query, updateValues);

    if (result.affectedRows > 0) {
      response.message = "Actualizado exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No encontrado.";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al actualizar:", error);
    next(error);
    return res.status(500).json({ message: "Error interno." });
  }
};

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

export const getExercisesByCategory = async (req: Request, res: Response, next: NextFunction) => {
  const { category } = req.query; // Asumimos que la categoría viene como query param, ej. ?category=PECHO

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId; // Mantenemos auth

  const response = { message: "", error: false, data: [] as Exercise[] };

  try {
    if (!category) {
      response.error = true;
      response.message = "Falta el parámetro requerido: category.";
      return res.status(400).json(response);
    }

    // Validación con DTO si aplica
    const { error: dtoError } = getExerciseDto.validate(req.query);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    const [rows] = await pool.execute(
      "SELECT id, category, exercise, description, video_url, thumbnail_url FROM exercises WHERE category = ? ORDER BY exercise ASC",
      [category.toString().toUpperCase()]
    );

    const exerciseRows = rows as Array<{
      id: number;
      category: string;
      exercise: string;
      description: string;
      video_url?: string;
      thumbnail_url?: string;
    }>;

    if (exerciseRows.length > 0) {
      response.data = adapterExercises(exerciseRows);
      response.message = `Ejercicios de la categoría ${category} obtenidos exitosamente`;
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = `No se encontraron ejercicios en la categoría ${category}`;
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener los ejercicios por categoría:", error);
    next(error);
    return res.status(500).json({ message: "Error al obtener los ejercicios por categoría." });
  }
};
// Eliminar un ejercicio por ID (cambiamos a usar exerciseId en body)
export const deleteExercise = async (req: Request, res: Response, next: NextFunction) => {
  const { exerciseId } = req.body;

  const { headers } = req;
  const token = headers["x-access-token"];
  const decode = token && verify(`${token}`, SECRET);
  const userId = (<any>(<unknown>decode)).userId; // Mantenemos auth

  const response = { message: "", error: false };

  try {
    // Validación con DTO (asumiendo actualización para exerciseId)
    const { error: dtoError } = deleteExerciseDto.validate(req.body);
    if (dtoError) {
      response.error = true;
      response.message = dtoError.details[0].message;
      return res.status(400).json(response);
    }

    if (!exerciseId) {
      response.error = true;
      response.message = "Falta el campo requerido: exerciseId.";
      return res.status(400).json(response);
    }

    const [result] = await pool.execute(
      "DELETE FROM exercises WHERE id = ?",
      [exerciseId]
    );

    const deleteResult = result as import('mysql2').ResultSetHeader;

    if (deleteResult && deleteResult.affectedRows > 0) {
      response.message = "Ejercicio eliminado exitosamente";
      return res.status(200).json(response);
    } else {
      response.error = true;
      response.message = "No se pudo eliminar el ejercicio";
      return res.status(400).json(response);
    }
  } catch (error) {
    console.error("Error al eliminar el ejercicio:", error);
    next(error);
    return res.status(500).json({ message: "Error al eliminar el ejercicio." });
  }
};