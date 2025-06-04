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
  endpoint: "https://s3.us-east-2.amazonaws.com",  // Especificar el endpoint de la región
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

// Usamos la configuración de multerS3 en lugar de almacenamiento local
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
    // Verificar token y obtener userId
    const token = req.headers["x-access-token"];
    if (!token) {
      response.error = true;
      response.message = "Token no proporcionado";
      return res.status(401).json(response);
    }
    const decoded = verify(token as string, SECRET) as any;
    const userId = decoded.userId;

    if (!req.file) {
      response.error = true;
      response.message = "No se subió ningún archivo";
      return res.status(400).json(response);
    }

    // URL de la imagen almacenada en S3
    const imageUrl = (req.file as any).location; // La URL pública de S3

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
