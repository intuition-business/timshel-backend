// router.ts for trainers
import { Router } from "express";
import {
  createTrainer,
  getTrainers,
  updateTrainer,
  deleteTrainer,
  assignUser,
  getTrainerById,
  assignUserWithPlan,
  getUserTrainerAndPlan,
} from "./controller";  // Importamos los controladores de trainers
import { verifyToken } from "../../middleware/jwtVerify";  // Middleware para verificar el token
import { uploadTrainerFiles } from "../../middleware/uploadTrainerFiles";


const router = Router();

// Función para manejar errores asíncronos (ya la tienes, la mantenemos)
function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ────────────────────────────────────────────────
// RUTAS QUE **NO** necesitan subida de archivos (sin multer)
router.get("/", verifyToken, asyncHandler(getTrainers));

router.get("/:id", verifyToken, asyncHandler(getTrainerById));

router.delete("/delete", verifyToken, asyncHandler(deleteTrainer));

router.post("/assign-user", verifyToken, asyncHandler(assignUser));

router.post("/plan-and-trainer-subscription", verifyToken, asyncHandler(assignUserWithPlan));

router.get("/user/my-trainer", verifyToken, asyncHandler(getUserTrainerAndPlan));

// ────────────────────────────────────────────────
// RUTAS QUE **SÍ** necesitan subida de archivos (con multer)

// Crear entrenador → permite subir foto (image) + múltiples certificados
router.post(
  "/create",
  verifyToken,
  uploadTrainerFiles.fields([
    { name: "image", maxCount: 1 },           // foto de perfil (opcional)
    { name: "certifications", maxCount: 10 }, // hasta 10 certificados (PDF/imagen)
  ]),
  asyncHandler(createTrainer)
);

// Actualizar entrenador → permite subir nueva foto y/o nuevos certificados (reemplaza)
router.put(
  "/update",
  verifyToken,
  uploadTrainerFiles.fields([
    { name: "image", maxCount: 1 },
    { name: "certifications", maxCount: 10 },
  ]),
  asyncHandler(updateTrainer)
);

export default router;