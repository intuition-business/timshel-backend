import { Router } from "express";

import { verifyToken } from "../../middleware/jwtVerify";  // Middleware para verificar el token
import { createExercise, deleteExercise, getAllExercises, getExercisesByCategory, updateExercise, uploadExerciseMedia } from "../../application/exercises/controller";

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
 *     create-exercise-request:
 *       type: object
 *       required:
 *         - category
 *         - exercise
 *         - description
 *       properties:
 *         category:
 *           type: string
 *           description: "Categoría del ejercicio (ej. PECHO)"
 *           example: "PECHO"
 *         exercise:
 *           type: string
 *           description: "Nombre del ejercicio"
 *           example: "Flexiones"
 *         description:
 *           type: string
 *           description: "Descripción del ejercicio"
 *           example: "Ejercicio para pecho superior"
 *         at_home:
 *           type: boolean
 *           nullable: true
 *           description: "Indica si el ejercicio es en casa (true/false o null)"
 *           example: true
 *         video:
 *           type: string
 *           format: binary
 *           description: "Archivo de video del ejercicio (opcional)"
 *         thumbnail:
 *           type: string
 *           format: binary
 *           description: "Archivo de imagen miniatura (opcional)"
 *
 *     create-exercise-response:
 *       type: object
 *       properties:
 *         exercise:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               description: "ID del ejercicio creado"
 *             category:
 *               type: string
 *             exercise:
 *               type: string
 *             description:
 *               type: string
 *             at_home:
 *               type: boolean
 *               nullable: true
 *               description: "Indica si es en casa"
 *             video_url:
 *               type: string
 *               nullable: true
 *             thumbnail_url:
 *               type: string
 *               nullable: true
 *       example:
 *         exercise:
 *           id: 1
 *           category: "PECHO"
 *           exercise: "Flexiones"
 *           description: "Ejercicio para pecho superior"
 *           at_home: true
 *           video_url: "https://s3.amazonaws.com/video.mp4"
 *           thumbnail_url: "https://s3.amazonaws.com/thumbnail.jpg"
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
 *         message: "Ya existe el ejercicio."
 *
 *     get-exercises-response:
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
 *                 type: integer
 *               category:
 *                 type: string
 *               exercise:
 *                 type: string
 *               description:
 *                 type: string
 *               at_home:
 *                 type: boolean
 *                 nullable: true
 *                 description: "Indica si es en casa"
 *               video_url:
 *                 type: string
 *                 nullable: true
 *               thumbnail_url:
 *                 type: string
 *                 nullable: true
 *       example:
 *         message: "Ejercicios obtenidos exitosamente"
 *         error: false
 *         data: [
 *           {
 *             id: 1,
 *             category: "PECHO",
 *             exercise: "Flexiones",
 *             description: "Ejercicio para pecho superior",
 *             at_home: true,
 *             video_url: "https://s3.amazonaws.com/video.mp4",
 *             thumbnail_url: "https://s3.amazonaws.com/thumbnail.jpg"
 *           }
 *         ]
 *
 *     update-exercise-request:
 *       type: object
 *       properties:
 *         new_category:
 *           type: string
 *           description: "Nueva categoría (opcional)"
 *           example: "PECHO"
 *         new_exercise:
 *           type: string
 *           description: "Nuevo nombre del ejercicio (opcional)"
 *           example: "Flexiones mejoradas"
 *         new_description:
 *           type: string
 *           description: "Nueva descripción (opcional)"
 *           example: "Ejercicio actualizado para pecho"
 *         new_at_home:
 *           type: boolean
 *           nullable: true
 *           description: "Nuevo valor para at_home (opcional, true/false o null)"
 *           example: true
 *         video:
 *           type: string
 *           format: binary
 *           description: "Nuevo archivo de video (opcional)"
 *         thumbnail:
 *           type: string
 *           format: binary
 *           description: "Nueva imagen miniatura (opcional)"
 *
 *     update-exercise-response:
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
 *         message: "Actualizado exitosamente"
 *         error: false
 *
 *     delete-exercise-response:
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
 *         message: "Ejercicio eliminado exitosamente"
 *         error: false
 */

