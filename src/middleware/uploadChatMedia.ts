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



export const uploadChatMedia = async (req: any, res: any, next: any) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: true,
                message: "No se ha subido ningún archivo",
            });
        }

        // Ahora req.body.file_type está garantizado disponible
        const file_type = req.body.file_type as "image" | "video" | "audio" | undefined;

        const validTypes = ["image", "video", "audio"];
        if (!file_type || !validTypes.includes(file_type)) {
            // Opcional: eliminar el archivo ya subido a S3 si la validación falla
            await deleteFromS3(req.file.location);
            return res.status(400).json({
                error: true,
                message: "file_type inválido. Debe ser image, video o audio",
            });
        }

        // Validar coincidencia entre MIME y file_type
        const mimePrefix = req.file.mimetype.split("/")[0];
        const expectedPrefix = file_type;  // "image", "video" o "audio"

        if (mimePrefix !== expectedPrefix) {
            await deleteFromS3(req.file.location);
            return res.status(400).json({
                error: true,
                message: "El MIME type del archivo no coincide con file_type",
            });
        }

        // Si todo está bien, responder con la URL
        res.status(200).json({
            error: false,
            message: "Archivo subido con éxito",
            file_url: req.file.location,
            file_type: file_type,
        });

    } catch (error) {
        next(error);
    }
};

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