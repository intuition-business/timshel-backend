import { Request, Response, NextFunction } from "express";
import { deleteFromS3 } from "../../middleware/uploadChatMedia";

export const uploadChatMediaController = async (
    req: Request & { userId?: string },
    res: Response,
    next: NextFunction
) => {
    try {

        const file = req.file as Express.MulterS3.File | undefined;
        if (!file) {
            return res.status(400).json({
                error: true,
                message: "No se ha subido ningún archivo",
            });
        }

        const file_type = req.body.file_type as "image" | "video" | "audio" | undefined;

        const validTypes = ["image", "video", "audio"];
        if (!file_type || !validTypes.includes(file_type)) {
            await deleteFromS3(file.location);
            return res.status(400).json({
                error: true,
                message: "file_type inválido. Debe ser image, video o audio",
            });
        }

        // Validación clave: coincidencia MIME con file_type
        const mimePrefix = file.mimetype.split("/")[0];
        if (mimePrefix !== file_type) {
            await deleteFromS3(file.location);
            return res.status(400).json({
                error: true,
                message: "El MIME type del archivo no coincide con file_type",
            });
        }

        // Éxito
        res.status(200).json({
            error: false,
            message: "Archivo subido con éxito",
            file_url: file.location,
            file_type: file_type,
        });
    } catch (error) {
        const s3File = req.file as Express.MulterS3.File | undefined;
        if (s3File?.location) await deleteFromS3(s3File.location);
        console.error("Error en uploadChatMediaController:", error);
        next(error);
    }
};