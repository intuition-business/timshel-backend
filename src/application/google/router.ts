import { Router } from "express";
import { authWithGoogle, logoutWithGoogle } from "./controller";
import passport from "passport";
import "./../../middleware/google";

const router = Router();

router.get(
  "/google",
  //verifyToken,
  passport.authenticate("auth-google", {
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
  }),
  //validateHandler(googleDto, "body"),
  authWithGoogle
);

router.get("/google/logout", logoutWithGoogle);

export default router;
