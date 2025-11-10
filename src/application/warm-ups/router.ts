// src/warmups/router.ts
import { Router } from "express";
import {
  createWarmUp,
  getWarmUps,
  updateWarmUp,
  deleteWarmUp,
} from "./controller";
import { verifyToken } from "../../middleware/jwtVerify";

// Middleware para capturar errores asíncronos (excelente práctica)
const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const router = Router();

// POST   /api/warmups          → Crear (con video + thumbnail)
router.post("/", verifyToken, asyncHandler(createWarmUp));

// GET    /api/warmups          → Todos o con ?length=5&random=true
router.get("/", verifyToken, asyncHandler(getWarmUps));

// PUT    /api/warmups/:id      → Actualizar (parcial, con reemplazo de archivos)
router.put("/:id", verifyToken, asyncHandler(updateWarmUp));

// DELETE /api/warmups/:id      → Eliminar (con borrado de S3)
router.delete("/:id", verifyToken, asyncHandler(deleteWarmUp));

export default router;