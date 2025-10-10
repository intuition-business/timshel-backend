import { Request, Response, NextFunction } from "express";
import { sendWithEmail } from "./sendWithEmail";
import { sendWithPhonenumber } from "./sendWithPhonenumber";
import { generateOTPEmail } from "./generateOTP";
import OtpService from "../../services";
import { ICreateAuth } from "../types";

export const sendOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const date = new Date();
  const OTP_EXPIRATION_TIME = 600000;
  const services = new OtpService();
  const created_at = Date.now();
  const expires_at = Date.now() + OTP_EXPIRATION_TIME;
  const { email, phonenumber, name = "", platform } = req?.body || {};

  // Hacer 'platform' opcional: si no se proporciona, asumir "mobile"
  let effectivePlatform = platform || "mobile";

  // Validar si se proporciona un valor inválido
  if (platform && !["mobile", "web"].includes(platform)) {
    res.status(400).json({
      message: "Platform inválido (debe ser mobile o web)",
      error: true,
      date,
    });
    return;
  }

  const otp = generateOTPEmail(6);
  let response;
  const otpData: ICreateAuth = {
    name: name !== undefined ? name : null,
    usuario_id: 0,
    entrenador_id: 0,
    email: email !== undefined ? email : null,
    code: otp,
    telefono: phonenumber !== undefined ? phonenumber : null,
    id_apple: 0,
    tipo_login: "email",
    fecha_creacion: created_at,
    fecha_expiracion: expires_at,
    isUsed: 1,
  };

  if (email !== undefined) {
    otpData.tipo_login = "email";
    try {
      // Buscar usuario existente
      const thereIsUser: any = await services.findByEmail(email);

      // Validación: si es web, verificar si es entrenador
      if (effectivePlatform === "web") {
        if (!thereIsUser || thereIsUser.rol !== "entrenador") { // Ajusta 'rol' según tu modelo (ej. if (thereIsUser.entrenador_id === 0))
          res.status(403).json({
            message: "Acceso denegado: Solo entrenadores pueden acceder al dashboard web",
            error: true,
            date,
          });
          return;
        }
      }

      response = await sendWithEmail(email, otp, name);
      if (!response.error) {
        const createDB = await services.create(otpData, thereIsUser);
        res.status(200).json({ ...response, user_id: createDB?.user_id });
        return;
      }

      res.status(500).json({
        message: "Ocurrio un error",
        error: true,
        date,
      });
      return;
    } catch (error) {
      console.log("Error: ", error);
      next(error);
      return;
    }
  }

  if (phonenumber !== undefined) {
    otpData.tipo_login = "phone";
    try {
      // Buscar usuario existente
      const thereIsUser: any = await services.findByPhone(phonenumber);

      // Validación: si es web, verificar si es entrenador
      if (effectivePlatform === "web") {
        if (!thereIsUser || thereIsUser.rol !== "entrenador") { // Ajusta 'rol' según tu modelo
          res.status(403).json({
            message: "Acceso denegado: Solo entrenadores pueden acceder al dashboard web",
            error: true,
            date,
          });
          return;
        }
      }

      response = await sendWithPhonenumber(phonenumber, otp, name);
      if (!response.error) {
        const createDB = await services.create(otpData, thereIsUser);
        res.status(200).json({ ...response, user_id: createDB?.user_id });
        return;
      }

      res.status(500).json({
        message: "Ocurrio un error",
        error: true,
        date,
      });
      return;
    } catch (error) {
      console.log("Error: ", error);
      next(error);
      return;
    }
  }

  res.status(400).json({
    message: "Se requiere email o número de teléfono",
    error: true,
    date,
  });
  return;
};