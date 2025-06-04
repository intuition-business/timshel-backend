import multer from "multer";
import multerS3 from "multer-s3";
import { S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import path from "path";

// Cargar las variables de entorno
dotenv.config();

// Configuración de S3
const s3 = new S3Client({
    region: process.env.AWS_REGION || "us-east-2",
    endpoint: "https://s3.us-east-2.amazonaws.com",
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
});


const allowedMimes = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// Configuración de multer para S3
const storage = multerS3({
    s3: s3,
    bucket: process.env.AWS_BUCKET_NAME!,
    metadata: function (req, file, cb) {
        cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `user-files/${uniqueSuffix}${ext}`);
    },
});

// Validación de tipo de archivo permitido
const fileFilter = (req: any, file: any, cb: any) => {
    if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Tipo de archivo no permitido"), false);
    }
};

// Usar multer para cargar el archivo
export const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 },
});
