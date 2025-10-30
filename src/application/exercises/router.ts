import { Router } from "express";
import {
  createExercise,
  getAllExercises,
  getExercisesByCategory,
  updateExercise,
  deleteExercise,
  uploadExerciseMedia,
} from "./controller";
import { verifyToken } from "../../middleware/jwtVerify";  // Middleware para verificar el token

const router = Router();

// Función para manejar errores asíncronos
function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Ruta POST para crear un ejercicio (con upload de video y thumbnail)
router.post(
  "/create",
  verifyToken,  // Verificación de token
  uploadExerciseMedia.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),  // Middleware para manejar uploads
  asyncHandler(createExercise)  // Llama a la función del controlador
);

// Ruta GET para obtener todos los ejercicios
router.get(
  "/all",
  verifyToken,  // Verificación de token
  asyncHandler(getAllExercises)  // Llama al controlador para obtener todos los ejercicios
);

// Ruta GET para obtener ejercicios por categoría (usando query param ?category=...)
router.get(
  "/by-category",
  verifyToken,  // Verificación de token
  asyncHandler(getExercisesByCategory)  // Llama al controlador para obtener ejercicios por categoría
);

// Ruta PUT para actualizar un ejercicio (con upload de video y thumbnail)
router.put(
  "/update",
  verifyToken,  // Verificación de token
  uploadExerciseMedia.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),  // Middleware para manejar uploads
  asyncHandler(updateExercise)  // Llama al controlador para actualizar el ejercicio
);

// Ruta DELETE para eliminar un ejercicio
router.delete(
  "/delete",
  verifyToken,  // Verificación de token
  asyncHandler(deleteExercise)  // Llama al controlador para eliminar el ejercicio
);

export default router;