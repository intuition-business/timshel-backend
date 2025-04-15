import { Application } from "express";
import { Path as path } from "./paths";
import { sendOtpRouter } from "./../application/otp/sendOtp";
import { registerRouter } from "./../application/register";
const { sendOtp, validateData, validateOtp, register } = path;

const router = (app: Application) => {
  app.use(sendOtp, sendOtpRouter);
  app.use(register, registerRouter);
  // app.use(validateData, validateData);
  // app.use(validateOtp, validateOtp);
};

export default router;
