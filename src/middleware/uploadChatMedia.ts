import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { promises as fs } from "fs";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { createReadStream } from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

ffmpeg.setFfprobePath(ffprobeInstaller.path);
// Configurar FFmpeg (una vez en la aplicación, puedes moverlo a un archivo de inicialización)
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const s3 = new S3Client({
    region: process.env.AWS_REGION || "us-east-2",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});

// Carpeta temporal (crearla si no existe)
export const tempDir = path.join(__dirname, "../../temp"); // Ajusta la ruta según tu estructura

// Almacenamiento en disco temporal
const storage = multer.diskStorage({
    destination: tempDir,
    filename: (req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${ext}`);
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

        const allowedExtensions = [
            ".jpg", ".jpeg", ".png", ".gif", ".webp",
            ".mp4", ".mov", ".webm", ".3gp", ".3gpp",
            ".mp3", ".m4a", ".aac", ".ogg", ".wav", ".amr"
        ];

        if (allowedMimes.includes(file.mimetype)) {
            return cb(null, true);
        }

        if (file.mimetype === "application/octet-stream") {
            const ext = path.extname(file.originalname).toLowerCase();
            if (allowedExtensions.includes(ext)) {
                return cb(null, true);
            }
        }

        cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
    },
}).single("file");

// Función auxiliar para subir a S3
export async function uploadToS3(filePath: string, key: string, contentType: string): Promise<string> {
    const fileStream = createReadStream(filePath);
    await s3.send(new PutObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME!,
        Key: key,
        Body: fileStream,
        ContentType: contentType,

    }));
    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

// Generar thumbnail (solo para videos)
export async function generateThumbnail(videoPath: string, outputPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
            .screenshots({
                count: 1,
                timemarks: ["10%"], // Frame al 10% del video para evitar iniciales negros
                filename: path.basename(outputPath),
                folder: path.dirname(outputPath),
                size: "640x360", // Ajusta resolución; usa "640x?" para mantener aspecto
            })
            .on("end", () => resolve()) // ← Arrow function sin parámetros para ignorar stdout/stderr
            .on("error", (err) => reject(err)); // ← Mantiene el manejo de errores
    });
}
// Initialize temp directory
(async () => {
    await fs.mkdir(tempDir, { recursive: true });
})();
// Exportamos para usar en controlador si es necesario
export const deleteFromS3 = async (url?: string) => {
    if (!url) return;
    try {
        const Key = new URL(url).pathname.slice(1);
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Key }));
    } catch (err) {
        console.warn("No se pudo eliminar archivo de S3:", err);
    }
};