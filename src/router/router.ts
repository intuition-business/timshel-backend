import { Application } from "express";
import { Path as path } from "./paths";
import { sendOtpRouter } from "./../application/otp/sendOtp";
import { registerRouter } from "./../application/register";
import { trainerRouter } from "../application/gymtrainer";
import { planRouter } from "../application/plans";
import { loginRouter } from "../application/login";
import { validateOTPRouter } from "../application/otp/validateOtp";
import { GoogleRouter } from "../application/google";
import { userRouter } from "../application/forms";
import { routinesRouter } from "../application/routines";
import { weightRouter } from "../application/weight";
import { profileRouter } from "../application/profile";
import { warmUpRouter } from "../application/warm-ups";
import { routineRouter } from "../application/routineDays";
import { specialCaseRouter } from "../application/specialCase";
import { exerciseRouter } from "../application/exercises";

const { sendOtp, validateOtp, register, login, google, user, getRoutines, trainers, profile, routineDays, specialCases, routineExercises, weight, warmUps, plans } =
  path;

const router = (app: Application) => {
  app.use(sendOtp, sendOtpRouter);
  app.use(register, registerRouter);
  app.use(login, loginRouter);
  app.use(google, GoogleRouter);
  app.use(user, userRouter);
  app.use(trainers, trainerRouter);
  app.use(plans, planRouter);

  // app.use(validateData, validateData);
  app.use(validateOtp, validateOTPRouter);
  app.use(getRoutines, routinesRouter);
  app.use(profile, profileRouter);
  app.use(routineDays, routineRouter);
  app.use(weight, weightRouter);
  app.use(specialCases, specialCaseRouter);
  app.use(routineExercises, exerciseRouter);
  app.use(warmUps, warmUpRouter);

};

export default router;
