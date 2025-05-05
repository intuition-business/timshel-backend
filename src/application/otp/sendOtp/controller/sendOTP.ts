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
  const { email, phonenumber, name = "" } = req?.body || {};

  const otp = generateOTPEmail(6);
  let response;
  const otpData: ICreateAuth = {
    name,
    usuario_id: 0,
    entrenador_id: 0,
    email,
    code: otp,
    telefono: phonenumber,
    id_apple: 0,
    tipo_login: "email",
    fecha_creacion: created_at,
    fecha_expiracion: expires_at,
    isUsed: 1,
  };

  if (email) {
    try {
      response = await sendWithEmail(email, otp, name);
      const thereIsUser: any = await services.findByEmail(email);
      const createDB = await services.create(otpData, thereIsUser);
      if (createDB.ok && !response.error) {
        res?.status(200).json({ ...response, user_id: createDB?.user_id });
        return;
      }

      res.status(500).json({
        message: "Ocurrio un error",
        error: true,
        date,
      });

      res?.status(400).json(response);
    } catch (error) {
      console.log("Error: ", error);
      next(error);
    }
  }

  if (phonenumber) {
    try {
      response = await sendWithPhonenumber(phonenumber, otp, name);
      const thereIsUser: any = await services.findByPhone(phonenumber);
      const createDB = await services.create(otpData, thereIsUser);
      if (createDB.ok && !response.error) {
        res?.status(200).json({ ...response, user_id: createDB?.user_id });
        return;
      }

      res.status(500).json({
        message: "Ocurrio un error",
        error: true,
        date,
      });
    } catch (error) {
      console.log("Error: ", error);
      next(error);
    }
  }

  res.status(400).json({
    message: "Se requiere email o número de teléfono",
    error: true,
    date,
  });
};
