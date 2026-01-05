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
        const file_type = req.body.file_type as "image" | "video" | "audio" | undefined;

        let folder = "chat-unknown"; // fallback seguro
        if (file_type === "image") folder = "chat-images";
        else if (file_type === "video") folder = "chat-videos";
        else if (file_type === "audio") folder = "chat-audios";

        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `${folder}/${uniqueSuffix}${ext}`);
    },
});

export const uploadChatMedia = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req: any, file, cb) => {
        const file_type = req.body.file_type as string;

        const validTypes = ["image", "video", "audio"];
        if (!validTypes.includes(file_type)) {
            return cb(new Error("file_type inválido. Debe ser image, video o audio"));
        }

        const mimePrefix = file.mimetype.split("/")[0];
        const expectedPrefix = file_type === "audio" ? "audio" : file_type;

        if (mimePrefix !== expectedPrefix) {
            return cb(new Error("El MIME type del archivo no coincide con file_type"));
        }

        cb(null, true);
    },
}).single("file");

// Mantengo tu función de eliminación
export const deleteFromS3 = async (url?: string) => {
    if (!url) return;
    try {
        const Key = new URL(url).pathname.slice(1);
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_BUCKET_NAME!, Key }));
    } catch (err) {
        console.warn("No se pudo eliminar archivo antiguo de S3:", err);
    }
};