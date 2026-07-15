// router.ts for users
import { Router } from "express";
import {
  getUsers,
  assignTrainer,
  getPayments,
  getDashboardStats,
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

// Ruta POST para asignar entrenador y opcionalmente crear período
router.post(
  "/assign-trainer",
  verifyToken,
  asyncHandler(assignTrainer)
);

// Historial de pagos con filtros
router.get(
  "/payments",
  verifyToken,
  asyncHandler(getPayments)
);

// Stats del dashboard (stats + movimiento + entrenadores + ingresos + planes)
router.get(
  "/dashboard",
  verifyToken,
  asyncHandler(getDashboardStats)
);

export default router;