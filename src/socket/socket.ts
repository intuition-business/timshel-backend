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
    attachmentType: string | null;
    attachmentUrl: string | null;
    blocked_by_me: boolean;
    is_blocked: boolean;
}

interface MessageAttachment {
    file_url?: string;
    file_type?: string;
}

let ioInstance: SocketIOServer | null = null;

export async function refreshBlockStatus(userId: string, targetId: string): Promise<void> {
    if (!ioInstance) return;
    await emitUserChatsList(ioInstance, userId);
    await emitUserChatsList(ioInstance, targetId);
}

// Función principal para inicializar Socket.IO
export const initSocket = (httpServer: any) => {
    const io = new SocketIOServer(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    ioInstance = io;

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
        socket.join(`user:${userId}`);

        // ───────────────────────────────────────────────
        // NUEVO: Enviar lista de chats automáticamente al conectar
        // ───────────────────────────────────────────────
        try {
            await emitUserChatsList(io, userId);
            console.log(`Lista de chats enviada a ${userId}`);
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

            // Cargar historial reactivo al room (si ambos están conectados en esa conversación)
            await emitChatHistoryToRoom(io, userId, receiverId);

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

        // Permite pedir refresco de historial sin reconectar/reingresar al chat
        socket.on("refresh-chat-history", async (receiverId: string) => {
            if (!receiverId || userId === receiverId) {
                socket.emit("error", "ID de receptor inválido");
                return;
            }

            await emitChatHistoryToRoom(io, userId, receiverId);
        });

        // Permite refrescar lista de conversaciones bajo demanda
        socket.on("get-my-chats", async () => {
            await emitUserChatsList(io, userId);
        });

        // Enviar mensaje
        socket.on("send-message", async (data: { receiverId: string; message?: string; files?: { file_url: string; file_type: 'image' | 'video' }[] }) => {
            try {
                const senderId = userId;
                const { receiverId, message = "", files = [] } = data;

                if (!receiverId || senderId === receiverId) {
                    socket.emit("error", "ID de receptor inválido");
                    return;
                }

                if (!message?.trim() && (!files || files.length === 0)) {
                    socket.emit("error", "El mensaje debe contener texto o archivos");
                    return;
                }

                // Verificar bloqueo en cualquier dirección
                const [blockRows]: any = await pool.execute(
                    `SELECT id FROM blocked_users
                     WHERE (blocker_id = ? AND blocked_id = ?)
                        OR (blocker_id = ? AND blocked_id = ?)
                     LIMIT 1`,
                    [senderId, receiverId, receiverId, senderId]
                );
                if (blockRows.length > 0) {
                    socket.emit("message-blocked", { receiverId });
                    return;
                }

                const room = [senderId, receiverId].sort().join("_");

                const senderDetails = await getUserDetails(senderId);
                const receiverDetails = await getUserDetails(receiverId);

                const now = new Date();
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
                    created_at: now.toISOString(),
                    seen: false,
                    received: true,
                    _created_at_db: now,
                };

                await saveMessageToDB(newMessage);
                io.to(room).emit("receive-message", newMessage);

                await emitChatHistoryToRoom(io, senderId, receiverId);
                await emitUserChatsList(io, senderId);
                await emitUserChatsList(io, receiverId);

                sendChatPushNotification(senderId, receiverId, senderDetails.name, message, files).catch((e) => console.error('[chat-push] error:', e?.message || e));
            } catch (err: any) {
                console.error('[send-message] error:', err?.message || err);
                socket.emit("error", "No se pudo enviar el mensaje");
            }
        });

        // Marcar como visto
        socket.on("mark-seen", async (messageId: string) => {
            if (!messageId) {
                socket.emit("error", "ID de mensaje requerido");
                return;
            }
            await updateMessageSeen(messageId, userId);

            const messageData = await getMessageById(messageId);
            if (messageData) {
                await emitChatHistoryToRoom(io, messageData.user_id_sender, messageData.user_id_receiver);
                await emitUserChatsList(io, messageData.user_id_sender);
                await emitUserChatsList(io, messageData.user_id_receiver);
            }
            // Opcional: notificar al emisor que ya fue visto
            // const msg = await getMessage(messageId); // si quieres
            // if (msg) io.to([msg.user_id_sender, userId].sort().join("_")).emit("message-seen", messageId);
        });

        // Bloquear usuario
        socket.on("block-user", async (targetId: string) => {
            console.log(`[block-user] userId=${userId} bloqueando targetId=${targetId}`);
            if (!targetId || String(userId) === String(targetId)) {
                socket.emit("error", "ID de usuario inválido");
                return;
            }

            await pool.execute(
                `INSERT IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)`,
                [userId, targetId]
            );

            await emitUserChatsList(io, String(userId));
            await emitUserChatsList(io, String(targetId));

            socket.emit("block-success", { targetId });
            console.log(`[block-user] OK — my-chats-list emitido a ${userId} y ${targetId}`);
        });

        // Desbloquear usuario
        socket.on("unblock-user", async (targetId: string) => {
            console.log(`[unblock-user] userId=${userId} desbloqueando targetId=${targetId}`);
            if (!targetId || String(userId) === String(targetId)) {
                socket.emit("error", "ID de usuario inválido");
                return;
            }

            await pool.execute(
                `DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?`,
                [userId, targetId]
            );

            await emitUserChatsList(io, String(userId));
            await emitUserChatsList(io, String(targetId));

            socket.emit("unblock-success", { targetId });
            console.log(`[unblock-user] OK — my-chats-list emitido a ${userId} y ${targetId}`);
        });

        // Eliminar chat solo para mí (el otro usuario conserva sus mensajes)
        socket.on("delete-chat", async (receiverId: string) => {
            if (!receiverId || userId === receiverId) {
                socket.emit("error", "ID de receptor inválido");
                return;
            }

            await pool.execute(
                `INSERT INTO chat_deletions (user_id, other_user_id, deleted_at)
                 VALUES (?, ?, NOW())
                 ON DUPLICATE KEY UPDATE deleted_at = NOW()`,
                [userId, receiverId]
            );

            await emitUserChatsList(io, userId);
            socket.emit("chat-deleted", { receiverId });
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
export async function getUserChatList(userId: string): Promise<ChatPreview[]> {
    try {
        const [rows]: any = await pool.execute(
            `SELECT
                CASE
                    WHEN m.user_id_sender = ? THEN m.user_id_receiver
                    ELSE m.user_id_sender
                END AS receiver_id,
                MAX(m.created_at) AS last_time,
                SUBSTRING_INDEX(
                    GROUP_CONCAT(m.message ORDER BY m.created_at DESC SEPARATOR '||'), '||', 1
                ) AS last_message_text,
                SUBSTRING_INDEX(
                    GROUP_CONCAT(m.files ORDER BY m.created_at DESC SEPARATOR '||'), '||', 1
                ) AS last_message_files,
                COUNT(CASE
                    WHEN m.user_id_receiver = ? AND m.seen = FALSE THEN 1
                    ELSE NULL
                END) AS unread_count
            FROM messages m
            WHERE m.user_id_sender = ? OR m.user_id_receiver = ?
            GROUP BY receiver_id
            ORDER BY last_time DESC
            LIMIT 50`,
            [userId, userId, userId, userId]
        );

        // Filtro de eliminaciones: traer deleted_at del usuario en una sola query
        const [deletions]: any = await pool.execute(
            `SELECT other_user_id, deleted_at FROM chat_deletions WHERE user_id = ?`,
            [userId]
        );
        const deletionMap: Record<string, Date> = {};
        for (const d of deletions) {
            deletionMap[String(d.other_user_id)] = new Date(d.deleted_at);
        }

        const previews: ChatPreview[] = [];

        for (const row of rows) {
            // Saltar si el último mensaje es anterior a cuando el usuario eliminó el chat
            const deletedAt = deletionMap[String(row.receiver_id)];
            if (deletedAt && new Date(row.last_time) <= deletedAt) continue;

            const receiver = await getUserDetails(row.receiver_id);
            const lastAttachment = getLastAttachment(row.last_message_files);

            let lastMsg = (row.last_message_text || "").trim() || null;
            if (!lastMsg && lastAttachment) {
                lastMsg = getAttachmentPreviewLabel(lastAttachment.file_type);
            } else if (lastMsg && lastAttachment) {
                lastMsg = `${lastMsg} ${getAttachmentPreviewLabel(lastAttachment.file_type)}`;
            }

            if (lastMsg && lastMsg.length > 80) {
                lastMsg = lastMsg.substring(0, 77) + "...";
            }

            const blockStatus = await getBlockStatus(userId, row.receiver_id);

            previews.push({
                receiverId: row.receiver_id,
                receiverName: receiver.name,
                receiverImage: receiver.image,
                lastMessage: lastMsg,
                lastMessageTime: row.last_time ? new Date(row.last_time).toISOString() : null,
                unreadCount: Number(row.unread_count) || 0,
                attachmentType: lastAttachment?.file_type || null,
                attachmentUrl: lastAttachment?.file_url || null,
                blocked_by_me: blockStatus.blocked_by_me,
                is_blocked: blockStatus.is_blocked,
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

export async function getChatPreviewWithUser(userId: string, receiverId: string): Promise<ChatPreview | null> {
    try {
        const [rows]: any = await pool.execute(
            `SELECT
                ? AS receiver_id,
                MAX(m.created_at) AS last_time,
                SUBSTRING_INDEX(
                    GROUP_CONCAT(m.message ORDER BY m.created_at DESC SEPARATOR '||'), '||', 1
                ) AS last_message_text,
                SUBSTRING_INDEX(
                    GROUP_CONCAT(m.files ORDER BY m.created_at DESC SEPARATOR '||'), '||', 1
                ) AS last_message_files,
                COUNT(CASE
                    WHEN m.user_id_receiver = ? AND m.seen = FALSE THEN 1
                    ELSE NULL
                END) AS unread_count
            FROM messages m
            WHERE ((m.user_id_sender = ? AND m.user_id_receiver = ?)
               OR (m.user_id_sender = ? AND m.user_id_receiver = ?))
              AND m.created_at > COALESCE(
                  (SELECT deleted_at FROM chat_deletions WHERE user_id = ? AND other_user_id = ?),
                  '1970-01-01'
              )`,
            [receiverId, userId, userId, receiverId, receiverId, userId, userId, receiverId]
        );

        const receiver = await getUserDetails(receiverId);
        const blockStatus = await getBlockStatus(userId, receiverId);

        if (!rows || rows.length === 0 || !rows[0].last_time) {
            return {
                receiverId,
                receiverName: receiver.name,
                receiverImage: receiver.image,
                lastMessage: null,
                lastMessageTime: null,
                unreadCount: 0,
                attachmentType: null,
                attachmentUrl: null,
                blocked_by_me: blockStatus.blocked_by_me,
                is_blocked: blockStatus.is_blocked,
            };
        }

        const row = rows[0];
        const lastAttachment = getLastAttachment(row.last_message_files);

        let lastMsg = (row.last_message_text || "").trim() || null;
        if (!lastMsg && lastAttachment) {
            lastMsg = getAttachmentPreviewLabel(lastAttachment.file_type);
        } else if (lastMsg && lastAttachment) {
            lastMsg = `${lastMsg} ${getAttachmentPreviewLabel(lastAttachment.file_type)}`;
        }
        if (lastMsg && lastMsg.length > 80) lastMsg = lastMsg.substring(0, 77) + "...";

        return {
            receiverId,
            receiverName: receiver.name,
            receiverImage: receiver.image,
            lastMessage: lastMsg,
            lastMessageTime: row.last_time ? new Date(row.last_time).toISOString() : null,
            unreadCount: Number(row.unread_count) || 0,
            attachmentType: lastAttachment?.file_type || null,
            attachmentUrl: lastAttachment?.file_url || null,
            blocked_by_me: blockStatus.blocked_by_me,
            is_blocked: blockStatus.is_blocked,
        };
    } catch (err) {
        console.error("Error en getChatPreviewWithUser:", err);
        return null;
    }
}

export async function getUserDetails(userId: string): Promise<UserDetails> {
    const [rows]: any = await pool.execute(
        `SELECT name, email, phone FROM formulario WHERE usuario_id = ? ORDER BY id DESC LIMIT 1`,
        [userId]
    );

    if (rows.length > 0) {
        const user = rows[0];
        const image = await getUserImage(userId);
        const displayName = user.name?.trim() || user.email?.trim() || user.phone?.trim() || "Usuario desconocido";
        return { name: displayName, email: user.email || null, phone: user.phone || null, image };
    }

    // Si no es usuario normal, buscar en entrenadores via auth.entrenador_id
    const [trainerRows]: any = await pool.execute(
        `SELECT e.name, e.email, e.phone, e.image
         FROM entrenadores e
         JOIN auth a ON a.entrenador_id = e.id
         WHERE a.id = ? LIMIT 1`,
        [userId]
    );

    if (trainerRows.length > 0) {
        const trainer = trainerRows[0];
        const displayName = trainer.name?.trim() || trainer.email?.trim() || "Entrenador";
        return { name: displayName, email: trainer.email || null, phone: trainer.phone || null, image: trainer.image || null };
    }

    const image = await getUserImage(userId);
    return { name: "Usuario desconocido", email: null, phone: null, image };
}

async function getBlockStatus(userId: string, otherId: string): Promise<{ blocked_by_me: boolean; is_blocked: boolean }> {
    const [rows]: any = await pool.execute(
        `SELECT blocker_id FROM blocked_users
         WHERE (blocker_id = ? AND blocked_id = ?)
            OR (blocker_id = ? AND blocked_id = ?)
         LIMIT 2`,
        [userId, otherId, otherId, userId]
    );
    let blocked_by_me = false;
    let is_blocked = false;
    for (const row of rows) {
        if (String(row.blocker_id) === String(userId)) blocked_by_me = true;
        else is_blocked = true;
    }
    return { blocked_by_me, is_blocked };
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
            message._created_at_db || new Date(),
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

async function getChatHistory(userId: string, receiverId: string) {
    const [rows]: any = await pool.execute(
        `SELECT m.* FROM messages m
         WHERE ((m.user_id_sender = ? AND m.user_id_receiver = ?)
            OR (m.user_id_sender = ? AND m.user_id_receiver = ?))
           AND m.created_at > COALESCE(
               (SELECT deleted_at FROM chat_deletions
                WHERE user_id = ? AND other_user_id = ?),
               '1970-01-01'
           )
         ORDER BY m.created_at ASC
         LIMIT 100`,
        [userId, receiverId, receiverId, userId, userId, receiverId]
    );

    return rows;
}

async function emitChatHistoryToRoom(io: SocketIOServer, userA: string, userB: string) {
    const room = [userA, userB].sort().join("_");
    const rows = await getChatHistory(userA, userB);
    io.to(room).emit("chat-history", rows);
}

async function emitUserChatsList(io: SocketIOServer, userId: string) {
    const chats = await getUserChatList(userId);
    io.to(`user:${userId}`).emit("my-chats-list", chats);
}

async function getMessageById(messageId: string): Promise<{ user_id_sender: string; user_id_receiver: string } | null> {
    const [rows]: any = await pool.execute(
        `SELECT user_id_sender, user_id_receiver FROM messages WHERE id = ? LIMIT 1`,
        [messageId]
    );

    if (!rows || rows.length === 0) return null;

    return {
        user_id_sender: String(rows[0].user_id_sender),
        user_id_receiver: String(rows[0].user_id_receiver),
    };
}

function getLastAttachment(filesRaw: unknown): MessageAttachment | null {
    if (!filesRaw || typeof filesRaw !== "string") return null;

    try {
        const parsed = JSON.parse(filesRaw);
        if (!Array.isArray(parsed) || parsed.length === 0) return null;

        const first = parsed[0] as MessageAttachment;
        if (!first?.file_url) return null;

        return {
            file_url: first.file_url,
            file_type: first.file_type || "file",
        };
    } catch {
        return null;
    }
}

function getAttachmentPreviewLabel(fileType?: string): string {
    switch ((fileType || "").toLowerCase()) {
        case "image":
            return "📷 Imagen";
        case "video":
            return "🎥 Video";
        case "audio":
        case "voice":
        case "voice_note":
            return "🎤 Nota de voz";
        default:
            return "📎 Archivo adjunto";
    }
}

async function sendChatPushNotification(
    senderId: string,
    receiverId: string,
    senderName: string,
    message: string,
    files: { file_url: string; file_type: string }[]
): Promise<void> {
    const [rows]: any = await pool.execute(
        `SELECT fcm_token FROM device_tokens WHERE user_id = ?`,
        [receiverId]
    );
    if (!rows.length) return;

    const tokens = rows.map((r: any) => r.fcm_token);
    const body = message?.trim() || (files.length > 0 ? getAttachmentPreviewLabel(files[0].file_type) : "Nuevo mensaje");

    const { sendPushNotification } = await import("../infrastructure/firebase/notifications");
    const { invalidTokens } = await sendPushNotification(tokens, {
        title: senderName,
        body,
        data: {
            route: `/chat?userIdToConnect=${senderId}`,
        },
    });

    if (invalidTokens.length > 0) {
        await pool.execute(
            `DELETE FROM device_tokens WHERE fcm_token IN (${invalidTokens.map(() => '?').join(',')})`,
            invalidTokens
        );
        console.log(`[FCM] ${invalidTokens.length} tokens inválidos eliminados`);
    }
}