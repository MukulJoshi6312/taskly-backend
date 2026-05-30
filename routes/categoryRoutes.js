import express from "express";
import {
  getCategories, createCategory, updateCategory, deleteCategory,
} from "../controllers/categoryController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();
router.use(authMiddleware); // all category routes require a valid JWT

router.get("/", getCategories);
router.post("/", createCategory);
router.put("/:id", updateCategory);
router.delete("/:id", deleteCategory);

export default router;
