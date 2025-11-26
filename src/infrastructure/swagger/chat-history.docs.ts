// src/application/chat/router.ts
import { Router } from "express";
import { verifyToken } from "../../middleware/jwtVerify";
import { getConversations, getMessages } from "../../application/chat-history/controller";

const router = Router();

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: apiKey
 *       in: header
 *       name: x-access-token
 *       description: "Token de acceso requerido para la autenticación."
 *
 *   schemas:
 *     conversation-item:
 *       type: object
 *       properties:
 *         userId:
 *           type: integer
 *           description: "ID del usuario con quien tienes conversación"
 *         name:
 *           type: string
 *           description: "Nombre o teléfono del usuario"
 *         avatar:
 *           type: string
 *           nullable: true
 *           description: "URL de la foto de perfil (null si no tiene)"
 *         lastMessage:
 *           type: string
 *           nullable: true
 *           description: "Último mensaje de la conversación"
 *         lastMessageTime:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: "Fecha del último mensaje"
 *         unseenCount:
 *           type: integer
 *           description: "Cantidad de mensajes no leídos"
 *       example:
 *         userId: 26
 *         name: "Elvis Uriel"
 *         avatar: "https://timshell.s3.amazonaws.com/chat-images/123.jpg"
 *         lastMessage: "Aquí tienes el video"
 *         lastMessageTime: "2025-04-05T10:32:10.000Z"
 *         unseenCount: 3
 *
 *     get-conversations-response:
 *       type: object
 *       properties:
 *         error:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/conversation-item'
 *       example:
 *         error: false
 *         message: "Conversaciones obtenidas"
 *         data: [
 *           {
 *             "userId": 26,
 *             "name": "Elvis Uriel",
 *             "avatar": "https://timshell.s3.../chat-images/abc.jpg",
 *             "lastMessage": "Aquí tienes el video",
 *             "lastMessageTime": "2025-04-05T10:32:10.000Z",
 *             "unseenCount": 3
 *           },
 *           {
 *             "userId": 1,
 *             "name": "Admin",
 *             "avatar": null,
 *             "lastMessage": "Perfecto",
 *             "lastMessageTime": "2025-04-05T09:15:00.000Z",
 *             "unseenCount": 0
 *           }
 *         ]
 *
 *     message-item:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: "UUID del mensaje"
 *         user_id_sender:
 *           type: integer
 *         user_image_sender:
 *           type: string
 *           nullable: true
 *         user_name_sender:
 *           type: string
 *         user_id_receiver:
 *           type: integer
 *         user_image_receiver:
 *           type: string
 *           nullable: true
 *         user_name_receiver:
 *           type: string
 *         message:
 *           type: string
 *         files:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               file_url:
 *                 type: string
 *               file_type:
 *                 type: string
 *                 enum: [image, video]
 *           nullable: true
 *         created_at:
 *           type: string
 *           format: date-time
 *         seen:
 *           type: boolean
 *         received:
 *           type: boolean
 *       example:
 *         id: "a1b2c3d4-e5f6-7890-g1h2-i3j4k5l6m7n8"
 *         user_id_sender: 26
 *         user_image_sender: "https://timshell.s3.../chat-images/abc.jpg"
 *         user_name_sender: "Elvis Uriel"
 *         user_id_receiver: 1
 *         user_image_receiver: null
 *         user_name_receiver: "Admin"
 *         message: "¡Hola!"
 *         files: []
 *         created_at: "2025-04-05T10:30:45.000Z"
 *         seen: true
 *         received: true
 *
 *     get-messages-response:
 *       type: object
 *       properties:
 *         error:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/message-item'
 *       example:
 *         error: false
 *         message: "Mensajes obtenidos"
 *         data: []
 *
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: boolean
 *         message:
 *           type: string
 *       example:
 *         error: true
 *         message: "receiverId es requerido"
 */

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: API para mensajería privada en tiempo real
 */

/**
 * @swagger
 * /api/chat/conversations:
 *   get:
 *     summary: "Obtiene la lista de todas tus conversaciones activas"
 *     description: "Devuelve una conversación por cada usuario con quien has intercambiado mensajes. Incluye último mensaje, hora y conteo de no leídos."
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: "Cantidad máxima de conversaciones a devolver"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: "Número de página"
 *     responses:
 *       200:
 *         description: "Lista de conversaciones obtenida exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-conversations-response'
 *       401:
 *         description: "Token inválido o faltante"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 */

/**
 * @swagger
 * /api/chat/messages:
 *   get:
 *     summary: "Obtiene el historial completo de mensajes con un usuario"
 *     description: "Se usa cuando haces click en una conversación. Devuelve todos los mensajes ordenados cronológicamente."
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: receiverId
 *         required: true
 *         schema:
 *           type: integer
 *         description: "ID del usuario con quien quieres ver el chat"
 *         example: 26
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: "Historial de mensajes obtenido exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-messages-response'
 *       400:
 *         description: "Falta receiverId o parámetros inválidos"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *       401:
 *         description: "Token inválido o faltante"
 *       500:
 *         description: "Error interno del servidor"
 */

function asyncHandler(fn: any) {
    return (req: any, res: any, next: any) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

router.get("/conversations", verifyToken, asyncHandler(getConversations));
router.get("/messages", verifyToken, asyncHandler(getMessages));

export default router;