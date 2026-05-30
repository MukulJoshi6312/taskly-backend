import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Open-ended type so we can add categories later without a schema change.
    // Current uses: "welcome", "task_completed", "info"
    type: { type: String, default: "info", trim: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "", trim: true },
    // Optional ref to the originating task (so the client can deep-link).
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
