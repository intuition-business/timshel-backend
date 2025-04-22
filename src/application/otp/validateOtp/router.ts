import { Router } from "express";
import { validateHandler } from "./../../../middleware";
import { validateOtpDto } from "../dto";
import { validateOtp } from "./controller/validateOtp";
//import { verifyToken } from "../../../middleware/authJwt";

const router = Router();

router.post(
  "/",
  //verifyToken,
  validateHandler(validateOtpDto, "body"),
  validateOtp
);

export default router;
