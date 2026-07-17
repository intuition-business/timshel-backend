import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import { minioS3, MINIO_BUCKET, deleteFromMinio } from "../services/minioClient";

const storage = multerS3({
    s3: minioS3,
    bucket: MINIO_BUCKET,
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
        if (file.fieldname === "image" && file.mimetype.startsWith("image/")) return cb(null, true);
        if (file.fieldname === "certifications" && (file.mimetype === "application/pdf" || file.mimetype.startsWith("image/"))) return cb(null, true);
        cb(null, false);
    },
    limits: { fileSize: 20 * 1024 * 1024 },
});

export const deleteFromS3 = deleteFromMinio;
