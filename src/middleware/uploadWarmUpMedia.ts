// src/middlewares/uploadWarmUpMedia.ts
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
        const ext = path.extname(file.originalname);
        const folder = file.fieldname === "thumbnail" ? "warmup-thumbnails" : "warmup-videos";
        cb(null, `${folder}/${uniqueSuffix}${ext}`);
    },
});

export const uploadWarmUpMedia = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.fieldname === "video" && file.mimetype.startsWith("video/")) return cb(null, true);
        if (file.fieldname === "thumbnail" && file.mimetype.startsWith("image/")) return cb(null, true);
        cb(null, false);
    },
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// Función auxiliar segura para eliminar de S3
export const deleteFromS3 = async (url?: string) => {
    if (!url) return;
    try {
        const Key = new URL(url).pathname.slice(1);
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Key }));
    } catch (err) {
        console.warn("No se pudo eliminar archivo antiguo de S3:", err);
    }
};