import { Server as SocketIOServer } from "socket.io";
import { verify } from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import pool from "../config/db";
import { SECRET } from "../config";

interface UserDetails {
    name: string;
    email: string | null;
    phone: string | null;
    image: string | null;
}

interface ChatPreview {
    receiverId: string;
    receiverName: string;
    receiverImage: string | null;
    lastMessage: string | null;
    lastMessageTime: string | null;
    unreadCount: number;
}

// Función principal para inicializar Socket.IO
export const initSocket = (httpServer: any) => {
    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.use((socket, next) => {
        const token = (socket.handshake.auth as { token?: string })?.token || socket.handshake.query.token as string;
        if (!token) return next(new Error("Token requerido"));
        try {
            const decoded = verify(token, SECRET) as { userId: string };
            socket.data.userId = decoded.userId;
            next();
        } catch (err) {
            next(new Error("Token inválido"));
        }
    });

    io.on("connection", async (socket) => {
        const userId = socket.data.userId;
        console.log(`Usuario conectado: ${userId} (socket: ${socket.id})`);

        // ───────────────────────────────────────────────
        // NUEVO: Enviar lista de chats automáticamente al conectar
        // ───────────────────────────────────────────────
        try {
            const chats = await getUserChatList(userId);
            socket.emit("my-chats-list", chats);
            console.log(`Lista de chats enviada a ${userId} → ${chats.length} conversaciones`);
        } catch (err) {
            console.error("Error al enviar lista inicial de chats:", err);
            socket.emit("error", "No se pudo cargar la lista de conversaciones");
        }

        // Alternativa: si prefieres que el frontend lo pida explícitamente
        // socket.on("get-my-chats", async () => {
        //     try {
        //         const chats = await getUserChatList(userId);
        //         socket.emit("my-chats-list", chats);
        //     } catch (err) {
        //         socket.emit("error", "No se pudo cargar la lista de conversaciones");
        //     }
        // });

        // Unirse a un chat privado
        socket.on("join-chat", async (receiverId: string) => {
            if (!receiverId || userId === receiverId) {
                socket.emit("error", "ID de receptor inválido");
                return;
            }

            const room = [userId, receiverId].sort().join("_");
            socket.join(room);
            console.log(`Usuario ${userId} se unió al chat con ${receiverId} (room: ${room})`);

            // Cargar historial
            await loadChatHistory(userId, receiverId, socket);

            // Enviar información del receptor
            const receiverDetails = await getUserDetails(receiverId);
            socket.emit("receiver-info", {
                user_id: receiverId,
                user_name: receiverDetails.name,
                user_image: receiverDetails.image,
                user_email: receiverDetails.email,
                user_phone: receiverDetails.phone
            });
        });

        // Enviar mensaje
        socket.on("send-message", async (data: { receiverId: string; message: string; files?: { file_url: string; file_type: 'image' | 'video' }[] }) => {
            const senderId = userId;
            const { receiverId, message, files = [] } = data;

            if (!receiverId || senderId === receiverId || !message?.trim()) {
                socket.emit("error", "Datos inválidos para enviar mensaje");
                return;
            }

            const room = [senderId, receiverId].sort().join("_");

            const senderDetails = await getUserDetails(senderId);
            const receiverDetails = await getUserDetails(receiverId);

            const newMessage = {
                id: uuidv4(),
                user_id_sender: senderId,
                user_image_sender: senderDetails.image,
                user_name_sender: senderDetails.name,
                user_email_sender: senderDetails.email,
                user_phone_sender: senderDetails.phone,
                user_id_receiver: receiverId,
                user_image_receiver: receiverDetails.image,
                user_name_receiver: receiverDetails.name,
                user_email_receiver: receiverDetails.email,
                user_phone_receiver: receiverDetails.phone,
                message,
                files,
                created_at: new Date().toISOString(),
                seen: false,
                received: true,
            };

            await saveMessageToDB(newMessage);
            io.to(room).emit("receive-message", newMessage);
        });

        // Marcar como visto
        socket.on("mark-seen", async (messageId: string) => {
            if (!messageId) {
                socket.emit("error", "ID de mensaje requerido");
                return;
            }
            await updateMessageSeen(messageId, userId);
            // Opcional: notificar al emisor que ya fue visto
            // const msg = await getMessage(messageId); // si quieres
            // if (msg) io.to([msg.user_id_sender, userId].sort().join("_")).emit("message-seen", messageId);
        });

        socket.on("disconnect", () => {
            console.log(`Usuario desconectado: ${userId}`);
        });
    });

    return io;
};

