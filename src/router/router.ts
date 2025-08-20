import { Application } from "express";
import { Path as path } from "./paths";
import { sendOtpRouter } from "./../application/otp/sendOtp";
import { registerRouter } from "./../application/register";
import { loginRouter } from "../application/login";
import { validateOTPRouter } from "../application/otp/validateOtp";
import { GoogleRouter } from "../application/google";
import { formRouter } from "../application/forms";
import { routinesRouter } from "../application/routines";
import { profileRouter } from "../application/profile";
import { routineRouter } from "../application/routineDays";
import { specialCaseRouter } from "../application/specialCase";
import { exerciseRouter } from "../application/exercises";

const { sendOtp, validateOtp, register, login, google, forms, getRoutines, profile, routineDays, specialCases, routineExercises } =
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
  app.use(profile, profileRouter);
  app.use(routineDays, routineRouter);
  app.use(specialCases, specialCaseRouter);
  app.use(routineExercises, exerciseRouter);

};

export default router;
