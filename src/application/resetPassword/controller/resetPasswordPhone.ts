import { NextFunction } from "express";
import OtpService from "../../otp/services";
import RegisterService from "../../register/services";

export const resetPasswordPhone = async (
  otp: number,
  phone: string,
  next: NextFunction
) => {
  try {
    const date = new Date();
    const response = { message: "", error: false, date, status: 200 };
    const services = new RegisterService();

    const userFound = await services.findByPhonenumber(phone);

    return response;
  } catch (error) {
    next(error);
  }
};
