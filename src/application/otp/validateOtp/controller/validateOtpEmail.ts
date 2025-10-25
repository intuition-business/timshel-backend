import { NextFunction } from "express";
import OtpService from "../../services";
import jwt from "jsonwebtoken";
import { SECRET } from "../../../../config";

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

    const dataForValidate: any = await services.findByEmail(email);
    console.log(dataForValidate);
    if (!dataForValidate) {
      response.message = "Ocurrio un error.";
      response.error = true;
      response.status = 500;
    }
    const { fecha_expiracion, auth_id, code, rol } = dataForValidate[0] || {};
    if (Date.now() >= Number(fecha_expiracion)) {
      const remove = await services.removeOtp(auth_id);
      if (remove) {
        response.message = "Tu codigo de verificacion ha expirado.";
        response.error = true;
        response.status = 400;
        return response;
      }
    }

    if (otp !== code) {
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
    //const expiresToken = { expiresIn: '1h' }
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
