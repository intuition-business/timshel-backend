import { Router } from "express";
import { uploadUserImage, upload, getUserImage } from "./controller";
import { verifyToken } from "../../middleware/jwtVerify";

const router = Router();

// Ruta POST para subir imagen (campo esperado: "image")
function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

router.post(
  "/upload-image",
  verifyToken,
  upload.single("image"),
  asyncHandler(uploadUserImage)
);

router.get("/user/image",
  verifyToken,
  asyncHandler(getUserImage));
export default router;