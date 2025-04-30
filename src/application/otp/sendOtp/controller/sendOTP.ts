import { Request, Response, NextFunction } from "express";
import { sendWithEmail } from "./sendWithEmail";
import { sendWithPhonenumber } from "./sendWithPhonenumber";
import { generateOTPSmS, generateOTPEmail } from "./generateOTP";
import OtpService from "../../services";
import { ICreateAuth } from "../types";

export const sendOTP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const OTP_EXPIRATION_TIME = 600000;
  const services = new OtpService();
  const created_at = Date.now();
  const expires_at = Date.now() + OTP_EXPIRATION_TIME;
  const { email, phonenumber, name } = req?.body || {};
  try {
    if (email) {
      const otp = generateOTPEmail(6);
      const response: any = await sendWithEmail(email, name, otp);

      if (!response.error) {
        const otpData: ICreateAuth = {
          usuario_id: 0,
          entrenador_id: 0,
          email,
          code: otp,
          telefono: "",
          id_apple: 0,
          tipo_login: "email",
          fecha_creacion: created_at,
          fecha_expiracion: expires_at,
          isUsed: 1,
        };
        const thereIsUser: any = await services.findByEmail(email);

        await services.create(otpData, thereIsUser);
        res?.status(200).json(response);
      }
      res?.status(400).json(response);
    }

    if (phonenumber) {
      const otp = generateOTPSmS(6);
      const response = await sendWithPhonenumber(phonenumber, name, otp);

      if (!response.error) {
        const otpData: ICreateAuth = {
          usuario_id: 0,
          entrenador_id: 0,
          email: "",
          code: otp,
          telefono: phonenumber,
          id_apple: 0,
          tipo_login: "telefono",
          fecha_creacion: created_at,
          fecha_expiracion: expires_at,
          isUsed: 1,
        };
        const thereIsUser: any = await services.findByPhone(phonenumber);

        await services.create(otpData, thereIsUser);
        res?.status(200).json(response);
      }
      res?.status(400).json(response);
    }
  } catch (error) {
    console.log("Error: ", error);
    next(error);
  }
};
