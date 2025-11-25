import { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config"; // Ajusta la ruta si es diferente

// Ruta sugerida: POST /chat/upload-media
export const uploadChatMediaController = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        // Auth igual que en todos tus controladores
        const token = req.headers["x-access-token"] as string;
        if (!token) return res.status(401).json({ error: true, message: "Token requerido" });
        const decoded = verify(token, SECRET) as { userId: string };
        const userId = decoded.userId;
        // req.files viene del middleware uploadChatMedia
        const files = req.files as Express.MulterS3.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ error: true, message: "No se subió ningún archivo" });
        }
        const uploadedFiles = files.map((file) => ({
            file_url: file.location,
            file_type: file.mimetype.startsWith("image/") ? "image" : "video",
        }));
        return res.status(200).json({
            error: false,
            message: "Archivos subidos con éxito",
            files: uploadedFiles,
        });
    } catch (error) {
        console.error("Error al subir archivos del chat:", error);
        next(error);
    }
};