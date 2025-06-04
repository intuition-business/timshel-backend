import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import multer from "multer";
import path from "path";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

// Cargar variables de entorno de AWS
dotenv.config();

// Configuración de AWS S3
const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  endpoint: "https://s3.us-east-2.amazonaws.com",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Configuración de multer para subir archivos a S3
const storage = multerS3({
  s3: s3,
  bucket: process.env.AWS_BUCKET_NAME!,
  metadata: function (req, file, cb) {
    cb(null, { fieldName: file.fieldname });
  },
  key: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `user-images/${uniqueSuffix}${ext}`);
  },
});


export const upload = multer({ storage });

// Controlador para guardar la imagen vinculada a un usuario
export const uploadUserImage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const response: { message: string; error: boolean; imageUrl: string | null } = {
    message: "",
    error: false,
    imageUrl: null,
  };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    if (!req.file) {
      response.error = true;
      response.message = "No se subió ningún archivo";
      return res.status(400).json(response);
    }

    // URL de la imagen almacenada en S3
    const imageUrl = (req.file as any).location;

    // Verificar si ya existe una imagen para este usuario
    const [rows] = await pool.execute(
      "SELECT * FROM user_images WHERE user_id = ?",
      [userId]
    );

    if ((rows as any[]).length > 0) {
      // Si existe una imagen, actualizarla
      await pool.execute(
        "UPDATE user_images SET image_path = ? WHERE user_id = ?",
        [imageUrl, userId]
      );
      response.message = "Imagen actualizada exitosamente";
    } else {
      // Si no existe, crear un nuevo registro
      await pool.execute(
        "INSERT INTO user_images (user_id, image_path) VALUES (?, ?)",
        [userId, imageUrl]
      );
      response.message = "Imagen subida exitosamente";
    }

    response.imageUrl = imageUrl;
    res.status(201).json(response);
  } catch (error) {
    console.error("Error al subir imagen:", error);
    next(error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

export const getUserImage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<Response<any>> => {
  const response = {
    message: "",
    error: false,
    imageUrl: null,
  };

  try {
    const { headers } = req;
    const token = headers["x-access-token"];
    const decode = token && verify(`${token}`, SECRET);
    const userId = (<any>(<unknown>decode)).userId;

    // Validación del userId
    if (!userId) {
      response.error = true;
      response.message = "ID de usuario no proporcionado";
      return res.status(400).json(response);
    }

    // Buscar la imagen del usuario en la base de datos
    const [rows] = await pool.execute(
      "SELECT image_path FROM user_images WHERE user_id = ?",
      [userId]
    );

    if ((rows as any[]).length > 0) {
      // Si se encuentra una imagen, devolverla
      const imageUrl = (rows as any[])[0].image_path;
      response.imageUrl = imageUrl;
      return res.status(200).json(response);
    } else {
      // Si no se encuentra la imagen, enviar un mensaje de error
      response.error = true;
      response.message = "No se encontró una imagen asociada a este usuario";
      return res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error al obtener la imagen del usuario:", error);
    next(error);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};