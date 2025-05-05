import { Router } from "express";
import { validateHandler } from "../../middleware";
import { sendOtpDto } from "../../application/otp/dto";
import { sendOTP } from "../../application/otp/sendOtp/controller/sendOTP";

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     send-otp-email:
 *       type: object
 *       required:
 *         - email
 *       properties:
 *         email:
 *           type: string
 *           description: Email al que se le va a enviar un OTP
 *         name:
 *           type: string
 *           description: Nombre usuario (opcional)
 *       example:
 *         name: Luke Skywalker
 *         email: "gelvezz223@gmail.com"
 *
 *     send-otp-sms:
 *       type: object
 *       required:
 *         - phonenumber
 *       properties:
 *         name:
 *           type: string
 *           description: Nombre usuario (opcional)
 *         phonenumber:
 *           type: string
 *           description: Numero al que se le va a enviar un OTP
 *       example:
 *         name: Luke Skywalker
 *         phonenumber: "+573114831157"
 *
 *     send-otp-response:
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
 *           description: mensaje enviado
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
 *         message: Mensaje enviado
 *         error: false
 *         code: 123456
 *         date: "2025-04-30T21:07:19.269Z"
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
 * /api/send-otp email:
 *   post:
 *     summary: retorna unos datos
 *     tags: [Timshell]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/send-otp-email'
 *     responses:
 *       200:
 *         description: Objeto con informacion.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/send-otp-response'
 *
 * /api/send-otp sms:
 *   post:
 *     summary: retorna unos datos
 *     tags: [Timshell]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/send-otp-sms'
 *     responses:
 *       200:
 *         description: Objeto con informacion.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/send-otp-response'
 *
 */
router.post("/api/send-otp", validateHandler(sendOtpDto, "body"), sendOTP);
