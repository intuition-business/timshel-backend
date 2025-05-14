import { Router } from "express";
import { getRoutines } from "./controller";
import { verifyToken } from "../../middleware/jwtVerify";
//import { verifyToken } from "../../../middleware/authJwt";

const router = Router();

router.get("/", verifyToken, getRoutines);

export default router;
