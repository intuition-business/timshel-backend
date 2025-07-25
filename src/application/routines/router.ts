import { Router } from "express";
import {
  getRoutines,
  generateRoutinesIa,
  getGeneratedRoutinesIa,
  getRoutinesSaved,
  routinesSaved,
  getRoutineByDate,
} from "./controller";
import { verifyToken } from "../../middleware/jwtVerify";

const router = Router();

router.get("/", verifyToken, getRoutines);
router.post("/ia", verifyToken, generateRoutinesIa);
router.get("/ia", verifyToken, getGeneratedRoutinesIa);
router.get("/routinesSaved", verifyToken, getRoutinesSaved);
router.get("/routinesByDate", verifyToken, getRoutineByDate);
router.post("/routinesSave", verifyToken, routinesSaved);


export default router;
