// src/application/warm-ups/router.ts
import { Router } from "express";
import {
  createWarmUp,
  getWarmUps,
  updateWarmUp,
  deleteWarmUp,
} from "./controller";
import { verifyToken } from "../../middleware/jwtVerify";

const router = Router();

const asyncHandler = (fn: any) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);


router.post("/", verifyToken, ...createWarmUp);
router.get("/", verifyToken, asyncHandler(getWarmUps));
router.put("/:id", verifyToken, ...updateWarmUp);
router.delete("/:id", verifyToken, asyncHandler(deleteWarmUp));

export default router;