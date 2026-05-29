import Task from "../models/Task.js";

// Every handler below assumes authMiddleware has run and set req.user.

// GET /api/task — current user's tasks, newest first
export const getTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (err) {
    console.error("[getTasks] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch tasks" });
  }
};

// GET /api/task/:id — single task belonging to current user
export const getTask = async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    return res.status(200).json({ success: true, data: task });
  } catch (err) {
    console.error("[getTask] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch task" });
  }
};

// POST /api/task — create a task for current user
export const createTask = async (req, res) => {
  try {
    // Important: derive userId from the JWT, NOT from req.body.
    // If we trusted req.body.userId, a logged-in user could create tasks attributed to other users.
    const task = await Task.create({ ...req.body, userId: req.user._id });
    return res.status(201).json({ success: true, message: "Task created successfully", data: task });
  } catch (err) {
    console.error("[createTask] failed:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Failed to create task" });
  }
};

// PUT /api/task/:id — update a task owned by current user
export const updateTask = async (req, res) => {
  try {
    // findOneAndUpdate with both id AND userId — if userId doesn't match, we return 404.
    // This prevents user A from editing user B's task even if they guess the id.
    // Also strip userId from the body so it can't be reassigned.
    const { userId: _ignored, ...body } = req.body || {};
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      body,
      { returnDocument: "after", runValidators: true }
    );
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    return res.status(200).json({ success: true, message: "Task updated successfully", data: task });
  } catch (err) {
    console.error("[updateTask] failed:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Failed to update task" });
  }
};

// DELETE /api/task/:id
export const deleteTask = async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });
    return res.status(200).json({ success: true, message: "Task deleted", id: req.params.id });
  } catch (err) {
    console.error("[deleteTask] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to delete task" });
  }
};
