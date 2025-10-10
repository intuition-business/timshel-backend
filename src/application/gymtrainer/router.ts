// router.ts for trainers
import { Router } from "express";
import {
  createTrainer,
  getTrainers,
  updateTrainer,
  deleteTrainer,
  assignUser,
  getTrainerById,
} from "./controller";  // Importamos los controladores de trainers
import { verifyToken } from "../../middleware/jwtVerify";  // Middleware para verificar el token

const router = Router();

// Función para manejar errores asíncronos
function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Ruta POST para crear un entrenador
router.post(
  "/create",
  verifyToken,
  asyncHandler(createTrainer)
);

// Ruta GET para obtener entrenadores (con query params)
router.get(
  "/",
  verifyToken,
  asyncHandler(getTrainers)
);

// Ruta GET para obtener un entrenador por ID
router.get(
  "/:id",
  verifyToken,
  asyncHandler(getTrainerById)
);

// Ruta PUT para actualizar un entrenador
router.put(
  "/update",
  verifyToken,
  asyncHandler(updateTrainer)
);

// Ruta DELETE para eliminar un entrenador
router.delete(
  "/delete",
  verifyToken,
  asyncHandler(deleteTrainer)
);

// Ruta POST para asignar un usuario a un entrenador
router.post(
  "/assign",
  verifyToken,
  asyncHandler(assignUser)
);

export default router;