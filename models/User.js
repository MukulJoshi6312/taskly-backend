import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email"],
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      // select: false means: don't return this field by default in queries.
      // We have to explicitly .select("+password") to read it (only during login).
      select: false,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    emailVerified: { type: Boolean, default: false },

    // Avatar (hosted on Cloudinary). publicId is kept so we can delete the
    // remote asset when the user replaces or removes their avatar.
    avatarUrl:      { type: String, default: "" },
    avatarPublicId: { type: String, default: "" },

    // Last successful login — used for the Settings screen.
    lastLoginAt:     { type: Date,   default: null },
    lastLoginDevice: { type: String, default: "" },

    // Email verification (signup flow)
    verificationCode:      { type: String, select: false, default: null },
    verificationExpiresAt: { type: Date,   select: false, default: null },

    // Password reset (forgot password flow)
    resetCode:      { type: String, select: false, default: null },
    resetExpiresAt: { type: Date,   select: false, default: null },
  },
  { timestamps: true }
);

// Hash the password before saving. Runs on .save() — but NOT on findOneAndUpdate.
// If you ever add a "change password" feature, hash manually in the controller.
// NOTE: when using `async function` in Mongoose middleware, do NOT take/call next.
// Mongoose handles the returned Promise automatically.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to compare a plaintext password against the stored hash.
userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model("User", userSchema);
