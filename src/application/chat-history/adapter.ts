// src/application/chat/adapter.ts
export const adapterConversations = (rows: any[]) => {
  return rows.map(row => ({
    userId: row.user_id,
    name: row.name || row.telefono || "Usuario",
    avatar: row.image_path || null,
    lastMessage: row.last_message || null,
    lastMessageTime: row.last_message_time || null,
    unseenCount: Number(row.unseen_count) || 0
  }));
};

export const adapterMessages = (rows: any[]) => {
  return rows.map(row => ({
    id: row.id,
    user_id_sender: Number(row.user_id_sender),
    user_image_sender: row.user_image_sender,
    user_name_sender: row.user_name_sender,
    user_id_receiver: Number(row.user_id_receiver),
    user_image_receiver: row.user_image_receiver,
    user_name_receiver: row.user_name_receiver,
    message: row.message,
    files: row.files ? JSON.parse(row.files) : [],
    created_at: row.created_at,
    seen: Boolean(row.seen),
    received: Boolean(row.received)
  }));
};