import { Router } from "express";
import {
  getRoutines,
  generateRoutinesIa,
  getGeneratedRoutinesIa,
} from "./controller";
import { verifyToken } from "../../middleware/jwtVerify";

const router = Router();

router.get("/", verifyToken, getRoutines);
router.post("/ia", verifyToken, generateRoutinesIa);
router.get("/ia", verifyToken, getGeneratedRoutinesIa);

export default router;
