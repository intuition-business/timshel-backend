import { Router } from "express";
import {
    createWeight,
    getWeightsByUserId,
    updateWeight,
    deleteWeight,
    getShouldUpdateWeight,
} from "./controlles";  // Importamos los controladores de peso
import { verifyToken } from "../../middleware/jwtVerify";  // Middleware para verificar el token

const router = Router();

// Función para manejar errores asíncronos
function asyncHandler(fn: any) {
    return function (req: any, res: any, next: any) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Ruta POST para crear un registro de peso
router.post(
    "/create",
    verifyToken,  // Verificación de token
    asyncHandler(createWeight)  // Llama a la función del controlador
);

// Ruta GET para obtener los registros de peso del usuario
// Este controlador no necesita el user_id en la URL, ya que se obtiene del token
router.get(
    "/",
    verifyToken,  // Verificación de token
    asyncHandler(getWeightsByUserId)  // Llama al controlador para obtener los registros de peso
);

// Ruta GET para verificar si el usuario debe actualizar su peso
router.get(
    "/user-should-update-weight",
    verifyToken,  // Verificación de token
    asyncHandler(getShouldUpdateWeight)  // Llama al controlador para verificar actualización de peso
);

// Ruta PUT para actualizar un registro de peso
router.put(
    "/update",
    verifyToken,  // Verificación de token
    asyncHandler(updateWeight)  // Llama al controlador para actualizar el peso
);

// Ruta DELETE para eliminar un registro de peso
router.delete(
    "/delete",
    verifyToken,  // Verificación de token
    asyncHandler(deleteWeight)  // Llama al controlador para eliminar el registro
);

export default router;