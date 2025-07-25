import { Router } from "express";
import {
    getRoutines,
    generateRoutinesIa,
    getGeneratedRoutinesIa,
    getRoutinesSaved,
    routinesSaved,
    getRoutineByDate,
} from "../../application/routines/controller";
import { verifyToken } from "../../middleware/jwtVerify";

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
 *     routine-response:
 *       type: object
 *       required:
 *         - message
 *         - error
 *         - response
 *       properties:
 *         message:
 *           type: string
 *           description: "Mensaje de respuesta."
 *         error:
 *           type: boolean
 *           description: "Indica si hubo un error."
 *         response:
 *           type: array
 *           description: "Lista de rutinas con detalles."
 *       example:
 *         message: "Rutinas guardadas"
 *         error: false
 *         response: [
 *           {
 *             fecha_rutina: "2025-07-25T05:00:00.000Z",
 *             rutina_id: "98fff633-e9f5-451f-908a-4f5ca4dc7842",
 *             routine_name: "Día 2 - Espalda y Bíceps",
 *             exercises: [
 *               {
 *                 exercise_name: "CURL MANCUERNA",
 *                 description: "...",
 *                 thumbnail_url: "https://example.com/thumbnail4.jpg",
 *                 video_url: "https://example.com/video4.mp4",
 *                 liked: 0,
 *                 liked_reason: "nonas",
 *                 series_completed: [
 *                   { reps: 5, load: 12, breakTime: 2 },
 *                   { reps: 1, load: 3, breakTime: 3 },
 *                   { reps: 3, load: 4, breakTime: 5 }
 *                 ]
 *               },
 *               {
 *                 exercise_name: "CURL MARTILLO",
 *                 description: "...",
 *                 thumbnail_url: "https://example.com/thumbnail5.jpg",
 *                 video_url: "https://example.com/video5.mp4",
 *                 liked: 0,
 *                 liked_reason: "",
 *                 series_completed: [
 *                   { reps: 3, load: 5, breakTime: 6 },
 *                   { reps: 3, load: 53, breakTime: 1 },
 *                   { reps: 5, load: 2, breakTime: 3 }
 *                 ]
 *               },
 *               {
 *                 exercise_name: "ELEVACIONES DE PIERNAS",
 *                 description: "...",
 *                 thumbnail_url: "https://example.com/thumbnail6.jpg",
 *                 video_url: "https://example.com/video6.mp4",
 *                 liked: null,
 *                 liked_reason: "",
 *                 series_completed: [
 *                   { reps: 35, load: 24, breakTime: 3 },
 *                   { reps: 15, load: 24, breakTime: 1 },
 *                   { reps: 50, load: 6, breakTime: 2 }
 *                 ]
 *               }
 *             ]
 *           }
 *         ]
 *
 *     routine-save-request:
 *       type: object
 *       required:
 *         - fecha_rutina
 *         - rutina
 *       properties:
 *         fecha_rutina:
 *           type: string
 *           description: "Fecha de la rutina."
 *         rutina:
 *           type: object
 *           required:
 *             - routine_name
 *             - exercises
 *           properties:
 *             routine_name:
 *               type: string
 *               description: "Nombre de la rutina."
 *             exercises:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   exercise_name:
 *                     type: string
 *                     description: "Nombre del ejercicio."
 *                   series_completed:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         reps:
 *                           type: integer
 *                           description: "Repeticiones en la serie."
 *                         load:
 *                           type: integer
 *                           description: "Carga utilizada."
 *                         breakTime:
 *                           type: integer
 *                           description: "Tiempo de descanso entre series."
 *       example:
 *         fecha_rutina: "2025-07-01"
 *         rutina:
 *           routine_name: "Día 1 - Pecho"
 *           exercises: [
 *             {
 *               exercise_name: "Press de banca",
 *               series_completed: [
 *                 { reps: 10, load: 50, breakTime: 1 },
 *                 { reps: 8, load: 60, breakTime: 2 }
 *               ]
 *             }
 *           ]
 *
 * /api/routines/routinesSaved:
 *   get:
 *     summary: "Obtener las rutinas guardadas del usuario"
 *     tags: [RoutineNew]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Rutinas obtenidas exitosamente."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/routine-response'
 *       404:
 *         description: "No se encontraron rutinas guardadas."
 *       500:
 *         description: "Error interno del servidor."
 *
 * /api/routines/routinesSave:
 *   post:
 *     summary: "Guardar una rutina generada o personalizada"
 *     tags: [RoutineNew]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/routine-save-request'
 *     responses:
 *       200:
 *         description: "Rutina guardada exitosamente."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/routine-response'
 *       400:
 *         description: "Error al guardar la rutina."
 *       500:
 *         description: "Error interno del servidor."
 */

/**
 * @swagger
 * /api/routines/routinesByDate:
 *   get:
 *     summary: "Obtener las rutinas guardadas de un usuario por fecha"
 *     tags: [RoutineNew]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fecha_rutina
 *         required: true
 *         description: "Fecha de la rutina en formato dd/mm/yyyy."
 *         schema:
 *           type: string
 *           example: "23/07/2025"
 *     responses:
 *       200:
 *         description: "Rutinas obtenidas exitosamente para la fecha proporcionada."
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/routine-response'
 *       400:
 *         description: "Fecha de rutina es requerida."
 *       404:
 *         description: "No se encontraron rutinas para la fecha proporcionada."
 *       500:
 *         description: "Error interno del servidor."
 */

router.get("/routinesSaved", verifyToken, getRoutinesSaved);

router.post("/routinesSave", verifyToken, routinesSaved);

router.get("/routinesByDate", verifyToken, getRoutineByDate);

router.get("/", verifyToken, getRoutines);

router.post("/ia", verifyToken, generateRoutinesIa);

router.get("/ia", verifyToken, getGeneratedRoutinesIa);

export default router;
