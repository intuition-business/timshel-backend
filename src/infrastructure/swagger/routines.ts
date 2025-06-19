import { Router } from "express";
import { verifyToken } from "../../middleware/jwtVerify";
import { getRoutines } from "../../application/routines/controller";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     get-routines:
 *       type: object
 *       required:
 *         - token
 *       properties:
 *         token:
 *           type: string
 *           description: "(header: x-access-token) Token valido del usuario"
 *       example:
 *         token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjExLCJlbWFpbCI6ImdlbHZlenoyMjNAZ21haWwuY29tIiwiaWF0IjoxNzQ2NjA2MjE2fQ.SEE0djAniALGF9P53cDNUuKwKr6zHTwWxkZ2DI0k_Uk"
 *
 *     generate-routines-ia:
 *       type: object
 *         - user_id
 *         - height
 *         - weight
 *         - gender
 *         - activity_factor
 *         - goal
 *         - hours_per_day
 *         - injury
 *         - pathology
 *         - foods_not_consumed
 *         - illness
 *         - allergy
 *         - usually_dinner
 *         - usually_lunch
 *         - usually_breakfast
 *         - weekly_availability
 *         - birthday
 *         - name
 *         - user_id
 *       properties:
 *         user_id:
 *           type: number
 *           description: Id de usuario
 *         height:
 *           type: double
 *           description: Estatura de usuario
 *         weight:
 *           type: number
 *           description: Peso de usuario
 *         gender:
 *           type: string
 *           description: Genero de usuario
 *         activity_factor:
 *           type: string
 *           description: Factor de actividad de usuario
 *         goal:
 *           type: string
 *           description: Objetivo de usuario
 *         weekly_availability:
 *           type: string
 *           description: Disponibilidad de usuario
 *         hours_per_day:
 *           type: number
 *           description: Horas por dia de usuario
 *         injury:
 *           type: string
 *           description: Lesion de usuario
 *         pathology:
 *           type: string
 *           description: Patologias de usuario
 *         allergy:
 *           type: string
 *           description: Alergia de usuario
 *         foods_not_consumed:
 *           type: string
 *           description: Alimentos no consumidos por el usuario
 *         illness:
 *           type: string
 *           description: Enfermedades de usuario
 *         usually_breakfast:
 *           type: string
 *           description: desayuno de usuario
 *         usually_lunch:
 *           type: string
 *           description: almuerzo de usuario
 *         usually_dinner:
 *           type: string
 *           description: cena de usuario
 *         birthday:
 *           type: string
 *           description: fecha de nacimiento de usuario
 *         name:
 *           type: string
 *           description: nombre de usuario
 *       example:
 *         user_id: 12
 *         height: 1.70
 *         weight: 160
 *         gender: Masculino
 *         activity_factor: Mucho xd
 *         goal: perder grasa
 *         hours_per_day: 1
 *         injury: No
 *         pathology: Ninguna
 *         foods_not_consumed: Ninguno
 *         illness: No
 *         allergy: No
 *         usually_dinner: Pollo
 *         usually_lunch: Carne
 *         usually_breakfast: Arepa
 *         weekly_availability: "5"
 *         birthday: 1997/02/22
 *         name: Carlos
 *
 *     get-routines-response:
 *       type: object
 *       required:
 *         - nombre
 *         - ejercicios
 *       properties:
 *         nombre:
 *           type: string
 *           description: nombre o descripcion del dia.
 *         ejercicios:
 *           type: object
 *           description: un objeto con un esquema
 *       example:
 *         nombre: "Día 1 - Pecho y Tríceps"
 *         ejercicios: [{
 *              "nombre_ejercicio": "PRESS PLANO MANCUERNA",
 *              "Esquema": {"Descanso": 1,"Series": 4,"Detalle series": [{"Reps": 10,"carga": 12},{"Reps": 10,"carga": 12},{"Reps": 8,"carga": 14},{"Reps": 8,"carga": 14}]}}]
 *
 *     get-routines-response-ia:
 *       type: object
 *       required:
 *         - training_plan
 *       properties:
 *         training_plan:
 *           type: object
 *           description: datos que llegan generados por IA
 *       example:
 *         training_plan: [{"nombre":"Día 1 - Pecho y Tríceps", "ejercicios": [{"nombre_ejercicio": "PRESS PLANO BARRA", "esquema":{"Descanso": 1,"Series": 4,"Detalle series":{ "Reps": 10,"carga": 60}}}]}, {...}, {...}]
 *
 *     generate-routines-response:
 *       type: object
 *       required:
 *         - response
 *         - error
 *         - message
 *       properties:
 *         response:
 *           type: string
 *           description: Es la respuesta generada por la IA
 *         error:
 *           type: boolean
 *           description: en caso de error sera true
 *         message:
 *           type: string
 *           description: Ok
 *       example:
 *         response: "\n{\n    \"training_plan\": [\n        {\n            \"nombre\": \"Día 1 - Pecho y Tríceps\",\n"
 *         error: false
 *         message: Ok
 */

/**
 * @swagger
 * tags:
 *   name: Timshell
 *   description: Timshell API
 */

/**
 * @swagger
 * /api/routines:
 *   get:
 *     summary: retorna unos datos
 *     tags: [Timshell]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/get-routines'
 *     responses:
 *       200:
 *         description: Objeto con informacion.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-routines-response'
 *
 * /api/routines/ia (post):
 *   post:
 *     summary: retorna unos datos
 *     tags: [Timshell]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/generate-routines-ia'
 *     responses:
 *       200:
 *         description: Objeto con informacion.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/generate-routines-response'
 *
 * /api/routines/ia (get):
 *   get:
 *     summary: retorna unos datos
 *     tags: [Timshell]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/get-routines'
 *     responses:
 *       200:
 *         description: Objeto con informacion.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-routines-response-ia'
 *
 */

router.get("/", verifyToken, getRoutines);
