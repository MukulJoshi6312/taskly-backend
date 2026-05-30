import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "#4F7CFF", trim: true },
  },
  { timestamps: true }
);

// A user can't have two categories with the same name.
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

export default mongoose.model("Category", categorySchema);
