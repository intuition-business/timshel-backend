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
    limits: { fileSize: 100 * 1024 * 1024 },
});

export const deleteFromS3 = deleteFromMinio;
