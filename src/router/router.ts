import { Application } from "express";
import { Path as path } from "./paths";
import { sendOtpRouter } from "./../application/otp/sendOtp";
import { registerRouter } from "./../application/register";
import { loginRouter } from "../application/login";
import { validateOTPRouter } from "../application/otp/validateOtp";

const { sendOtp, validateData, validateOtp, register, login } = path;

const router = (app: Application) => {
  app.use(sendOtp, sendOtpRouter);
  app.use(register, registerRouter);
  app.use(login, loginRouter);
  // app.use(validateData, validateData);
  app.use(validateOtp, validateOTPRouter);
};

export default router;
