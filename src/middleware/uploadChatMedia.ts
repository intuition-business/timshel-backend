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
        const folder = file.mimetype.startsWith("image/") ? "chat-images" : "chat-videos";
        cb(null, `${folder}/${uniqueSuffix}${ext}`);
    },
});

export const uploadChatMedia = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
            return cb(null, true);
        }
        cb(null, false);
    },
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB por archivo
}).array("files", 10); // Acepta hasta 10 archivos en 'files'

// Función auxiliar segura para eliminar de S3 (igual a la tuya)
export const deleteFromS3 = async (url?: string) => {
    if (!url) return;
    try {
        const Key = new URL(url).pathname.slice(1);
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Key }));
    } catch (err) {
        console.warn("No se pudo eliminar archivo antiguo de S3:", err);
    }
};