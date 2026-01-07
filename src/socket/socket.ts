import { Server as SocketIOServer } from "socket.io";
import { verify } from "jsonwebtoken";
import { v4 as uuidv4 } from 'uuid';
import pool from "../config/db";
import { SECRET } from "../config";

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

    // HANDLERS PARA CHAT
    io.on("connection", (socket) => {
        console.log(`Usuario conectado: ${socket.data.userId} (socket: ${socket.id})`);

        // Unirse a un chat privado (room basado en IDs ordenados para unicidad)
        socket.on("join-chat", async (receiverId: string) => {
            const userId = socket.data.userId;
            if (!receiverId || userId === receiverId) {
                socket.emit("error", "ID de receptor inválido");
                return;
            }

            const room = [userId, receiverId].sort().join("_");  // Ej: "123_456"
            socket.join(room);
            console.log(`Usuario ${userId} se unió al chat con ${receiverId} (room: ${room})`);

            // Cargar historial de mensajes
            loadChatHistory(userId, receiverId, socket);
        });

        // Enviar mensaje
        socket.on("send-message", async (data: { receiverId: string; message: string; files?: { file_url: string; file_type: 'image' | 'video' }[] }) => {
            const senderId = socket.data.userId;
            const { receiverId, message, files = [] } = data;
            if (!receiverId || senderId === receiverId || !message) {
                socket.emit("error", "Datos inválidos para enviar mensaje");
                return;
            }

            const room = [senderId, receiverId].sort().join("_");

            // Generar mensaje según esquema
            const newMessage = {
                id: uuidv4(),
                user_id_sender: senderId,
                user_image_sender: await getUserImage(senderId),
                user_name_sender: await getUserName(senderId),
                user_id_receiver: receiverId,
                user_image_receiver: await getUserImage(receiverId),
                user_name_receiver: await getUserName(receiverId),
                message,
                files,
                created_at: new Date().toISOString(),
                seen: false,
                received: true,  // Asumimos recibido al emitir
            };

            // Guardar en DB
            await saveMessageToDB(newMessage);

            // Emitir a la room (ambos usuarios en tiempo real)
            io.to(room).emit("receive-message", newMessage);
        });

        // Marcar como visto
        socket.on("mark-seen", async (messageId: string) => {
            if (!messageId) {
                socket.emit("error", "ID de mensaje requerido");
                return;
            }
            await updateMessageSeen(messageId, socket.data.userId);
            // Opcional: Notificar al sender
            // io.to(room).emit("message-seen", { messageId });
        });

        socket.on("disconnect", () => {
            console.log(`Usuario desconectado: ${socket.data.userId}`);
        });
    });

    return io;  // Devolvemos io para usarlo en Server si es necesario
};

// Obtener imagen de perfil desde la tabla user_images
async function getUserImage(userId: string): Promise<string | null> {
    const [rows]: any = await pool.execute(
        "SELECT image_path FROM user_images WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
        [userId]
    );
    return rows.length > 0 ? rows[0].image_path : null;
}

// Obtener nombre (desde auth)
async function getUserName(userId: string): Promise<string> {
    const [rows]: any = await pool.execute(
        "SELECT name, telefono FROM auth WHERE id = ?",
        [userId]
    );
    if (!rows.length) return "Usuario";
    const user = rows[0];
    return user.name || user.telefono || `Usuario ${userId}`;
}

async function saveMessageToDB(message: any) {
    await pool.execute(
        "INSERT INTO messages (id, user_id_sender, user_image_sender, user_name_sender, user_id_receiver, user_image_receiver, user_name_receiver, message, files, created_at, seen, received) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [message.id, message.user_id_sender, message.user_image_sender, message.user_name_sender, message.user_id_receiver, message.user_image_receiver, message.user_name_receiver, message.message, JSON.stringify(message.files), message.created_at, message.seen, message.received]
    );
}

async function updateMessageSeen(messageId: string, userId: string) {
    // Solo actualizar si el usuario es el receiver
    await pool.execute(
        "UPDATE messages SET seen = true WHERE id = ? AND user_id_receiver = ?",
        [messageId, userId]
    );
}

async function loadChatHistory(userId: string, receiverId: string, socket: any) {
    const [rows]: any = await pool.execute(
        "SELECT * FROM messages WHERE (user_id_sender = ? AND user_id_receiver = ?) OR (user_id_sender = ? AND user_id_receiver = ?) ORDER BY created_at ASC",
        [userId, receiverId, receiverId, userId]
    );
    socket.emit("chat-history", rows);
}