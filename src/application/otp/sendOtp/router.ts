import { Router } from "express";
import { validateHandler } from "./../../../middleware";
import { sendOtpDto } from "../dto";
import { sendOTP } from "./controller/sendOTP";
//import { verifyToken } from "../../../middleware/authJwt";

const router = Router();

router.post(
  "/",
  //verifyToken,
  validateHandler(sendOtpDto, "body"),
  sendOTP
);

export default router;
