import express from "express";
import {
  signup,
  verifyEmail,
  resendVerification,
  login,
  me,
  updateProfile,
  forgotPassword,
  resetPassword,
  changePassword,
  uploadAvatar,
  removeAvatar,
} from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { withUpload } from "../middleware/upload.js";

const router = express.Router();

// Public routes
router.post("/signup", signup);
router.post("/verify", verifyEmail);
router.post("/resend-verification", resendVerification);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

// Protected routes
router.get("/me", authMiddleware, me);
router.put("/profile", authMiddleware, updateProfile);
router.put("/password", authMiddleware, changePassword);
router.post("/avatar", authMiddleware, withUpload, uploadAvatar);
router.delete("/avatar", authMiddleware, removeAvatar);

export default router;