/**
 * @swagger
 * tags:
 *   name: Exercises
 *   description: API para gestión de ejercicios
 */

/**
 * @swagger
 * /api/exercises/create:
 *   post:
 *     summary: "Crea un nuevo ejercicio"
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/create-exercise-request'
 *     responses:
 *       201:
 *         description: "Ejercicio creado exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/create-exercise-response'
 *       400:
 *         description: "Error al crear el ejercicio (ej. ya existe o datos inválidos)"
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
 * /api/exercises/all:
 *   get:
 *     summary: "Obtiene todos los ejercicios"
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Ejercicios obtenidos exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-exercises-response'
 *       404:
 *         description: "No se encontraron ejercicios"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-exercises-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-exercises-response'
 *
 * /api/exercises/by-category:
 *   get:
 *     summary: "Obtiene ejercicios por categoría"
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         required: true
 *         description: "Categoría para filtrar (ej. PECHO)"
 *         example: "PECHO"
 *     responses:
 *       200:
 *         description: "Ejercicios de la categoría obtenidos exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-exercises-response'
 *       400:
 *         description: "Falta el parámetro category"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-exercises-response'
 *       404:
 *         description: "No se encontraron ejercicios en la categoría"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-exercises-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-exercises-response'
 *
 * /api/exercises/update/{id}:
 *   patch:
 *     summary: "Actualiza un ejercicio existente por ID"
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: "ID del ejercicio a actualizar"
 *         example: 1
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/update-exercise-request'
 *     responses:
 *       200:
 *         description: "Ejercicio actualizado exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-exercise-response'
 *       400:
 *         description: "Error al actualizar (ej. no hay cambios o ID inválido)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-exercise-response'
 *       404:
 *         description: "Ejercicio no encontrado"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-exercise-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-exercise-response'
 *
 * /api/exercises/delete/{id}:
 *   delete:
 *     summary: "Elimina un ejercicio por ID"
 *     tags: [Exercises]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: "ID del ejercicio a eliminar"
 *         example: 1
 *     responses:
 *       200:
 *         description: "Ejercicio eliminado exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-exercise-response'
 *       400:
 *         description: "Error al eliminar (ej. no se encontró el ejercicio)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-exercise-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-exercise-response'
 */

// Función para manejar errores asíncronos
function asyncHandler(fn: any) {
    return function (req: any, res: any, next: any) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Ruta POST para crear un ejercicio (con upload de video y thumbnail)
router.post(
    "/create",
    verifyToken,  // Verificación de token
    uploadExerciseMedia.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),  // Middleware para manejar uploads
    asyncHandler(createExercise)  // Llama a la función del controlador
);

// Ruta GET para obtener todos los ejercicios
router.get(
    "/all",
    verifyToken,  // Verificación de token
    asyncHandler(getAllExercises)  // Llama al controlador para obtener todos los ejercicios
);

// Ruta GET para obtener ejercicios por categoría (usando query param ?category=...)
router.get(
    "/by-category",
    verifyToken,  // Verificación de token
    asyncHandler(getExercisesByCategory)  // Llama al controlador para obtener ejercicios por categoría
);

// Ruta PATCH para actualizar un ejercicio, incluyendo el ID
router.patch(
    "/update/:id",  // Ahora la ruta espera un ID
    verifyToken,  // Verificación de token
    uploadExerciseMedia.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),  // Middleware para manejar uploads
    asyncHandler(updateExercise)  // Llama al controlador para actualizar el ejercicio
);
// Ruta DELETE para eliminar un ejercicio
router.delete(
    "/delete/:id",  // Ahora la ruta espera un ID
    verifyToken,  // Verificación de token
    asyncHandler(deleteExercise)  // Llama al controlador para eliminar el ejercicio
);

export default router;