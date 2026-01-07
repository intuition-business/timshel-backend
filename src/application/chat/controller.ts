import { Request, Response, NextFunction } from "express";
import { deleteFromS3 } from "../../middleware/uploadChatMedia";

export const uploadChatMediaController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: true,
                message: "No se ha subido ningún archivo",
            });
        }

        // No se valida file_type → se acepta cualquier archivo permitido por el fileFilter
        res.status(200).json({
            error: false,
            message: "Archivo subido con éxito",
            file_url: (req.file as any).location,
            // Opcional: devolver MIME o extensión si el frontend lo necesita
            // mimetype: req.file.mimetype,
        });
    } catch (error) {
        next(error);
    }
};
