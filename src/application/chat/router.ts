import { Router } from "express";
import { verifyToken } from "../../middleware/jwtVerify";
import { uploadChatMedia } from "../../middleware/uploadChatMedia";
import { uploadChatMediaController } from "./controller";


// Función para manejar errores asíncronos
function asyncHandler(fn: any) {
    return function (req: any, res: any, next: any) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

const router = Router();

// Ruta POST para upload de media en chat
router.post(
    "/",
    verifyToken,
    uploadChatMedia,
    asyncHandler(uploadChatMediaController)
);

export default router;