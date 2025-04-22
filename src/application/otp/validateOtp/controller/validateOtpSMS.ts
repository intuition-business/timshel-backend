import { NextFunction } from "express";
import OtpService from "../../services";

export const validateOtpSMS = async (
  otp: number,
  phone: string,
  next: NextFunction
) => {
  try {
    const date = new Date();
    const response = { message: "", error: false, date, status: 200 };
    const services = new OtpService();

    const dataForValidate: any = await services.findOtpByPhonenumber(phone);
    if (!dataForValidate) {
    }
    const { expires_at } = dataForValidate || {};
    if (Date.now() >= expires_at) {
      const remove = await services.remove(dataForValidate?._id);
      if (remove) {
        response.message = "Tu codigo de verificacion ha expirado.";
        response.error = true;
        response.status = 400;
        return response;
      }
    }
    console.log("GGGGG", { dataForValidate });
    if (otp !== dataForValidate?.otp) {
      response.message = "Tu codigo de verificacion no coincide.";
      response.error = true;
      response.status = 400;

      return response;
    }

    response.message = "Ah sido verificado con exito.";
    response.error = false;
    response.status = 200;
    return response;
  } catch (error) {
    next(error);
  }
};
