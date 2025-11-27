// src/application/chat-history/controller.ts
import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterConversations, adapterMessages } from "./adapter";
import { getConversationsDto, getMessagesDto } from "./dto";

export const getConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers["x-access-token"] as string;
    if (!token) return res.status(401).json({ error: true, message: "Token requerido" });

    const decoded = verify(token, SECRET) as { userId: string };
    const myId = Number(decoded.userId);
    if (!myId || isNaN(myId)) return res.status(401).json({ error: true, message: "Token inválido" });

    // Validación + defaults seguros
    const { error, value } = getConversationsDto.validate(req.query, { convert: true });
    if (error) return res.status(400).json({ error: true, message: error.details[0].message });

    const limit = Math.min(Math.max(Number(value.limit) || 20, 1), 100);
    const page = Math.max(Number(value.page) || 1, 1);
    const offset = (page - 1) * limit;

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
        m.created_at IS NULL ASC,
        m.created_at DESC,
        u.id DESC
      LIMIT ? OFFSET ?
    `;

    const params = [myId, myId, myId, myId, myId, myId, limit, offset];

    const [rows] = await pool.execute(query, params);

    return res.json({
      error: false,
      message: "Conversaciones obtenidas",
      data: adapterConversations(rows as any[]),
      pagination: { page, limit, hasMore: (rows as any[]).length === limit }
    });

  } catch (err) {
    console.error("Error en getConversations:", err);
    return next(err);
  }
};

export const getMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers["x-access-token"] as string;
    if (!token) return res.status(401).json({ error: true, message: "Token requerido" });

    const decoded = verify(token, SECRET) as { userId: string };
    const myId = Number(decoded.userId);
    if (!myId || isNaN(myId)) return res.status(401).json({ error: true, message: "Token inválido" });

    const { error, value } = getMessagesDto.validate(req.query, { convert: true });
    if (error) return res.status(400).json({ error: true, message: error.details[0].message });

    const receiverId = Number(value.receiverId);
    const limit = Math.min(Math.max(Number(value.limit) || 30, 1), 100);
    const page = Math.max(Number(value.page) || 1, 1);

    if (!receiverId || receiverId <= 0) {
      return res.status(400).json({ error: true, message: "receiverId inválido" });
    }

    const offset = (page - 1) * limit;

    const [rows] = await pool.execute(
      `SELECT 
         id, user_id_sender, user_id_receiver, message, files, created_at, seen, received,
         (user_id_sender = ?) AS is_mine
       FROM messages 
       WHERE (user_id_sender = ? AND user_id_receiver = ?) 
          OR (user_id_sender = ? AND user_id_receiver = ?)
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [myId, myId, receiverId, receiverId, myId, limit, offset]
    );

    // Más antiguo primero para el frontend
    const messages = (rows as any[]).reverse();

    return res.json({
      error: false,
      message: "Mensajes obtenidos",
      data: adapterMessages(messages) // removed myId parameter
    });

  } catch (err) {
    console.error("Error en getMessages:", err);
    return next(err);
  }
};