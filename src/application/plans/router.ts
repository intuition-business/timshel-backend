import { Router } from "express";
import {
    createPlan,
    getPlans,
    getPlanById,
    updatePlan,
    deletePlan,
} from "./controlles";  // Importamos los controladores de planes
import { verifyToken } from "../../middleware/jwtVerify";  // Middleware para verificar el token

const router = Router();

// Función para manejar errores asíncronos
function asyncHandler(fn: any) {
    return function (req: any, res: any, next: any) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Ruta POST para crear un plan
router.post(
    "/create",
    verifyToken,  // Verificación de token
    asyncHandler(createPlan)  // Llama a la función del controlador
);

// Ruta GET para obtener todos los planes
router.get(
    "/",
    verifyToken,  // Verificación de token
    asyncHandler(getPlans)  // Llama al controlador para obtener los planes
);

// Ruta GET para obtener un plan por ID (usando params para consistencia REST)
router.get(
    "/:id",
    verifyToken,  // Verificación de token
    asyncHandler(getPlanById)  // Llama al controlador para obtener un plan específico
);

// Ruta PUT para actualizar un plan
router.put(
    "/update",
    verifyToken,  // Verificación de token
    asyncHandler(updatePlan)  // Llama al controlador para actualizar el plan
);

// Ruta DELETE para eliminar un plan
router.delete(
    "/delete",
    verifyToken,  // Verificación de token
    asyncHandler(deletePlan)  // Llama al controlador para eliminar el plan
);

export default router;