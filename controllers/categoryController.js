import Category from "../models/Category.js";
import { DEFAULT_CATEGORIES } from "../config/categories.js";

// GET /api/category — list current user's categories.
// Lazily seeds the defaults the first time (also covers users who signed up
// before this feature existed).
export const getCategories = async (req, res) => {
  try {
    let categories = await Category.find({ userId: req.user._id }).sort({ createdAt: 1 }).lean();
    if (categories.length === 0) {
      await Category.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId: req.user._id })));
      categories = await Category.find({ userId: req.user._id }).sort({ createdAt: 1 }).lean();
    }
    return res.status(200).json({ success: true, data: categories });
  } catch (err) {
    console.error("[getCategories] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch categories" });
  }
};

// POST /api/category  { name, color }
export const createCategory = async (req, res) => {
  try {
    const { name, color } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    const category = await Category.create({
      userId: req.user._id,
      name: name.trim(),
      color: color || "#4F7CFF",
    });
    return res.status(201).json({ success: true, data: category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A category with that name already exists" });
    }
    console.error("[createCategory] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to create category" });
  }
};

// PUT /api/category/:id  { name?, color? }
export const updateCategory = async (req, res) => {
  try {
    const { name, color } = req.body || {};
    const update = {};
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof color === "string" && color.trim()) update.color = color.trim();

    const category = await Category.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      update,
      { returnDocument: "after", runValidators: true }
    );
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });
    return res.status(200).json({ success: true, data: category });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: "A category with that name already exists" });
    }
    console.error("[updateCategory] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to update category" });
  }
};

// DELETE /api/category/:id
// Note: tasks store the category NAME as a string, so deleting a category
// leaves existing tasks with that name (they fall back to a neutral color).
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });
    return res.status(200).json({ success: true, id: req.params.id });
  } catch (err) {
    console.error("[deleteCategory] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to delete category" });
  }
};
