

export const adapterConversations = (rows: any[]) => {
  return rows.map((row) => ({
    userId: Number(row.user_id),
    name: row.name?.trim() || row.telefono?.trim() || "Usuario desconocido",
    avatar: row.image_path || null,
    lastMessage: row.last_message || null,
    lastMessageTime: row.last_message_time || null,
    unseenCount: row.unseen_count ? Number(row.unseen_count) : 0,
    // Bonus: útil para el frontend
    hasConversation: !!row.last_message, // true si ya hubo al menos un mensaje
  }));
};

export const adapterMessages = (rows: any[]) => {
  return rows.map((row) => ({
    id: Number(row.id),
    senderId: Number(row.user_id_sender),
    senderImage: row.user_image_sender || null,
    senderName: row.user_name_sender || "Usuario",
    receiverId: Number(row.user_id_receiver),
    receiverImage: row.user_image_receiver || null,
    receiverName: row.user_name_receiver || "Usuario",
    message: row.message?.trim() || "",
    files: row.files && row.files !== "[]"
      ? JSON.parse(row.files)
      : [],
    createdAt: row.created_at,
    seen: Boolean(row.seen),
    received: Boolean(row.received),
    // Bonus: útil para UI
    isMine: Number(row.user_id_sender) === Number(row.my_user_id), // si pasas my_user_id en la query
  }));
};