// ───────────────────────────────────────────────
// NUEVA FUNCIÓN: Lista de conversaciones del usuario
// ───────────────────────────────────────────────
async function getUserChatList(userId: string): Promise<ChatPreview[]> {
    try {
        const [rows]: any = await pool.execute(
            `
            SELECT 
                CASE 
                    WHEN m.user_id_sender = ? THEN m.user_id_receiver 
                    ELSE m.user_id_sender 
                END AS receiver_id,
                MAX(m.created_at) AS last_time,
                SUBSTRING_INDEX(
                    GROUP_CONCAT(m.message ORDER BY m.created_at DESC SEPARATOR '||'), '||', 1
                ) AS last_message_text,
                COUNT(CASE 
                    WHEN m.user_id_receiver = ? 
                    AND m.seen = FALSE 
                    THEN 1 
                    ELSE NULL 
                END) AS unread_count
            FROM messages m
            WHERE m.user_id_sender = ? OR m.user_id_receiver = ?
            GROUP BY receiver_id
            ORDER BY last_time DESC
            LIMIT 50
            `,
            [userId, userId, userId, userId]
        );

        const previews: ChatPreview[] = [];

        for (const row of rows) {
            const receiver = await getUserDetails(row.receiver_id);

            let lastMsg = row.last_message_text || null;
            if (lastMsg && lastMsg.length > 80) {
                lastMsg = lastMsg.substring(0, 77) + "...";
            }

            previews.push({
                receiverId: row.receiver_id,
                receiverName: receiver.name,
                receiverImage: receiver.image,
                lastMessage: lastMsg,
                lastMessageTime: row.last_time ? new Date(row.last_time).toISOString() : null,
                unreadCount: Number(row.unread_count) || 0,
            });
        }

        return previews;
    } catch (err) {
        console.error("Error en getUserChatList:", err);
        return [];
    }
}

// ───────────────────────────────────────────────
// Funciones ya existentes (sin cambios importantes)
// ───────────────────────────────────────────────

async function getUserDetails(userId: string): Promise<UserDetails> {
    const [rows]: any = await pool.execute(
        `SELECT name, email, phone FROM formulario WHERE usuario_id = ? ORDER BY id DESC LIMIT 1`,
        [userId]
    );

    const image = await getUserImage(userId);

    if (rows.length === 0) {
        return { name: "Usuario desconocido", email: null, phone: null, image };
    }

    const user = rows[0];
    const displayName = user.name?.trim() || user.email?.trim() || user.phone?.trim() || "Usuario desconocido";

    return {
        name: displayName,
        email: user.email || null,
        phone: user.phone || null,
        image
    };
}

async function getUserImage(userId: string): Promise<string | null> {
    const [rows]: any = await pool.execute(
        "SELECT image_path FROM user_images WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
        [userId]
    );
    return rows.length > 0 ? rows[0].image_path : null;
}

async function saveMessageToDB(message: any) {
    await pool.execute(
        `INSERT INTO messages 
        (id, user_id_sender, user_image_sender, user_name_sender, user_email_sender, user_phone_sender,
         user_id_receiver, user_image_receiver, user_name_receiver, user_email_receiver, user_phone_receiver,
         message, files, created_at, seen, received) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            message.id,
            message.user_id_sender,
            message.user_image_sender,
            message.user_name_sender,
            message.user_email_sender,
            message.user_phone_sender,
            message.user_id_receiver,
            message.user_image_receiver,
            message.user_name_receiver,
            message.user_email_receiver,
            message.user_phone_receiver,
            message.message,
            JSON.stringify(message.files || []),
            message.created_at,
            message.seen,
            message.received
        ]
    );
}

async function updateMessageSeen(messageId: string, userId: string) {
    await pool.execute(
        "UPDATE messages SET seen = true WHERE id = ? AND user_id_receiver = ?",
        [messageId, userId]
    );
}

async function loadChatHistory(userId: string, receiverId: string, socket: any) {
    const [rows]: any = await pool.execute(
        `SELECT * FROM messages 
         WHERE (user_id_sender = ? AND user_id_receiver = ?) 
            OR (user_id_sender = ? AND user_id_receiver = ?) 
         ORDER BY created_at ASC
         LIMIT 100`,  // ← límite razonable para evitar sobrecarga
        [userId, receiverId, receiverId, userId]
    );
    socket.emit("chat-history", rows);
}