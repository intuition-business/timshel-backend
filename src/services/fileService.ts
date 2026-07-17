import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import { minioS3, MINIO_BUCKET } from "./minioClient";

const allowedMimes = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const storage = multerS3({
    s3: minioS3,
    bucket: MINIO_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
    key: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `user-files/${uniqueSuffix}${ext}`);
    },
});

const fileFilter = (req: any, file: any, cb: any) => {
    if (allowedMimes.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Tipo de archivo no permitido"), false);
};

export const upload = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });
