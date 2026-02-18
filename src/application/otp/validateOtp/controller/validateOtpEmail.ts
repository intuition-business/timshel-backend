import { NextFunction } from "express";
import OtpService from "../../services";
import jwt from "jsonwebtoken";
import { SECRET } from "../../../../config";

// Config para review (agrega esto arriba)
const REVIEW_EMAIL = "timshel7@yopmail.com"; // ← El email de review
const FIXED_OTP = "723841"; // ← El OTP fijo de BD para review

export const validateOtpEmail = async (
  email: string,
  otp: string,
  next: NextFunction
) => {
  try {
    const date = new Date();
    const response = {
      message: "",
      error: false,
      date,
      status: 200,
      token: "",
    };
    const services = new OtpService();

    // === Lógica de bypass para review ===
    if (email === REVIEW_EMAIL && otp === FIXED_OTP) {
      const dataForValidate: any = await services.findByEmail(email); // Busca para obtener IDs
      const { auth_id, rol } = dataForValidate[0] || {};

      const payload = {
        userId: auth_id || "58",
        email,
        role: rol || 'user',
      };
      const token = jwt.sign(payload, SECRET);

      response.message = "OTP de prueba válido. Acceso concedido";
      response.error = false;
      response.status = 200;
      response.token = token;
      return { ...response, user_id: auth_id };
    }
    // === Fin de bypass ===

    const dataForValidate: any = await services.findByEmail(email);
    console.log("dataForValidate: ", dataForValidate);
    console.log("OTP enviado: ", otp, "Type: ", typeof otp);
    console.log("OTP en BD: ", dataForValidate[0]?.code, "Type: ", typeof dataForValidate[0]?.code);

    if (!dataForValidate) {
      response.message = "Ocurrio un error.";
      response.error = true;
      response.status = 500;
    }
    const { fecha_expiracion, auth_id, code, rol, isUsed } = dataForValidate[0] || {};
    if (Date.now() >= Number(fecha_expiracion)) {
      // Comentado: No borrar, solo error
      // const remove = await services.removeOtp(auth_id);
      // if (remove) {
      response.message = "Tu codigo de verificacion ha expirado.";
      response.error = true;
      response.status = 400;
      return response;
      // }
    }

    // Chequeo de isUsed (agregado para error explícito)
    if (isUsed === 1) {
      response.message = "OTP ya usado.";
      response.error = true;
      response.status = 400;
      return response;
    }

    // Fix: Convierte a string para comparar
    if (String(otp) !== String(code)) {
      response.message = "Tu codigo de verificacion no coincide.";
      response.error = true;
      response.status = 400;
      return response;
    }

    const payload = {
      userId: auth_id,
      email,
      role: rol || 'user',
    };
    const token = jwt.sign(payload, SECRET);

    response.message = "Ah sido verificado con exito.";
    response.error = false;
    response.status = 200;
    response.token = token;
    return { ...response, user_id: dataForValidate[0]?.auth_id };
  } catch (error) {
    next(error);
  }
};