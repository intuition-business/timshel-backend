import { Router, RequestHandler } from "express";
import { authWithGoogle, authWithGoogleMobile, logoutWithGoogle } from "./controller";
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


// Nueva ruta para móvil (Flutter)
router.post("/google/mobile", authWithGoogleMobile as RequestHandler);
export default router;
