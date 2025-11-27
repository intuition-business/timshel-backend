// src/application/chat/controller.ts (o chat-history/controller.ts)

import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterConversations, adapterMessages } from "./adapter";
import { getConversationsDto, getMessagesDto } from "./dto";

export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Verificar token
    const token = req.headers["x-access-token"] as string;
    if (!token) {
      return res.status(401).json({ error: true, message: "Token no proporcionado" });
    }

    const decoded = verify(token, SECRET) as { userId: string };
    const myId = Number(decoded.userId);

    if (isNaN(myId) || myId <= 0) {
      return res.status(401).json({ error: true, message: "Token inválido" });
    }

    // 2. Validar query params con Joi + valores por defecto
    const { error, value } = getConversationsDto.validate(req.query, {
      abortEarly: false,
      convert: true,        // convierte strings a números automáticamente
    });

    if (error) {
      return res.status(400).json({
        error: true,
        message: error.details[0].message,
      });
    }

    // 3. Parámetros de paginación con valores seguros (NUNCA undefined ni NaN)
    const limit = value.limit ? Number(value.limit) : 20;
    const page = value.page ? Number(value.page) : 1;

    // Protección extra (opcional pero recomendada)
    if (limit < 1 || limit > 100) {
      return res.status(400).json({ error: true, message: "Limit debe estar entre 1 y 100" });
    }
    if (page < 1) {
      return res.status(400).json({ error: true, message: "Page debe ser mayor a 0" });
    }

    const offset = (page - 1) * limit;

    // 4. Consulta SQL (perfectamente segura)
    const query = `
      SELECT 
        u.id AS user_id,
        u.name,
        u.telefono,
        ui.image_path,
        m.message AS last_message,
        m.created_at AS last_message_time,
        COALESCE(unseen.unseen_count, 0) AS unseen_count
      FROM (
        SELECT DISTINCT 
          CASE WHEN user_id_sender = ? THEN user_id_receiver ELSE user_id_sender END AS other_user_id
        FROM messages 
        WHERE user_id_sender = ? OR user_id_receiver = ?
      ) conv
      JOIN auth u ON u.id = conv.other_user_id
      LEFT JOIN user_images ui ON ui.user_id = u.id 
        AND ui.created_at = (SELECT MAX(created_at) FROM user_images WHERE user_id = u.id)
      LEFT JOIN messages m ON m.id = (
        SELECT id FROM messages 
        WHERE (user_id_sender = ? AND user_id_receiver = u.id) 
          OR (user_id_sender = u.id AND user_id_receiver = ?)
        ORDER BY created_at DESC, id DESC 
        LIMIT 1
      )
      LEFT JOIN (
        SELECT user_id_sender, COUNT(*) AS unseen_count
        FROM messages 
        WHERE user_id_receiver = ? AND seen = 0
        GROUP BY user_id_sender
      ) unseen ON unseen.user_id_sender = u.id
      ORDER BY 
        m.created_at IS NULL ASC,    -- NULLs al final
        m.created_at DESC,           -- más reciente arriba
        u.id DESC
      LIMIT ? OFFSET ?
    `;

    const params = [
      myId, myId, myId, myId,     // para el subquery de conversaciones
      myId, myId,             // para último mensaje
      myId,                   // para mensajes no leídos
      limit,
      offset
    ];

    // DEBUG opcional (quítalo en producción si quieres)
    // console.log("Executing getConversations → myId:", myId, "limit:", limit, "offset:", offset);

    const [rows] = await pool.execute(query, params) as any;

    // 5. Respuesta exitosa
    return res.json({
      error: false,
      message: "Conversaciones obtenidas correctamente",
      data: adapterConversations(rows),
      pagination: {
        page,
        limit,
        hasMore: rows.length === limit // si trajo exactamente el limit, probablemente hay más
      }
    });

  } catch (err: any) {
    console.error("Error en getConversations:", err);
    return next(err);
  }
};

export const getMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers["x-access-token"] as string;
    const decoded = verify(token, SECRET) as { userId: string };
    const myId = Number(decoded.userId);

    const { error, value } = getMessagesDto.validate(req.query);
    if (error) return res.status(400).json({ error: true, message: error.details[0].message });

    const { receiverId, limit, page } = value;
    const offset = (page - 1) * limit;

    const [rows]: any = await pool.execute(`
      SELECT * FROM messages 
      WHERE (user_id_sender = ? AND user_id_receiver = ?) 
         OR (user_id_sender = ? AND user_id_receiver = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [myId, receiverId, receiverId, myId, limit, offset]);

    // reverse() para que el más antiguo quede primero (orden cronológico)
    res.json({
      error: false,
      message: "Mensajes obtenidos",
      data: adapterMessages(rows.reverse())
    });
  } catch (err: any) {
    console.error("Error en getMessages:", err);
    next(err);
  }
};