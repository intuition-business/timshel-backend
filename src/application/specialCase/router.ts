import { Router } from "express";
import {
  generateLightRoutine,
} from "./controller";
import { verifyToken } from "../../middleware/jwtVerify";

const router = Router();

// Función para manejar errores asíncronos
function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Ruta POST para crear una rutina
router.post(
  "/create",
  verifyToken,
  asyncHandler(generateLightRoutine)
);

export default router;
