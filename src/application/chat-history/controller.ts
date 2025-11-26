// src/application/chat/controller.ts
import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterConversations, adapterMessages } from "./adapter";
import { getConversationsDto, getMessagesDto } from "./dto";

export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers["x-access-token"] as string;
    const decoded = verify(token, SECRET) as { userId: string };
    const myId = Number(decoded.userId);

    const { error, value } = getConversationsDto.validate(req.query);
    if (error) return res.status(400).json({ error: true, message: error.details[0].message });

    const limit = value.limit;
    const offset = (value.page - 1) * limit;

    const query = `
      SELECT 
        u.id AS user_id,
        u.name,
        u.telefono,
        ui.image_path,
        lm.message AS last_message,
        lm.created_at AS last_message_time,
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
      LEFT JOIN LATERAL (
        SELECT message, created_at 
        FROM messages 
        WHERE (user_id_sender = ? AND user_id_receiver = u.id) 
           OR (user_id_sender = u.id AND user_id_receiver = ?)
        ORDER BY created_at DESC 
        LIMIT 1
      ) lm ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS unseen_count
        FROM messages 
        WHERE user_id_receiver = ? 
          AND user_id_sender = u.id 
          AND seen = 0
      ) unseen ON TRUE
      ORDER BY lm.created_at DESC NULLS LAST, u.id DESC
      LIMIT ? OFFSET ?
    `;

    const params = [
      myId, myId, myId, // DISTINCT
      myId, myId,       // last message
      myId,             // unseen count
      limit, offset
    ];

    const [rows]: any = await pool.execute(query, params);

    res.json({
      error: false,
      message: "Conversaciones obtenidas",
      data: adapterConversations(rows)
    });
  } catch (err: any) {
    console.error("Error en getConversations:", err);
    next(err);
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