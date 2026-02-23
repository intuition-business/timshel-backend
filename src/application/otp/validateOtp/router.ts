import { Router } from "express";
import { validateHandler } from "./../../../middleware";
import { validateOtpDto } from "../dto";
import { validateOtp } from "./controller/validateOtp";
import { verifyToken } from "../../../middleware/jwtVerify";
import { deleteAccount } from "./controller/accountController";

const router = Router();

// Función para manejar errores asíncronos (muy buena práctica)
function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}


router.post(
  "/",
  validateHandler(validateOtpDto, "body"),
  validateOtp
);

router.delete("/delete", verifyToken, asyncHandler(deleteAccount));

export default router;