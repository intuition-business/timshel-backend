import { Router } from "express";
import {
    createRoutine,
    getRoutineByUserId,
    updateRoutineDayStatus,
    deleteRoutineDay,
} from "../../application/routineDays/controller";  // Importamos los controladores
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
 *     routine-request:
 *       type: object
 *       required:
 *         - selected_days
 *       properties:
 *         selected_days:
 *           type: array
 *           items:
 *             type: string
 *             description: "Días seleccionados para la rutina"
 *             example: ["Monday", "Wednesday", "Friday"]
 *
 *     routine-response:
 *       type: object
 *       required:
 *         - message
 *         - error
 *         - routine
 *       properties:
 *         message:
 *           type: string
 *           description: "Mensaje de respuesta."
 *         error:
 *           type: boolean
 *           description: "Indica si hubo un error."
 *         routine:
 *           type: array
 *           description: "Días y fechas de la rutina generada."
 *       example:
 *         message: "Rutina generada exitosamente."
 *         error: false
 *         routine: [
 *           { day: "Monday", date: "2025-07-01" },
 *           { day: "Wednesday", date: "2025-07-03" }
 *         ]
 *
 *     get-routine-response:
 *       type: object
 *       required:
 *         - message
 *         - error
 *         - routine
 *       properties:
 *         message:
 *           type: string
 *           description: "Mensaje de respuesta."
 *         error:
 *           type: boolean
 *           description: "Indica si hubo un error."
 *         routine:
 *           type: array
 *           description: "Días y fechas de la rutina obtenida."
 *       example:
 *         message: "Rutina obtenida exitosamente."
 *         error: false
 *         routine: [
 *           { day: "Monday", date: "2025-07-01", status: "completed" },
 *           { day: "Wednesday", date: "2025-07-03", status: "pending" }
 *         ]
 *
 *     update-routine-status-response:
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
 *         message: "Estado del día actualizado exitosamente."
 *         error: false
 *
 *     delete-routine-day-response:
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
 *         message: "Día de rutina eliminado exitosamente."
 *         error: false
 */

/**
 * @swagger
 * tags:
 *   name: Routine
 *   description: API para gestión de rutinas de ejercicio
 */

/**
 * @swagger
 * /api/routine/create:
 *   post:
 *     summary: "Crea una rutina de ejercicios para el usuario"
 *     tags: [Routine]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/routine-request'
 *     responses:
 *       200:
 *         description: "Rutina generada exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/routine-response'
 *       400:
 *         description: "Error al crear la rutina"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/routine-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/routine-response'
 *
 * /api/routine/{user_id}:
 *   get:
 *     summary: "Obtiene la rutina de un usuario por su ID"
 *     tags: [Routine]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: user_id
 *         in: path
 *         description: "ID del usuario"
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: "Rutina obtenida exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-routine-response'
 *       404:
 *         description: "No se encontró la rutina del usuario"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-routine-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-routine-response'
 *
 * /api/routine/update-status:
 *   put:
 *     summary: "Actualiza el estado de un día en la rutina"
 *     tags: [Routine]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/routine-request'
 *     responses:
 *       200:
 *         description: "Estado del día actualizado exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-routine-status-response'
 *       400:
 *         description: "Error al actualizar el estado"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-routine-status-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-routine-status-response'
 *
 * /api/routine/delete:
 *   delete:
 *     summary: "Elimina un día de la rutina"
 *     tags: [Routine]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Día de rutina eliminado exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-routine-day-response'
 *       404:
 *         description: "No se encontró el día para eliminar"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-routine-day-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-routine-day-response'
 */

function asyncHandler(fn: any) {
    return function (req: any, res: any, next: any) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Rutas para las rutinas de ejercicio
router.post(
    "/create",
    verifyToken,  // Verificación del token
    asyncHandler(createRoutine)  // Controlador para crear la rutina
);

router.get(
    "/:user_id",
    verifyToken,  // Verificación del token
    asyncHandler(getRoutineByUserId)  // Controlador para obtener la rutina de un usuario
);

router.put(
    "/update-status",
    verifyToken,  // Verificación del token
    asyncHandler(updateRoutineDayStatus)  // Controlador para actualizar el estado de un día
);

router.delete(
    "/delete",
    verifyToken,  // Verificación del token
    asyncHandler(deleteRoutineDay)  // Controlador para eliminar un día de la rutina
);

export default router;
