import Task from "../models/Task.js";
import { FREE_TASK_LIMIT, isPremium } from "../config/billing.js";
import { createNotificationFor } from "./notificationController.js";
import Notification from "../models/Notification.js";

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
    // Free-plan gate: cap the TOTAL number of (non-deleted) tasks.
    // Counting only `completed: false` was wrong — completing a task would
    // free a slot, letting free users churn through unlimited tasks.
    if (!isPremium(req.user)) {
      const totalCount = await Task.countDocuments({ userId: req.user._id });
      if (totalCount >= FREE_TASK_LIMIT) {
        return res.status(402).json({
          success: false,
          code: "TASK_LIMIT_REACHED",
          message: `Free plan is limited to ${FREE_TASK_LIMIT} tasks. Upgrade for unlimited.`,
          limit: FREE_TASK_LIMIT,
        });
      }
    }

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

    // Load the previous doc so we can detect a false→true transition on `completed`
    // and drop an "achievement" notification.
    const before = await Task.findOne({ _id: req.params.id, userId: req.user._id }).lean();

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      body,
      { returnDocument: "after", runValidators: true }
    );
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    // Just completed — log an inbox item, BUT only once per task.
    // Without this check, toggling complete → incomplete → complete (or
    // re-completing on different days) would create a fresh notification
    // every time and spam the inbox.
    if (before && before.completed === false && task.completed === true) {
      void (async () => {
        const already = await Notification.exists({
          userId: req.user._id,
          taskId: task._id,
          type: "task_completed",
        });
        if (already) return;
        await createNotificationFor(req.user._id, {
          type: "task_completed",
          title: "Nice work 🎉",
          body: `Completed "${task.title}"`,
          taskId: task._id,
        });
      })();
    }

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
// GET /api/task/stats — summary for the Profile screen
export const getStats = async (req, res) => {
  try {
    const userId = req.user._id;
    // One $facet pulls all the counts in a single round trip.
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6); // last 7 days incl. today

    const [agg] = await Task.aggregate([
      { $match: { userId } },
      {
        $facet: {
          total: [{ $count: "n" }],
          completed: [{ $match: { completed: true } }, { $count: "n" }],
          completedToday: [
            { $match: { completed: true, updatedAt: { $gte: startOfToday } } },
            { $count: "n" },
          ],
          completedThisWeek: [
            { $match: { completed: true, updatedAt: { $gte: startOfWeek } } },
            { $count: "n" },
          ],
          activeToday: [
            { $match: { completed: false, due: { $gte: startOfToday, $lt: new Date(startOfToday.getTime() + 86400000) } } },
            { $count: "n" },
          ],
        },
      },
    ]);

    const pick = (a) => (a && a[0] ? a[0].n : 0);
    const total = pick(agg.total);
    const completed = pick(agg.completed);
    const stats = {
      total,
      completed,
      active: total - completed,
      completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
      completedToday: pick(agg.completedToday),
      completedThisWeek: pick(agg.completedThisWeek),
      dueToday: pick(agg.activeToday),
      memberSince: req.user.createdAt,
    };
    return res.status(200).json({ success: true, data: stats });
  } catch (err) {
    console.error("[getStats] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
};

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
