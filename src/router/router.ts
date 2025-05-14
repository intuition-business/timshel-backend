import { Application } from "express";
import { Path as path } from "./paths";
import { sendOtpRouter } from "./../application/otp/sendOtp";
import { registerRouter } from "./../application/register";
import { loginRouter } from "../application/login";
import { validateOTPRouter } from "../application/otp/validateOtp";
import { GoogleRouter } from "../application/google";
import { formRouter } from "../application/forms";
import { routinesRouter } from "../application/routines";

const { sendOtp, validateOtp, register, login, google, forms, getRoutines } =
  path;

const router = (app: Application) => {
  app.use(sendOtp, sendOtpRouter);
  app.use(register, registerRouter);
  app.use(login, loginRouter);
  app.use(google, GoogleRouter);
  app.use(forms, formRouter);
  // app.use(validateData, validateData);
  app.use(validateOtp, validateOTPRouter);
  app.use(getRoutines, routinesRouter);
};

export default router;
