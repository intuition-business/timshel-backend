import { Router } from "express";
import {
  createExercise,
  getAllExercises,
  getExercisesByCategory,
  updateExercise,
  deleteExercise,
  uploadExerciseMedia,
} from "./controller";
import { verifyToken } from "../../middleware/jwtVerify";

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
  verifyToken,
  uploadExerciseMedia.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),  // Middleware para manejar uploads
  asyncHandler(createExercise)
);

// Ruta GET para obtener todos los ejercicios
router.get(
  "/all",
  verifyToken,
  asyncHandler(getAllExercises)
);

// Ruta GET para obtener ejercicios por categoría (usando query param ?category=...)
router.get(
  "/by-category",
  verifyToken,
  asyncHandler(getExercisesByCategory)
);

// Ruta PATCH para actualizar un ejercicio, incluyendo el ID
router.patch(
  "/update/:id",
  verifyToken,
  uploadExerciseMedia.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),  // Middleware para manejar uploads
  asyncHandler(updateExercise)
);
// Ruta DELETE para eliminar un ejercicio
router.delete(
  "/delete/:id",
  verifyToken,
  asyncHandler(deleteExercise)
);

export default router;