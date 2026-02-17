import { Router } from "express";
import { verifyToken } from "../../middleware/jwtVerify";  // Middleware para verificar el token
import { createPlan, deletePlan, getPlanById, getPlans, updatePlan } from "../../application/plans/controlles";


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
 *     create-plan-request:
 *       type: object
 *       required:
 *         - title
 *         - price_cop
 *         - description_items
 *       properties:
 *         title:
 *           type: string
 *           description: "Título del plan"
 *           example: "Plan Básico"
 *         price_cop:
 *           type: number
 *           description: "Precio del plan en COP"
 *           example: 100000
 *         description_items:
 *           type: array
 *           items:
 *             type: string
 *           description: "Lista de elementos que describen el plan"
 *           example: ["Acceso a contenido básico", "Soporte 24/7"]
 *
 *     create-plan-response:
 *       type: object
 *       properties:
 *         plan:
 *           type: object
 *           properties:
 *             id:
 *               type: integer
 *               description: "ID del plan creado"
 *             title:
 *               type: string
 *             price_cop:
 *               type: number
 *             description_items:
 *               type: array
 *               items:
 *                 type: string
 *       example:
 *         plan:
 *           id: 1
 *           title: "Plan Básico"
 *           price_cop: 100000
 *           description_items: ["Acceso a contenido básico", "Soporte 24/7"]
 *
 *     get-plans-response:
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
 *               title:
 *                 type: string
 *               price_cop:
 *                 type: number
 *               description_items:
 *                 type: array
 *                 items:
 *                   type: string
 *       example:
 *         message: "Planes obtenidos exitosamente"
 *         error: false
 *         data: [
 *           {
 *             id: 1,
 *             title: "Plan Básico",
 *             price_cop: 100000,
 *             description_items: ["Acceso a contenido básico", "Soporte 24/7"]
 *           }
 *         ]
 *
 *     update-plan-request:
 *       type: object
 *       properties:
 *         new_title:
 *           type: string
 *           description: "Nuevo título del plan (opcional)"
 *           example: "Plan Premium"
 *         new_price_cop:
 *           type: number
 *           description: "Nuevo precio en COP (opcional)"
 *           example: 150000
 *         new_description_items:
 *           type: array
 *           items:
 *             type: string
 *           description: "Nueva lista de elementos del plan (opcional)"
 *           example: ["Acceso a contenido premium", "Soporte personalizado"]
 *
 *     update-plan-response:
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
 *         message: "Plan actualizado exitosamente"
 *         error: false
 *
 *     delete-plan-response:
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
 *         message: "Plan eliminado exitosamente"
 *         error: false
 */

/**
 * @swagger
 * tags:
 *   name: Plans
 *   description: API para gestión de planes de suscripción
 */

/**
 * @swagger
 * /api/plans/create:
 *   post:
 *     summary: "Crea un nuevo plan"
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/create-plan-request'
 *     responses:
 *       201:
 *         description: "Plan creado exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/create-plan-response'
 *       400:
 *         description: "Error al crear el plan (por ejemplo, ya existe o datos inválidos)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-plans-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-plans-response'
 *
 * /api/plans:
 *   get:
 *     summary: "Obtiene todos los planes"
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Planes obtenidos exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-plans-response'
 *       404:
 *         description: "No se encontraron planes"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-plans-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-plans-response'
 *
 * /api/plans/{id}:
 *   get:
 *     summary: "Obtiene un plan por ID"
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         type: integer
 *         description: "ID del plan a obtener"
 *         example: 1
 *     responses:
 *       200:
 *         description: "Plan obtenido exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-plans-response'
 *       404:
 *         description: "No se encontró el plan"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-plans-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-plans-response'
 *
 * /api/plans/update/{id}:
 *   put:
 *     summary: "Actualiza un plan existente por ID"
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         type: integer
 *         description: "ID del plan a actualizar"
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/update-plan-request'
 *     responses:
 *       200:
 *         description: "Plan actualizado exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-plan-response'
 *       400:
 *         description: "Error al actualizar el plan (por ejemplo, datos inválidos)"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-plan-response'
 *       404:
 *         description: "Plan no encontrado"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-plan-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/update-plan-response'
 *
 * /api/plans/delete/{id}:
 *   delete:
 *     summary: "Elimina un plan por ID"
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         type: integer
 *         description: "ID del plan a eliminar"
 *         example: 1
 *     responses:
 *       200:
 *         description: "Plan eliminado exitosamente"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-plan-response'
 *       404:
 *         description: "Plan no encontrado"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-plan-response'
 *       500:
 *         description: "Error interno del servidor"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/delete-plan-response'
 */

// Función para manejar errores asíncronos
function asyncHandler(fn: any) {
    return function (req: any, res: any, next: any) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Rutas RESTful estándar
router.post("/create", verifyToken, asyncHandler(createPlan));  // Crear un plan
router.get("/", verifyToken, asyncHandler(getPlans));  // Obtener todos los planes
router.get("/:id", verifyToken, asyncHandler(getPlanById));  // Obtener un plan por ID
router.put("/update/:id", verifyToken, asyncHandler(updatePlan));  // Actualizar un plan por ID
router.delete("/delete/:id", verifyToken, asyncHandler(deletePlan));  // Eliminar un plan por ID

export default router;
