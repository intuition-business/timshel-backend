// router.ts for users
import { Router } from "express";
import {
  getUsers,
} from "./controller";  // Importamos los controladores de users
import { verifyToken } from "../../middleware/jwtVerify";  // Middleware para verificar el token

const router = Router();

// Función para manejar errores asíncronos
function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Ruta GET para obtener usuarios (para admin, con trainer info opcional via query)
router.get(
  "/users",
  verifyToken,
  asyncHandler(getUsers)
);

export default router;