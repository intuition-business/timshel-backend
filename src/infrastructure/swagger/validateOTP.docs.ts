import { Router } from "express";
import { validateHandler } from "../../middleware";
import { validateOtpDto } from "../../application/otp/dto";
import { validateOtp } from "../../application/otp/validateOtp/controller/validateOtp";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     validate-otp-email:
 *       type: object
 *       required:
 *         - email
 *         - otp
 *       properties:
 *         email:
 *           type: string
 *           description: Email al que se le va a enviar un OTP
 *         otp:
 *           type: number
 *           description: OTP de validacion.
 *       example:
 *         email: "gelvezz223@gmail.com"
 *         otp: 504035
 *
 *     validate-otp-sms:
 *       type: object
 *       required:
 *         - phonenumber
 *         - otp
 *       properties:
 *         phonenumber:
 *           type: string
 *           description: Numero al que se le va a enviar un OTP
 *         otp:
 *           type: number
 *           description: OTP de validacion.
 *       example:
 *         phonenumber: "+573114831157"
 *         otp: 504035
 *
 *     validate-otp-response:
 *       type: object
 *       required:
 *         - message
 *         - error
 *         - code
 *         - date
 *         - user_id
 *       properties:
 *         message:
 *           type: string
 *           description: Ah sido verificado con exito.
 *         error:
 *           type: boolean
 *           description: si hubo un error
 *         code:
 *           type: number
 *           description: Otp enviado
 *         date:
 *           type: date
 *           description: fecha
 *         user_id:
 *           type: number
 *           description: id del usuario
 *       example:
 *         message: Ah sido verificado con exito.
 *         error: false
 *         date: "2025-04-30T21:07:19.269Z"
 *         status: 200
 *         user_id: 12
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
 * /api/validate-otp email:
 *   post:
 *     summary: retorna unos datos
 *     tags: [Timshell]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/validate-otp-email'
 *     responses:
 *       200:
 *         description: Objeto con informacion.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/validate-otp-response'
 *
 * /api/validate-otp sms:
 *   post:
 *     summary: retorna unos datos
 *     tags: [Timshell]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/validate-otp-sms'
 *     responses:
 *       200:
 *         description: Objeto con informacion.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/validate-otp-response'
 *
 */

router.post(
  "/api/validate-otp",
  validateHandler(validateOtpDto, "body"),
  validateOtp
);
