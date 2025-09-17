import {
  createforms,
  getFormsByUserId,
} from "../../application/forms/controller";

import { Router } from "express";
import { validateHandler } from "../../middleware";
import { createFormsDto, getFormsDto } from "../../application/forms/dto";
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
 *       description: "Token de acceso requerido para la autenticación ejemplo: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjExLCJlbWFpbCI6ImdlbHZlenoyMjNAZ21haWwuY29tIiwiaWF0IjoxNzQ2NjA2MjE2fQ.SEE0djAniALGF9P53cDNUuKwKr6zHTwWxkZ2DI0k_Uk."
 *
 *   schemas:
 *     create-forms-questions:
 *       type: object
 *       required:
 *         - user_id
 *         - height
 *         - weight
 *         - gender
 *         - activity_factor
 *         - main_goal
 *         - favorite_muscular_group
 *         - training_place
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
 *         main_goal: perder grasa
 *         favorite_muscular_group: Pecho
 *         training_place: gym
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
 *     get-forms-questions:
 *       type: object
 *       required:
 *         - user_id
 *       params:
 *         user_id:
 *           type: number
 *           description: Id de usuario
 *       example:
 *         user_id: 12
 *
 *     get-forms-response:
 *       type: object
 *       required:
 *         - message
 *         - error
 *         - data
 *       properties:
 *         message:
 *           type: string
 *           description: Formularios para el usuario con ID [user_id] obtenidos exitosamente
 *         error:
 *           type: boolean
 *           description: si hubo un error
 *         data:
 *           type: Array
 *           description: datos de respuesta
 *       example:
 *         message: Formularios para el usuario con ID 12 obtenidos exitosamente
 *         error: false
 *         data: [{user_id: 12, height: 1.70, age: 28, weight: 180, gender: "Masculino",activity_factor: "Mucho xd",goal: "perder grasa",hours_per_day: 1,injury: "No",pathology: "Ninguna",food: "todos",meals_per_day: 3,foods_not_consumed: "Ninguno",illness: "No"}]
 *
 *     create-forms-response:
 *       type: object
 *       required:
 *         - message
 *         - error
 *         - data
 *       properties:
 *         message:
 *           type: string
 *           description: Formularios para el usuario con ID [user_id] obtenidos exitosamente
 *         error:
 *           type: boolean
 *           description: si hubo un error
 *         data:
 *           type: Array
 *           description: datos de respuesta
 *       example:
 *         message: Formulario creado exitosamente
 *         error: false
 *         date": "2025-05-06T02:06:38.732Z"
 *         formulario_id: 3
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
 * /api/user :
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
 *             $ref: '#/components/schemas/create-forms-questions'
 *     responses:
 *       200:
 *         description: Objeto con informacion.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/create-forms-response'
 *
 * /api/forms/{user_id} :
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
 *             $ref: '#/components/schemas/get-forms-questions'
 *     responses:
 *       200:
 *         description: Objeto con informacion.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/get-forms-response'
 *
 */

router.post(
  "/",
  verifyToken,
  validateHandler(createFormsDto, "body"),
  createforms
);
router.get(
  "/:user_id",
  verifyToken,
  validateHandler(getFormsDto, "params"),
  getFormsByUserId
);
