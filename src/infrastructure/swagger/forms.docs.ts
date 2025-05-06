import {
  createforms,
  getFormsByUserId,
} from "../../application/forms/controller";

import { Router } from "express";
import { validateHandler } from "../../middleware";
import { sendOtpDto } from "../../application/otp/dto";
import { sendOTP } from "../../application/otp/sendOtp/controller/sendOTP";
import { createFormsDto } from "../../application/forms/dto";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     create-forms-questions:
 *       type: object
 *       required:
 *         - user_id
 *         - height
 *         - age
 *         - weight
 *         - gender
 *         - activity_factor
 *         - goal
 *         - availability
 *         - hours_per_day
 *         - injury
 *         - pathology
 *         - food
 *         - meals_per_day
 *         - foods_not_consumed
 *         - illness
 *       properties:
 *         email:
 *           type: number
 *           description: Id de usuario
 *         height:
 *           type: double
 *           description: Estatura de usuario
 *         age:
 *           type: number
 *           description: Edad de usuario
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
 *         availability:
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
 *         food:
 *           type: string
 *           description: Alimentos de usuario
 *         meals_per_day:
 *           type: number
 *           description: Comidas por dia de usuario
 *         foods_not_consumed:
 *           type: string
 *           description: Alimentos no consumidos por el usuario
 *         illness:
 *           type: string
 *           description: Enfermedades de usuario
 *       example:
 *         user_id: 12
 *         height: 1.70
 *         age: 28
 *         weight: 180
 *         gender: Masculino
 *         factor_actividad: Mucho xd
 *         goal: perder grasa
 *         availability: 7 dias
 *         hours_per_day: 1
 *         injury: No
 *         pathology: Nunguna
 *         food: Todos
 *         meals_per_day: 3
 *         foods_not_consumed: Ninguno
 *         illness: No
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
 *         data: [{user_id: 12, height: 1.70, age: 28, weight: 180, gender: "Masculino",activity_factor: "Mucho xd",goal: "perder grasa",availability: "7 dias",hours_per_day: 1,injury: "No",pathology: "Ninguna",food: "todos",meals_per_day: 3,foods_not_consumed: "Ninguno",illness: "No"}]
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
 * /api/forms :
 *   post:
 *     summary: retorna unos datos
 *     tags: [Timshell]
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
 * /api/forms/:user_id :
 *   get:
 *     summary: retorna unos datos
 *     tags: [Timshell]
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

router.post("/forms", validateHandler(createFormsDto, "body"), createforms);

router.get(
  "/:usuario_id",
  validateHandler(createFormsDto, "body"),
  getFormsByUserId
);
