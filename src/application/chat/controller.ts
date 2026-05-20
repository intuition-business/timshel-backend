import { Request, Response, NextFunction } from "express";
import { getChatPreviewWithUser, refreshBlockStatus } from "../../socket/socket";
import pool from "../../config/db";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { promises as fs } from "fs";
import { deleteFromS3, uploadToS3, generateThumbnail, generateImageThumbnail, tempDir } from "../../middleware/uploadChatMedia"; // Importa las funciones

const safeUnlink = async (targetPath: string, retries = 3, delayMs = 150) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await fs.unlink(targetPath);
            return;
        } catch (error: any) {
            const isLastAttempt = attempt === retries;
            const isRetryable = error?.code === "EPERM" || error?.code === "EBUSY";

            if (!isRetryable || isLastAttempt) {
                console.warn(`No se pudo eliminar temporal ${targetPath}:`, error?.message || error);
                return;
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
};

export const getChatWithUserController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<Response<any>> => {
    try {
        const userId = String((req as any).userId);
        const { receiverId } = req.params;

        if (!receiverId) {
            return res.status(400).json({ error: true, message: "receiverId es requerido" });
        }

        const preview = await getChatPreviewWithUser(userId, receiverId);

        if (!preview) {
            return res.status(404).json({ error: true, message: "No hay conversación con este usuario" });
        }

        return res.status(200).json({ error: false, data: preview });
    } catch (error) {
        console.error("Error al obtener chat:", error);
        next(error);
        return res.status(500).json({ message: "Error interno del servidor" });
    }
};

export const blockUserController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<Response<any>> => {
    try {
        const userId = String((req as any).userId);
        const { userId: targetId } = req.params;

        if (!targetId || userId === targetId) {
            return res.status(400).json({ error: true, message: "ID de usuario inválido" });
        }

        await pool.execute(
            `INSERT IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)`,
            [userId, targetId]
        );

        refreshBlockStatus(userId, targetId).catch(() => {});

        return res.status(200).json({ error: false, message: "Usuario bloqueado" });
    } catch (error) {
        next(error);
        return res.status(500).json({ error: true, message: "Error interno del servidor" });
    }
};

export const unblockUserController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<Response<any>> => {
    try {
        const userId = String((req as any).userId);
        const { userId: targetId } = req.params;

        if (!targetId || userId === targetId) {
            return res.status(400).json({ error: true, message: "ID de usuario inválido" });
        }

        await pool.execute(
            `DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?`,
            [userId, targetId]
        );

        refreshBlockStatus(userId, targetId).catch(() => {});

        return res.status(200).json({ error: false, message: "Usuario desbloqueado" });
    } catch (error) {
        next(error);
        return res.status(500).json({ error: true, message: "Error interno del servidor" });
    }
};

export const getBlockedUsersController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<Response<any>> => {
    try {
        const userId = String((req as any).userId);

        const [rows]: any = await pool.execute(
            `SELECT bu.blocked_id AS userId, COALESCE(f.name, e.name, 'Usuario') AS name,
                    ui.image_path AS image
             FROM blocked_users bu
             LEFT JOIN formulario f ON f.usuario_id = bu.blocked_id
             LEFT JOIN entrenadores e ON e.id = bu.blocked_id
             LEFT JOIN user_images ui ON ui.user_id = bu.blocked_id
               AND ui.created_at = (SELECT MAX(created_at) FROM user_images WHERE user_id = bu.blocked_id)
             WHERE bu.blocker_id = ?`,
            [userId]
        );

        return res.status(200).json({ error: false, data: rows });
    } catch (error) {
        next(error);
        return res.status(500).json({ error: true, message: "Error interno del servidor" });
    }
};

export const getChatMediaController = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<Response<any>> => {
    try {
        const userId = String((req as any).userId);
        const { receiverId } = req.params;
        const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
        const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));
        const offset = (page - 1) * limit;

        if (!receiverId) {
            return res.status(400).json({ error: true, message: "receiverId es requerido" });
        }

        const params = [userId, receiverId, receiverId, userId, userId, receiverId];

        const baseWhere = `
            WHERE ((m.user_id_sender = ? AND m.user_id_receiver = ?)
                OR (m.user_id_sender = ? AND m.user_id_receiver = ?))
            AND m.created_at > COALESCE(
                (SELECT deleted_at FROM chat_deletions WHERE user_id = ? AND other_user_id = ?),
                '1970-01-01'
            )
            AND (m.files LIKE '%"image"%' OR m.files LIKE '%"video"%')
            AND m.files != '[]'`;

        const [[countRow]]: any = await pool.query(
            `SELECT COUNT(*) AS total FROM messages m ${baseWhere}`,
            params
        );
        const total = countRow.total;

        const [rows]: any = await pool.query(
            `SELECT m.id, m.created_at, m.files
             FROM messages m
             ${baseWhere}
             ORDER BY m.created_at DESC
             LIMIT ${limit} OFFSET ${offset}`,
            params
        );

        const data = rows.map((row: any) => {
            const files: { file_url: string; file_type: string }[] =
                typeof row.files === "string" ? JSON.parse(row.files) : (row.files || []);
            return {
                message_id: row.id,
                created_at: row.created_at,
                files: files.filter((f) => f.file_type === "image" || f.file_type === "video"),
            };
        });

        return res.status(200).json({
            error: false,
            data,
            pagination: {
                page,
                limit,
                total,
                total_pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("[chat-media] error:", error);
        next(error);
        return res.status(500).json({ error: true, message: "Error interno del servidor" });
    }
};

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
        const isAudio = req.file.mimetype.startsWith("audio/");
        const isVideo = !isAudio && req.file.mimetype.startsWith("video/");
        const isImage = req.file.mimetype.startsWith("image/");
        let mediaUrl: string;
        let thumbnailUrl: string | null = null;

        // Key para el archivo principal
        const mediaKey = `chat-media/${uuidv4()}${path.extname(req.file.originalname)}`;

        // Subir archivo principal
        mediaUrl = await uploadToS3(filePath, mediaKey, req.file.mimetype);

        // Generar y subir thumbnail para videos e imágenes
        if (isVideo) {
            const thumbnailKey = `chat-media/${uuidv4()}-thumb.jpg`;
            const thumbnailPath = path.join(tempDir, path.basename(thumbnailKey));

            await generateThumbnail(filePath, thumbnailPath);
            thumbnailUrl = await uploadToS3(thumbnailPath, thumbnailKey, "image/jpeg");

            // Limpiar thumbnail temporal
            await safeUnlink(thumbnailPath);
        } else if (isImage) {
            const thumbnailKey = `chat-media/${uuidv4()}-thumb.jpg`;
            const thumbnailPath = path.join(tempDir, path.basename(thumbnailKey));

            await generateImageThumbnail(filePath, thumbnailPath);
            thumbnailUrl = await uploadToS3(thumbnailPath, thumbnailKey, "image/jpeg");

            // Limpiar thumbnail temporal
            await safeUnlink(thumbnailPath);
        }

        // Aquí puedes persistir en DB y emitir evento por socket
        // Ejemplo: io.to(roomId).emit('new_media', { mediaUrl, thumbnailUrl, mimetype: req.file.mimetype });

        // Limpiar archivo original temporal
        await safeUnlink(filePath);

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