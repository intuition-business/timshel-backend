import { Router } from "express";

import { verifyToken } from "../../middleware/jwtVerify";
import { upload } from "../../services/fileService";
import { getUserImage, uploadUserImage } from "../../application/profile/controller";

const router = Router();

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: apiKey
 *       in: header
 *       name: x-access-token
 *       description: "Token de acceso requerido para la autenticación. Ejemplo: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjExLCJlbWFpbCI6ImdlbHZlenoyMjNAZ21haWwuY29tIiwiaWF0IjoxNzQ2NjA2MjE2fQ.SEE0djAniALGF9P53cDNUuKwKr6zHTwWxkZ2DI0k_Uk."
 *
 *   schemas:
 *     upload-image-request:
 *       type: object
 *       required:
 *         - image
 *       properties:
 *         image:
 *           type: string
 *           description: "Imagen del usuario que se subirá."
 *           example: "image.png"
 *   
 *     upload-image-response:
 *       type: object
 *       required:
 *         - message
 *         - error
 *         - imageUrl
 *       properties:
 *         message:
 *           type: string
 *           description: "Mensaje de respuesta."
 *         error:
 *           type: boolean
 *           description: "Indica si hubo un error."
 *         imageUrl:
 *           type: string
 *           description: "URL de la imagen subida."
 *       example:
 *         message: "Imagen subida exitosamente."
 *         error: false
 *         imageUrl: "https://s3.amazonaws.com/user-images/1234567890.png"
 *   
 *     get-image-response:
 *       type: object
 *       required:
 *         - message
 *         - error
 *         - imageUrl
 *       properties:
 *         message:
 *           type: string
 *           description: "Mensaje de respuesta."
 *         error:
 *           type: boolean
 *           description: "Indica si hubo un error."
 *         imageUrl:
 *           type: string
 *           description: "URL de la imagen obtenida."
 *       example:
 *         message: "Imagen obtenida exitosamente."
 *         error: false
 *         imageUrl: "https://s3.amazonaws.com/user-images/1234567890.png"
 *   
 */

/**
 * @swagger
 * tags:
 *   name: Timshell
 *   description: API para gestión de imágenes de usuario
 */

/**
 * @swagger
 * /api/profile/upload-image:
 *   post:
 *     summary: "Sube una imagen de usuario, actualiza si ya existe"
 *     tags: [Timshell]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/upload-image-request'
 *     responses:
 *       200:
 *         description: "Imagen subida exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/upload-image-response'
 *       400:
 *         description: "Error al subir la imagen"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/upload-image-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/upload-image-response'
 * 
 * /api/profile/user/image:
 *   get:
 *     summary: "Obtiene la imagen del usuario"
 *     tags: [Timshell]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Imagen obtenida exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-image-response'
 *       404:
 *         description: "No se encontró la imagen del usuario"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-image-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-image-response'
 */

function asyncHandler(fn: any) {
    return function (req: any, res: any, next: any) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

router.post(
    "/upload-image",
    verifyToken,
    upload.single("image"),
    asyncHandler(uploadUserImage)
);

router.get(
    "/user/image",
    verifyToken,
    asyncHandler(getUserImage)
);


