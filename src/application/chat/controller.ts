import { Request, Response, NextFunction } from "express";
import { verify, JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { SECRET } from "../../config";

export const uploadChatMediaController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Autenticación
        const token = req.headers["x-access-token"] as string;
        if (!token) return res.status(401).json({ error: true, message: "Token requerido" });

        let decoded;
        try {
            decoded = verify(token, SECRET) as { userId: string };
        } catch (jwtError) {
            if (jwtError instanceof TokenExpiredError) {
                return res.status(401).json({ error: true, message: "Token expirado" });
            }
            if (jwtError instanceof JsonWebTokenError) {
                return res.status(401).json({ error: true, message: "Token inválido" });
            }
            throw jwtError;
        }

        const userId = decoded.userId;

        // Archivo individual
        const file = req.file as Express.MulterS3.File | undefined;
        if (!file) {
            return res.status(400).json({ error: true, message: "No se subió ningún archivo" });
        }

        const file_type = req.body.file_type as "image" | "video" | "audio";
        // El middleware ya valida, pero por seguridad redundante:
        if (!["image", "video", "audio"].includes(file_type)) {
            return res.status(400).json({ error: true, message: "file_type inválido" });
        }

        return res.status(200).json({
            error: false,
            message: "Archivo subido con éxito",
            file_url: file.location,
            file_type: file_type,
        });
    } catch (error) {
        console.error("Error al subir archivo del chat:", error);
        next(error);
    }
};