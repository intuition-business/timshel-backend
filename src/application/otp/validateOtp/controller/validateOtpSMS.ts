import { NextFunction } from "express";
import OtpService from "../../services";
import jwt from "jsonwebtoken";
import { SECRET } from "../../../../config";

export const validateOtpSMS = async (
  otp: string,
  phone: string,
  next: NextFunction
) => {
  const now = new Date();
  const response = {
    message: "",
    error: false,
    date: now.toISOString(),
    status: 200,
    token: "",
  };

  try {
    const services = new OtpService();

    console.log("[validateOtpSMS] Iniciando validación", { phone, otpReceived: otp });

    const dataForValidate = await services.findByPhone(phone);

    if (!Array.isArray(dataForValidate) || dataForValidate.length === 0) {
      response.message = "No se encontró código de verificación para este número.";
      response.error = true;
      response.status = 404;
      return response;
    }

    const record = dataForValidate[0] as any;

    const otpRecibido = (otp || "").trim();
    const otpEnBD = String(record.code || "").trim();

    // Expiración del OTP (no del token)
    if (Date.now() >= Number(record.fecha_expiracion)) {
      response.message = "Tu código de verificación ha expirado. Solicita uno nuevo.";
      response.error = true;
      response.status = 400;
      return response;
    }

    if (record.isUsed === 1) {
      response.message = "Este código ya fue utilizado. Solicita uno nuevo.";
      response.error = true;
      response.status = 400;
      return response;
    }

    if (otpRecibido !== otpEnBD) {
      response.message = "El código de verificación no coincide.";
      response.error = true;
      response.status = 400;
      return response;
    }

    // ── Éxito ──
    const payload = {
      userId: record.auth_id,
      phone,
      role: record.rol || "user",
    };

    // Token SIN expiración (como en tu validateOtpEmail actual)
    const token = jwt.sign(payload, SECRET);
    // Si más adelante quieres expiración larga: { expiresIn: "30d" }

    response.message = "Has sido verificado con éxito.";
    response.error = false;
    response.status = 200;
    response.token = token;

    // Opcional: marcar como usado
    // await services.markOtpAsUsed(record.auth_id);

    return { ...response, user_id: record.auth_id };

  } catch (error) {
    console.error("[validateOtpSMS] Error:", error);
    next(error);
    return {
      message: "Ocurrió un error al validar el código. Intenta nuevamente.",
      error: true,
      status: 500,
      date: now.toISOString(),
      token: "",
    };
  }
};