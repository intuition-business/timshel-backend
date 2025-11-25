// src/router/chatRouter.ts (o integra en el router principal si quieres)
// Usamos el mismo estilo que tu exercises router: verifyToken en la ruta, asyncHandler, y default export.

import { Router } from "express";
import { verifyToken } from "../../middleware/jwtVerify";
import { uploadChatMedia } from "../../middleware/uploadChatMedia";
import { uploadChatMediaController } from "../../application/chat/controller";


// Función para manejar errores asíncronos
function asyncHandler(fn: any) {
    return function (req: any, res: any, next: any) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     upload-chat-media:
 *       type: object
 *       required:
 *         - token
 *         - files
 *       properties:
 *         token:
 *           type: string
 *           description: "(header: x-access-token) Token valido del usuario"
 *         files:
 *           type: array
 *           items:
 *             type: string
 *             format: binary
 *           description: "Archivos a subir (imágenes o videos, máx 10)"
 *       example:
 *         token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjExLCJlbWFpbCI6ImdlbHZlenoyMjNAZ21haWwuY29tIiwiaWF0IjoxNzQ2NjA2MjE2fQ.SEE0djAniALGF9P53cDNUuKwKr6zHTwWxkZ2DI0k_Uk"
 *         files: [binary data]  # En Swagger UI se muestra como input file
 *
 *     upload-chat-media-response:
 *       type: object
 *       required:
 *         - error
 *         - message
 *         - files
 *       properties:
 *         error:
 *           type: boolean
 *           description: "false si éxito"
 *         message:
 *           type: string
 *           description: "Mensaje de éxito o error"
 *         files:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               file_url:
 *                 type: string
 *                 description: "URL del archivo subido en S3"
 *               file_type:
 *                 type: string
 *                 description: "image o video"
 *       example:
 *         error: false
 *         message: "Archivos subidos con éxito"
 *         files: [
 *           {
 *             "file_url": "https://your-bucket.s3.amazonaws.com/chat-images/1234567890-123456789.jpg",
 *             "file_type": "image"
 *           },
 *           {
 *             "file_url": "https://your-bucket.s3.amazonaws.com/chat-videos/1234567890-123456789.mp4",
 *             "file_type": "video"
 *           }
 *         ]
 */

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Endpoints relacionados con chat
 */

/**
 * @swagger
 * /api/chat/upload-media:
 *   post:
 *     summary: Sube imágenes o videos para usar en el chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []  # Asume que usas bearer para token
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/upload-chat-media'
 *     responses:
 *       200:
 *         description: Archivos subidos con éxito
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/upload-chat-media-response'
 *       400:
 *         description: Error en la solicitud (ej. no hay archivos)
 *       401:
 *         description: Token inválido o faltante
 *       500:
 *         description: Error interno
 */

// Ruta POST para upload de media en chat
router.post(
    "/",
    verifyToken,
    uploadChatMedia,
    asyncHandler(uploadChatMediaController)
);

export default router;