import { Router } from "express";
import { createFormsDto, getFormsDto } from "./dto";
import { validateHandler } from "../../middleware";
import { createforms, getFormsByUserId } from "./controller";
import { verifyToken } from "../../middleware/jwtVerify";

const router = Router();

router.post(
  "/",
  verifyToken,
  validateHandler(createFormsDto, "body"),
  createforms
);
router.get(
  "/",
  verifyToken,
  validateHandler(getFormsDto, "params"),
  getFormsByUserId
);

export default router;
