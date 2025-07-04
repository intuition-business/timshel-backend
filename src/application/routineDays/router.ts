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
  verifyToken,  // Verificación de token
  asyncHandler(createRoutine)  // Llama a la función del controlador
);

// Ruta GET para obtener la rutina del usuario
// Este controlador no necesita el user_id en la URL, ya que se obtiene del token
router.get(
  "/",
  verifyToken,  // Verificación de token
  asyncHandler(getRoutineByUserId)  // Llama al controlador para obtener la rutina
);

// Ruta PUT para actualizar el estado de un día (completado o pendiente)
router.put(
  "/update-status",
  verifyToken,  // Verificación de token
  asyncHandler(updateRoutineDayStatus)  // Llama al controlador para actualizar el estado del día
);

// Ruta DELETE para eliminar un día de la rutina
router.delete(
  "/delete",
  verifyToken,  // Verificación de token
  asyncHandler(deleteRoutineDay)  // Llama al controlador para eliminar el día
);

export default router;
