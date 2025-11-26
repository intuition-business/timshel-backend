// src/application/chat/controller.ts
import { Request, Response, NextFunction } from "express";
import pool from "../../config/db";
import { verify } from "jsonwebtoken";
import { SECRET } from "../../config";
import { adapterConversations, adapterMessages } from "./adapter";
import { getConversationsDto, getMessagesDto } from "./dto";

// src/application/chat/controller.ts → getConversations
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
        m.message AS last_message,
        m.created_at AS last_message_time,
        COUNT(CASE WHEN m.seen = 0 AND m.user_id_receiver = ? THEN 1 END) AS unseen_count
      FROM (
        SELECT DISTINCT 
          LEAST(user_id_sender, user_id_receiver) AS u1,
          GREATEST(user_id_sender, user_id_receiver) AS u2
        FROM messages 
        WHERE user_id_sender = ? OR user_id_receiver = ?
      ) conv
      CROSS JOIN auth u ON (u.id = conv.u1 OR u.id = conv.u2) AND u.id != ?
      LEFT JOIN user_images ui ON ui.user_id = u.id 
        AND ui.created_at = (SELECT MAX(created_at) FROM user_images WHERE user_id = u.id)
      LEFT JOIN messages m ON (
        (m.user_id_sender = ? AND m.user_id_receiver = u.id) OR
        (m.user_id_sender = u.id AND m.user_id_receiver = ?)
      ) AND m.id = (
        SELECT MAX(id) FROM messages 
        WHERE (user_id_sender = ? AND user_id_receiver = u.id) 
           OR (user_id_sender = u.id AND user_id_receiver = ?)
      )
      GROUP BY u.id, u.name, u.telefono, ui.image_path, m.message, m.created_at
      ORDER BY COALESCE(m.created_at, '1970-01-01 00:00:00') DESC, u.id DESC
      LIMIT ? OFFSET ?
    `;

    const params = [
      myId,  // 1. unseen_count
      myId,  // 2. WHERE sender
      myId,  // 3. WHERE receiver
      myId,  // 4. exclude self
      myId,  // 5. last message sender = myId
      myId,  // 6. last message receiver = myId
      myId,  // 7. subquery MAX(id) sender
      myId,  // 8. subquery MAX(id) receiver
      myId,  // 9. subquery MAX(id) sender (segundo bloque)
      myId,  // 10. subquery MAX(id) receiver (segundo bloque)
      limit, // 11. LIMIT
      offset // 12. OFFSET
    ];

    const [rows]: any = await pool.execute(query, params);

    res.json({
      error: false,
      message: "Conversaciones obtenidas",
      data: adapterConversations(rows)
    });
  } catch (err: any) {
    console.error("Error completo en getConversations:", err);
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