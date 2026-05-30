import Notification from "../models/Notification.js";

// Used internally by other controllers (signup, task complete, etc.)
// to drop something into the user's inbox. Failures are swallowed so they
// can't break the parent flow.
export async function createNotificationFor(userId, { type, title, body, taskId }) {
  try {
    return await Notification.create({ userId, type, title, body, taskId: taskId ?? null });
  } catch (err) {
    console.warn("[createNotificationFor] failed:", err.message);
    return null;
  }
}

// GET /api/notification
export const listNotifications = async (req, res) => {
  try {
    const items = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const unread = items.reduce((n, x) => n + (x.read ? 0 : 1), 0);
    return res.status(200).json({ success: true, data: items, unread });
  } catch (err) {
    console.error("[listNotifications] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
};

// PUT /api/notification/:id/read
export const markRead = async (req, res) => {
  try {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { returnDocument: "after" }
    );
    if (!n) return res.status(404).json({ success: false, message: "Notification not found" });
    return res.status(200).json({ success: true, data: n });
  } catch (err) {
    console.error("[markRead] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to mark read" });
  }
};

// PUT /api/notification/read-all
export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[markAllRead] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to mark all read" });
  }
};

// DELETE /api/notification/:id
export const removeNotification = async (req, res) => {
  try {
    const n = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!n) return res.status(404).json({ success: false, message: "Notification not found" });
    return res.status(200).json({ success: true, id: req.params.id });
  } catch (err) {
    console.error("[removeNotification] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to delete notification" });
  }
};

// DELETE /api/notification — clear all (handy "Clear" button on the screen)
export const clearAll = async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user._id });
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[clearAll] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to clear notifications" });
  }
};
