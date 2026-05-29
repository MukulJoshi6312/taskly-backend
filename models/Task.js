import mongoose from "mongoose";

const subtaskSchema = new mongoose.Schema(
  {
    t: { type: String, required: true, trim: true },
    d: { type: Boolean, default: false },
  },
  { _id: false }
);

const taskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,    // we always query by userId — index makes it fast at scale
    },
    title: { type: String, required: true, trim: true },
    note: { type: String, default: "" },
    tag: { type: String, default: "Work", trim: true },
    priority: {
      type: String,
      enum: ["low", "med", "high"],
      default: "med",
    },
    completed: { type: Boolean, default: false },
    due: { type: Date, default: null },
    subtasks: { type: [subtaskSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model("Task", taskSchema);
