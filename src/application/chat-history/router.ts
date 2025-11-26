// src/application/chat/router.ts
import { Router } from "express";
import { getConversations, getMessages } from "./controller";
import { verifyToken } from "../../middleware/jwtVerify";

const router = Router();

function asyncHandler(fn: any) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.get("/conversations", verifyToken, asyncHandler(getConversations));
router.get("/messages", verifyToken, asyncHandler(getMessages));

export default router;