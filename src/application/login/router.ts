import { Router } from "express";
import { loginDto } from "./dto";
import { Login } from "./controller";
import { validateHandler } from "../../middleware";

const router = Router();

router.post("/", validateHandler(loginDto, "body"), Login);

export default router;
