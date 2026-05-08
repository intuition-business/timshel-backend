import { Router } from "express";
import { verifyToken } from "../../middleware/jwtVerify";
import { uploadChatMedia } from "../../middleware/uploadChatMedia";
import { uploadChatMediaController, getChatWithUserController } from "./controller";


function asyncHandler(fn: any) {
    return function (req: any, res: any, next: any) {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Router para upload de media — montado en /api/chat/upload-media
const router = Router();

router.post(
    "/",
    verifyToken,
    uploadChatMedia,
    asyncHandler(uploadChatMediaController)
);

export default router;

// Router para info de chat — montado en /api/chat
export const chatInfoRouter = Router();

chatInfoRouter.get(
    "/with/:receiverId",
    verifyToken,
    asyncHandler(getChatWithUserController)
);