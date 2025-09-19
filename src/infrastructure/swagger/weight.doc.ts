import { Router } from "express";
import {
    createWeight,
    getWeightsByUserId,
    updateWeight,
    deleteWeight,
    getShouldUpdateWeight,
} from "../../application/weight/controlles";  // Importamos los controladores de peso
import { verifyToken } from "../../middleware/jwtVerify";  // Middleware para verificar el token

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
 *     create-weight-request:
 *       type: object
 *       required:
 *         - weight
 *         - date
 *       properties:
 *         weight:
 *           type: number
 *           description: "Peso del usuario en kg"
 *           example: 70.5
 *         date:
 *           type: string
 *           description: "Fecha del registro en formato DD/MM/YYYY"
 *           example: "19/09/2025"
 *
 *     create-weight-response:
 *       type: object
 *       properties:
 *         weight:
 *           type: number
 *           description: "Peso registrado"
 *         date:
 *           type: string
 *           description: "Fecha del registro"
 *       example:
 *         weight: 70.5
 *         date: "19/09/2025"
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
 *         message: "Ya existe un registro de peso para la fecha 19/09/2025"
 *
 *     get-weights-response:
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
 *               weight:
 *                 type: number
 *               date:
 *                 type: string
 *       example:
 *         message: "Registros de peso obtenidos exitosamente"
 *         error: false
 *         data: [
 *           { weight: 70.5, date: "19/09/2025" },
 *           { weight: 71.0, date: "20/09/2025" }
 *         ]
 *
 *     update-weight-request:
 *       type: object
 *       required:
 *         - weight
 *         - date
 *       properties:
 *         weight:
 *           type: number
 *           description: "Nuevo peso del usuario en kg"
 *           example: 71.0
 *         date:
 *           type: string
 *           description: "Fecha del registro a actualizar en formato DD/MM/YYYY"
 *           example: "19/09/2025"
 *
 *     update-weight-response:
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
 *         message: "Registro de peso actualizado exitosamente"
 *         error: false
 *
 *     delete-weight-request:
 *       type: object
 *       required:
 *         - date
 *       properties:
 *         date:
 *           type: string
 *           description: "Fecha del registro a eliminar en formato DD/MM/YYYY"
 *           example: "19/09/2025"
 *
 *     delete-weight-response:
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
 *         message: "Registro de peso eliminado exitosamente"
 *         error: false
 *
 *     should-update-weight-response:
 *       type: object
 *       required:
 *         - should-update
 *       properties:
 *         should-update:
 *           type: boolean
 *           description: "Indica si el usuario debe actualizar su peso (true si han pasado más de 15 días sin registro)."
 *       example:
 *         should-update: true
 */

/**
 * @swagger
 * tags:
 *   name: Weight
 *   description: API para gestión de registros de peso del usuario
 */

/**
 * @swagger
 * /api/weights/create:
 *   post:
 *     summary: "Crea un nuevo registro de peso para el usuario"
 *     tags: [Weight]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/create-weight-request'
 *     responses:
 *       201:
 *         description: "Peso registrado exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/create-weight-response'
 *       400:
 *         description: "Error al registrar el peso (ej. registro duplicado o datos inválidos)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *
 * /api/weights:
 *   get:
 *     summary: "Obtiene todos los registros de peso del usuario"
 *     tags: [Weight]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Registros de peso obtenidos exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-weights-response'
 *       404:
 *         description: "No se encontraron registros de peso"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-weights-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-weights-response'
 *
 * /api/weights/update:
 *   put:
 *     summary: "Actualiza un registro de peso existente"
 *     tags: [Weight]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/update-weight-request'
 *     responses:
 *       200:
 *         description: "Registro de peso actualizado exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-weight-response'
 *       400:
 *         description: "Error al actualizar (ej. no se encontró el registro)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-weight-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-weight-response'
 *
 * /api/weights/delete:
 *   delete:
 *     summary: "Elimina un registro de peso por fecha"
 *     tags: [Weight]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/delete-weight-request'
 *     responses:
 *       200:
 *         description: "Registro de peso eliminado exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-weight-response'
 *       400:
 *         description: "Error al eliminar (ej. no se encontró el registro)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-weight-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-weight-response'
 *
 * /api/weights/user-should-update-weight:
 *   get:
 *     summary: "Verifica si el usuario debe actualizar su peso (basado en los últimos 15 días)"
 *     tags: [Weight]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *         required: true
 *         description: "Fecha actual en formato DD/MM/YYYY para verificar los últimos 15 días"
 *         example: "19/09/2025"
 *     responses:
 *       200:
 *         description: "Verificación exitosa"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/should-update-weight-response'
 *       400:
 *         description: "Fecha inválida"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/error-response'
 *       500:
 *         description: "Error interno del servidor"
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

// Ruta POST para crear un registro de peso
router.post(
    "/create",
    verifyToken,  // Verificación de token
    asyncHandler(createWeight)  // Llama a la función del controlador
);

// Ruta GET para obtener los registros de peso del usuario
// Este controlador no necesita el user_id en la URL, ya que se obtiene del token
router.get(
    "/",
    verifyToken,  // Verificación de token
    asyncHandler(getWeightsByUserId)  // Llama al controlador para obtener los registros de peso
);

// Ruta PUT para actualizar un registro de peso
router.put(
    "/update",
    verifyToken,  // Verificación de token
    asyncHandler(updateWeight)  // Llama al controlador para actualizar el peso
);

// Ruta DELETE para eliminar un registro de peso
router.delete(
    "/delete",
    verifyToken,  // Verificación de token
    asyncHandler(deleteWeight)  // Llama al controlador para eliminar el registro
);

// Ruta GET para verificar si el usuario debe actualizar su peso
router.get(
    "/user-should-update-weight",
    verifyToken,  // Verificación de token
    asyncHandler(getShouldUpdateWeight)  // Llama al controlador para verificar actualización de peso
);

export default router;