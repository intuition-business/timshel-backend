import { Router } from "express";
import {
    createTrainer,
    getTrainers,
    updateTrainer,
    deleteTrainer,
} from "../../application/gymtrainer/controller"; // Ajusté la importación asumiendo que los controladores están en esta ruta
import { verifyToken } from "../../middleware/jwtVerify"; // Middleware para verificar el token

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
 *     create-trainer-request:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - phone
 *       properties:
 *         name:
 *           type: string
 *           description: "Nombre del entrenador"
 *           example: "John Doe"
 *         email:
 *           type: string
 *           format: email
 *           description: "Correo electrónico del entrenador"
 *           example: "john.doe@example.com"
 *         phone:
 *           type: string
 *           description: "Número de teléfono del entrenador"
 *           example: "+1234567890"
 *         biography:
 *           type: string
 *           description: "Biografía del entrenador"
 *           example: "Entrenador certificado con 10 años de experiencia en fitness."
 *         experience_years:
 *           type: number
 *           description: "Años de experiencia del entrenador"
 *           example: 10
 *         certifications:
 *           type: string
 *           description: "Certificaciones del entrenador"
 *           example: "Certificado en CrossFit y Nutrición"
 *         profile_photo:
 *           type: string
 *           description: "URL de la foto de perfil del entrenador"
 *           example: "https://example.com/photo.jpg"
 *
 *     create-trainer-response:
 *       type: object
 *       properties:
 *         id:
 *           type: number
 *           description: "ID del entrenador creado"
 *         name:
 *           type: string
 *           description: "Nombre del entrenador"
 *         email:
 *           type: string
 *           description: "Correo electrónico del entrenador"
 *       example:
 *         id: 1
 *         name: "John Doe"
 *         email: "john.doe@example.com"
 *
 *     get-trainers-response:
 *       type: object
 *       required:
 *         - message
 *         - error
 *         - data
 *       properties:
 *         message:
 *           type: string
 *           description: "Mensaje de respuesta."
 *         error:
 *           type: boolean
 *           description: "Indica si hubo un error."
 *         data:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: number
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               biography:
 *                 type: string
 *               experience_years:
 *                 type: number
 *               certifications:
 *                 type: string
 *               profile_photo:
 *                 type: string
 *               created_at:
 *                 type: string
 *                 format: date-time
 *       example:
 *         message: "Entrenadores obtenidos exitosamente"
 *         error: false
 *         data:
 *           - id: 1
 *             name: "John Doe"
 *             email: "john.doe@example.com"
 *             phone: "+1234567890"
 *             biography: "Entrenador certificado con 10 años de experiencia en fitness."
 *             experience_years: 10
 *             certifications: "Certificado en CrossFit y Nutrición"
 *             profile_photo: "https://example.com/photo.jpg"
 *             created_at: "2025-10-10T03:07:06Z"
 *
 *     update-trainer-request:
 *       type: object
 *       required:
 *         - id
 *       properties:
 *         id:
 *           type: number
 *           description: "ID del entrenador a actualizar"
 *           example: 1
 *         name:
 *           type: string
 *           description: "Nuevo nombre del entrenador"
 *           example: "John Doe Updated"
 *         email:
 *           type: string
 *           format: email
 *           description: "Nuevo correo electrónico del entrenador"
 *           example: "john.doe.updated@example.com"
 *         phone:
 *           type: string
 *           description: "Nuevo número de teléfono del entrenador"
 *           example: "+1234567891"
 *         biography:
 *           type: string
 *           description: "Nueva biografía del entrenador"
 *           example: "Entrenador actualizado con 11 años de experiencia."
 *         experience_years:
 *           type: number
 *           description: "Nuevos años de experiencia del entrenador"
 *           example: 11
 *         certifications:
 *           type: string
 *           description: "Nuevas certificaciones del entrenador"
 *           example: "Certificado en CrossFit, Nutrición y Pilates"
 *         profile_photo:
 *           type: string
 *           description: "Nueva URL de la foto de perfil del entrenador"
 *           example: "https://example.com/new-photo.jpg"
 *
 *     update-trainer-response:
 *       type: object
 *       required:
 *         - message
 *         - error
 *       properties:
 *         message:
 *           type: string
 *           description: "Mensaje de respuesta."
 *         error:
 *           type: boolean
 *           description: "Indica si hubo un error."
 *       example:
 *         message: "Entrenador actualizado exitosamente"
 *         error: false
 *
 *     delete-trainer-response:
 *       type: object
 *       required:
 *         - message
 *         - error
 *       properties:
 *         message:
 *           type: string
 *           description: "Mensaje de respuesta."
 *         error:
 *           type: boolean
 *           description: "Indica si hubo un error."
 *       example:
 *         message: "Entrenador eliminado exitosamente"
 *         error: false
 *
 *     error-response:
 *       type: object
 *       required:
 *         - error
 *         - message
 *       properties:
 *         error:
 *           type: boolean
 *           description: "Indica si hubo un error."
 *         message:
 *           type: string
 *           description: "Mensaje de error."
 *       example:
 *         error: true
 *         message: "Entrenador no encontrado"
 *
 * tags:
 *   name: Trainers
 *   description: API para gestión de información de entrenadores
 */

/**
 * @swagger
 * /api/trainers:
 *   get:
 *     summary: Obtiene todos los entrenadores o filtra por nombre
 *     tags: [Trainers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         required: false
 *         description: "Filtro opcional para buscar entrenadores por nombre (búsqueda parcial)"
 *         example: "Jo"
 *     responses:
 *       200:
 *         description: Entrenadores obtenidos exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-trainers-response'
 *       404:
 *         description: No se encontraron entrenadores
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-trainers-response'
 *       400:
 *         description: Error en la validación de parámetros
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *   post:
 *     summary: Crea un nuevo entrenador
 *     tags: [Trainers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/create-trainer-request'
 *     responses:
 *       201:
 *         description: Entrenador creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/create-trainer-response'
 *       400:
 *         description: Error al crear el entrenador (ej. datos inválidos)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *
 * /api/trainers/{id}:
 *   put:
 *     summary: Actualiza la información de un entrenador
 *     tags: [Trainers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: number
 *         required: true
 *         description: "ID del entrenador a actualizar"
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/update-trainer-request'
 *     responses:
 *       200:
 *         description: Entrenador actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-trainer-response'
 *       400:
 *         description: Error al actualizar (ej. ID inválido o datos faltantes)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *       404:
 *         description: Entrenador no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *   delete:
 *     summary: Elimina un entrenador
 *     tags: [Trainers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: number
 *         required: true
 *         description: "ID del entrenador a eliminar"
 *         example: 1
 *     responses:
 *       200:
 *         description: Entrenador eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-trainer-response'
 *       400:
 *         description: Error al eliminar (ej. ID inválido)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *       404:
 *         description: Entrenador no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *       500:
 *         description: Error interno del servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 */

// Función para manejar errores asíncronos
function asyncHandler(fn: any) {
    return function (req: any, res: any, next: any) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Ruta POST para crear un entrenador
router.post(
    "/",
    verifyToken,
    asyncHandler(createTrainer)
);

// Ruta GET para obtener entrenadores
router.get(
    "/",
    verifyToken,
    asyncHandler(getTrainers)
);

// Ruta PUT para actualizar un entrenador
router.put(
    "/:id",
    verifyToken,
    asyncHandler(updateTrainer)
);

// Ruta DELETE para eliminar un entrenador
router.delete(
    "/:id",
    verifyToken,
    asyncHandler(deleteTrainer)
);

export default router;