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
      const dataForValidate: any = await services.findByEmail(email);

      if (!dataForValidate || dataForValidate.length === 0) {
        response.message = "Email de revisión no encontrado en la base de datos.";
        response.error = true;
        response.status = 404;
        return response;
      }

      const user = dataForValidate[0];

      // Chequeo de cuenta eliminada también en modo review (por seguridad)
      if (user.is_deleted === 1 || user.deleted_at !== null) {
        response.message = "Esta cuenta de revisión ha sido eliminada permanentemente.";
        response.error = true;
        response.status = 403;
        return response;
      }

      const { auth_id, rol } = user;

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

    if (!dataForValidate || dataForValidate.length === 0) {
      response.message = "No se encontró cuenta asociada a este email.";
      response.error = true;
      response.status = 404;
      return response;
    }

    const user = dataForValidate[0];
    console.log("OTP en BD: ", user.code, "Type: ", typeof user.code);

    // === VALIDACIÓN DE CUENTA ELIMINADA (lo más temprano posible) ===
    if (user.is_deleted === 1 || user.deleted_at !== null) {
      response.message = "Tu cuenta ha sido eliminada permanentemente. No puedes acceder con este email.";
      response.error = true;
      response.status = 403; // Forbidden - o usa 410 si prefieres "Gone"
      return response;
    }
    // === Fin validación eliminada ===

    const { fecha_expiracion, auth_id, code, rol, isUsed } = user;

    if (Date.now() >= Number(fecha_expiracion)) {
      response.message = "Tu código de verificación ha expirado.";
      response.error = true;
      response.status = 400;
      return response;
    }

    // Chequeo de isUsed
    if (isUsed === 1) {
      response.message = "Este código OTP ya fue utilizado.";
      response.error = true;
      response.status = 400;
      return response;
    }

    // Comparación segura de OTP (string)
    if (String(otp) !== String(code)) {
      response.message = "El código de verificación no coincide.";
      response.error = true;
      response.status = 400;
      return response;
    }

    // Todo OK → generar token
    const payload = {
      userId: auth_id,
      email,
      role: rol || 'user',
    };
    const token = jwt.sign(payload, SECRET);

    response.message = "Has sido verificado con éxito.";
    response.error = false;
    response.status = 200;
    response.token = token;
    return { ...response, user_id: auth_id };

  } catch (error) {
    console.error("Error en validateOtpEmail:", error);
    next(error);
    // Opcional: retornar error genérico si no quieres exponer detalles
    return {
      message: "Ocurrió un error interno al validar el código.",
      error: true,
      status: 500,
      date: new Date(),
    };
  }
};