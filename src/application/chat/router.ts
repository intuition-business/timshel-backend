import { Router } from "express";
import { verifyToken } from "../../middleware/jwtVerify";
import { uploadChatMedia } from "../../middleware/uploadChatMedia";
import { uploadChatMediaController, getChatWithUserController } from "./controller";


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

// GET /api/chat/with/:receiverId — info de la conversación con un usuario
router.get(
    "/with/:receiverId",
    verifyToken,
    asyncHandler(getChatWithUserController)
);

export default router;