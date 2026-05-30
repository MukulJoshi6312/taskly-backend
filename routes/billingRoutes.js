import express from "express";
import { mockUpgrade, mockDowngrade, revenueCatWebhook } from "../controllers/billingController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Dev-only mock toggles (guarded inside the controller too).
router.post("/mock-upgrade", authMiddleware, mockUpgrade);
router.post("/mock-downgrade", authMiddleware, mockDowngrade);

// Production: RevenueCat server-to-server webhook (no user auth; uses shared secret).
router.post("/revenuecat-webhook", revenueCatWebhook);

export default router;
