import { Request, Response, NextFunction } from "express";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { promises as fs } from "fs";
import { deleteFromS3, uploadToS3, generateThumbnail, tempDir } from "../../middleware/uploadChatMedia"; // Importa las funciones

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

        const filePath = req.file.path;
        const isVideo = req.file.mimetype.startsWith("video/");
        let mediaUrl: string;
        let thumbnailUrl: string | null = null;

        // Key para el archivo principal
        const mediaKey = `chat-media/${uuidv4()}${path.extname(req.file.originalname)}`;

        // Subir archivo principal
        mediaUrl = await uploadToS3(filePath, mediaKey, req.file.mimetype);

        // Generar y subir thumbnail solo para videos
        if (isVideo) {
            const thumbnailKey = `chat-thumbnails/${uuidv4()}.jpg`;
            const thumbnailPath = path.join(tempDir, path.basename(thumbnailKey));

            await generateThumbnail(filePath, thumbnailPath);
            thumbnailUrl = await uploadToS3(thumbnailPath, thumbnailKey, "image/jpeg");

            // Limpiar thumbnail temporal
            await fs.unlink(thumbnailPath);
        }

        // Aquí puedes persistir en DB y emitir evento por socket
        // Ejemplo: io.to(roomId).emit('new_media', { mediaUrl, thumbnailUrl, mimetype: req.file.mimetype });

        // Limpiar archivo original temporal
        await fs.unlink(filePath);

        res.status(200).json({
            error: false,
            message: "Archivo subido con éxito",
            file_url: mediaUrl,
            thumbnail_url: thumbnailUrl, // null si no es video
            mimetype: req.file.mimetype,
        });
    } catch (error) {
        console.error("Error procesando upload:", error);
        next(error);
    }
};