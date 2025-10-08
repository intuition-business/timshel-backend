// router.ts for warm-ups
import { Router } from "express";
import {
  createWarmUp,
  getWarmUps,
  updateWarmUp,
  deleteWarmUp,
} from "./controller";  // Importamos los controladores de warm-ups
import { verifyToken } from "../../middleware/jwtVerify";  // Middleware para verificar el token

const router = Router();

// Función para manejar errores asíncronos
function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Ruta POST para crear un ejercicio de calentamiento
router.post(
  "/create",
  verifyToken,
  asyncHandler(createWarmUp)
);

// Ruta GET para obtener ejercicios de calentamiento (con query params)
router.get(
  "/",
  verifyToken,
  asyncHandler(getWarmUps)
);

// Ruta PUT para actualizar un ejercicio de calentamiento
router.put(
  "/update",
  verifyToken,
  asyncHandler(updateWarmUp)
);

// Ruta DELETE para eliminar un ejercicio de calentamiento
router.delete(
  "/delete",
  verifyToken,
  asyncHandler(deleteWarmUp)
);

export default router;