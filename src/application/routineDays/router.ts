import { Router } from "express";
import {
  createRoutine,
  getRoutineByUserId,
  getSelectedDays,
  updateRoutineDayStatus,
  deleteRoutineDay,
  updateRoutineDays,
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
  asyncHandler(createRoutine)
);

// Ruta GET para obtener la rutina del usuario
router.get(
  "/",
  verifyToken,
  asyncHandler(getRoutineByUserId)
);

// Ruta GET para obtener solo los días de la semana configurados
router.get(
  "/selected-days",
  verifyToken,
  asyncHandler(getSelectedDays)
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

// Ruta PUT para cambiar días de entrenamiento (consume 1 generación, conserva historial)
router.put(
  "/update-days",
  verifyToken,
  asyncHandler(updateRoutineDays)
);

export default router;
