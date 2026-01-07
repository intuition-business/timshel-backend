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
    key: (req: any, file, cb) => {
        // Carpeta temporal/neutra: todos los archivos van aquí inicialmente
        // El nombre es único, por lo que no hay riesgo de colisión
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `chat-media/${uniqueSuffix}${ext}`);
    },
});

export const uploadChatMedia = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
    fileFilter: (req: any, file, cb) => {
        const allowedMimes = [
            "image/jpeg", "image/png", "image/gif", "image/webp",
            "video/mp4", "video/quicktime", "video/webm", "video/3gpp",
            "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg",
            "audio/webm", "audio/wav", "audio/amr", "audio/3gpp"
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
        }
    },
}).single("file"); // ← ¡Importante: usar .single("file")

export const deleteFromS3 = async (url?: string) => {
    if (!url) return;
    try {
        const Key = new URL(url).pathname.slice(1);
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Key }));
    } catch (err) {
        console.warn("No se pudo eliminar archivo antiguo de S3:", err);
    }
};