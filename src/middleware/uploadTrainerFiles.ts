// src/middlewares/uploadTrainerFiles.ts
import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
    region: process.env.AWS_REGION || "us-east-2",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

const storage = multerS3({
    s3,
    bucket: process.env.AWS_BUCKET_NAME!,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname).toLowerCase();

        let folder = "trainers";
        if (file.fieldname === "image") folder += "/profiles";
        if (file.fieldname === "certifications") folder += "/certifications";

        cb(null, `${folder}/${uniqueSuffix}${ext}`);
    },
});

export const uploadTrainerFiles = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.fieldname === "image") {
            if (file.mimetype.startsWith("image/")) return cb(null, true);
        }
        if (file.fieldname === "certifications") {
            // Acepta PDF o imágenes para certificados
            if (file.mimetype === "application/pdf" || file.mimetype.startsWith("image/")) {
                return cb(null, true);
            }
        }
        cb(null, false); // Rechaza otros tipos
    },
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB por archivo (ajusta según necesites)
});

// Reutilizamos la función de borrado que ya tienes
export { deleteFromS3 } from "./uploadWarmUpMedia"; // o cópiala aquí si prefieres