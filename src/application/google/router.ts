import { Router, RequestHandler } from "express";
import { authWithGoogle, authWithGoogleMobile, logoutWithGoogle } from "./controller";
import passport from "passport";

const router = Router();

try {
  require("../../middleware/google");
  console.log("✅ middleware/google cargado");
} catch (error) {
  console.error("❌ Error cargando middleware/google:", error);
}

router.get(
  "/google",
  passport.authenticate("auth-google", {
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
  }),
  authWithGoogle
);

router.get("/google/logout", logoutWithGoogle);

router.post("/google/mobile", authWithGoogleMobile as RequestHandler);

export default router;
