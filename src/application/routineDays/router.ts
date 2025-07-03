import { Router } from "express";
import {
  createRoutine,
  getRoutineByUserId,
  updateRoutineDayStatus,
  deleteRoutineDay,
} from "./controller";  // Importamos los controladores de rutina
import { verifyToken } from "../../middleware/jwtVerify";  // Middleware para verificar el token

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
  asyncHandler(createRoutine)
);

// Ruta GET para obtener la rutina de un usuario por su ID
router.get(
  "/:user_id",
  verifyToken,
  asyncHandler(getRoutineByUserId)
);

// Ruta PUT para actualizar el estado de un día (completado o pendiente)
router.put(
  "/update-status",
  verifyToken,
  asyncHandler(updateRoutineDayStatus)
);

// Ruta DELETE para eliminar un día de la rutina
router.delete(
  "/delete",
  verifyToken,
  asyncHandler(deleteRoutineDay)
);

export default router;
