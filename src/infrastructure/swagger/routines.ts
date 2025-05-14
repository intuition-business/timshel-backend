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
 */

/**
 * @swagger
 * tags:
 *   name: Timshell
 *   description: Timshell API
 */

/**
 * @swagger
 * /api/get-routines:
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
 *
 */

router.get("/", verifyToken, getRoutines);
