import express from "express";
import {
  getTasks, getTask, createTask, updateTask, deleteTask, getStats,
} from "../controllers/taskController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();

// Every task route requires a valid JWT.
router.use(authMiddleware);

router.get("/", getTasks);
router.get("/stats", getStats);   // before /:id so it isn't captured as an id
router.get("/:id", getTask);
router.post("/", createTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);

export default router;
