import { Router } from "express";
import { registerDto } from "./dto";
import { register } from "./controller";
import { validateHandler } from "../../middleware";

const router = Router();

router.post("/", validateHandler(registerDto, "body"), register);

export default router;
