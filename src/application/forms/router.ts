import { Router } from "express";
import { createFormsDto, getFormsDto } from "./dto";
import { validateHandler } from "../../middleware";
import { createforms, getFormsByUserId } from "./controller";

const router = Router();

router.post("/", validateHandler(createFormsDto, "body"), createforms);
router.get(
  "/:user_id",
  validateHandler(getFormsDto, "params"),
  getFormsByUserId
);

export default router;
