import express from "express";
import {
  listNotifications, markRead, markAllRead, removeNotification, clearAll,
} from "../controllers/notificationController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(authMiddleware);

router.get("/", listNotifications);
router.put("/read-all", markAllRead);
router.put("/:id/read", markRead);
router.delete("/:id", removeNotification);
router.delete("/", clearAll);

export default router;
