import { Router } from "express";
import {
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan,
} from "./controlles"; // corrige "controlles" → "controllers" si es el nombre real
import { verifyToken } from "../../middleware/jwtVerify";

const router = Router();

// Función para manejar errores asíncronos (muy buena práctica)
function asyncHandler(fn: any) {
    return function (req: any, res: any, next: any) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Rutas RESTful estándar
router.post("/create", verifyToken, asyncHandler(createPlan));
router.get("/", verifyToken, asyncHandler(getPlans));
router.get("/:id", verifyToken, asyncHandler(getPlanById));
router.put("/update/:id", verifyToken, asyncHandler(updatePlan));
router.delete("/delete/:id", verifyToken, asyncHandler(deletePlan));

export default router;