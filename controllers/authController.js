import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { generateCode, hashCode, compareCode, codeExpiry, isExpired } from "../lib/codes.js";
import { sendVerificationEmail, sendPasswordResetEmail } from "../lib/mailer.js";
import { uploadBufferToCloudinary, deleteFromCloudinary } from "../lib/cloudinary.js";
import { createNotificationFor } from "./notificationController.js";

const TOKEN_TTL = "7d";
const VERIFICATION_TTL_MIN = 15;
const RESET_TTL_MIN = 60;

const signToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

const publicUser = (user) => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  emailVerified: user.emailVerified,
  avatarUrl: user.avatarUrl,
  plan: user.plan,
  lastLoginAt: user.lastLoginAt,
  lastLoginDevice: user.lastLoginDevice,
});

// Stamp last-login info from the request. `device` is a free-form short string
// the client sends (e.g. "iPhone 14 · iOS 17.5"). Truncated to 120 chars so a
// malicious client can't fill the DB with junk.
const recordLogin = async (user, req) => {
  const raw = (req.body && req.body.device) || "";
  user.lastLoginDevice = typeof raw === "string" ? raw.slice(0, 120).trim() : "";
  user.lastLoginAt = new Date();
  await user.save();
};

// POST /api/auth/signup
// Creates the user (unverified) and emails a 6-digit code.
// We do NOT issue a JWT here — user must verify before they can log in.
export const signup = async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const exists = await User.findOne({ email: String(email).toLowerCase() });
    if (exists) {
      return res.status(409).json({ success: false, message: "An account with that email already exists" });
    }

    const code = generateCode();
    const user = await User.create({
      email,
      password,
      name,
      emailVerified: false,
      verificationCode: await hashCode(code),
      verificationExpiresAt: codeExpiry(VERIFICATION_TTL_MIN),
    });

    try {
      await sendVerificationEmail(user.email, code);
    } catch (err) {
      // If the email fails, delete the half-created account so the user can try again.
      console.error("[signup] email send failed:", err);
      await User.deleteOne({ _id: user._id });
      return res.status(502).json({ success: false, message: "Could not send verification email. Try again." });
    }

    return res.status(201).json({
      success: true,
      message: "Verification code sent. Check your inbox.",
      email: user.email,
    });
  } catch (err) {
    console.error("[signup] failed:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Signup failed" });
  }
};

// POST /api/auth/verify
// Confirms the signup code and issues the JWT.
export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ success: false, message: "Email and code are required" });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() })
      .select("+verificationCode +verificationExpiresAt");
    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found" });
    }
    if (user.emailVerified) {
      // Already verified — just issue a token instead of erroring, smoother UX.
      return res.status(200).json({ success: true, token: signToken(user._id), user: publicUser(user) });
    }
    if (!user.verificationCode || isExpired(user.verificationExpiresAt)) {
      return res.status(400).json({ success: false, message: "Code expired. Request a new one." });
    }
    const ok = await compareCode(String(code), user.verificationCode);
    if (!ok) return res.status(400).json({ success: false, message: "Invalid code" });

    user.emailVerified = true;
    user.verificationCode = null;
    user.verificationExpiresAt = null;
    await recordLogin(user, req);

    // First-ever inbox item — fire-and-forget, won't block the response.
    void createNotificationFor(user._id, {
      type: "welcome",
      title: "Welcome to Taskly 👋",
      body: "Tap + on the home screen to add your first task.",
    });

    return res.status(200).json({
      success: true,
      token: signToken(user._id),
      user: publicUser(user),
    });
  } catch (err) {
    console.error("[verifyEmail] failed:", err);
    return res.status(500).json({ success: false, message: "Verification failed" });
  }
};

// POST /api/auth/resend-verification
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    // Always respond success to avoid leaking whether the email is registered.
    if (!user || user.emailVerified) {
      return res.status(200).json({ success: true, message: "If an account exists, a new code was sent." });
    }

    const code = generateCode();
    user.verificationCode = await hashCode(code);
    user.verificationExpiresAt = codeExpiry(VERIFICATION_TTL_MIN);
    await user.save();

    try {
      await sendVerificationEmail(user.email, code);
    } catch (err) {
      console.error("[resendVerification] email send failed:", err);
      return res.status(502).json({ success: false, message: "Could not send email. Try again." });
    }

    return res.status(200).json({ success: true, message: "Verification code sent." });
  } catch (err) {
    console.error("[resendVerification] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to resend code" });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }

    if (!user.emailVerified) {
      // Specific status so the app can redirect to the verification screen.
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email first.",
        email: user.email,
      });
    }

    await recordLogin(user, req);

    return res.status(200).json({
      success: true,
      token: signToken(user._id),
      user: publicUser(user),
    });
  } catch (err) {
    console.error("[login] failed:", err);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

// GET /api/auth/me
export const me = async (req, res) =>
  res.status(200).json({ success: true, user: publicUser(req.user) });

// POST /api/auth/avatar — upload (or replace) profile picture.
// Expects multipart form with field name "avatar".
export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    // If user already has an avatar, delete the old one from Cloudinary so we
    // don't accumulate orphaned uploads (and so they don't hit your free tier).
    if (req.user.avatarPublicId) {
      try {
        await deleteFromCloudinary(req.user.avatarPublicId);
      } catch (err) {
        // Non-fatal — old image will just linger. Log and continue.
        console.warn("[uploadAvatar] failed to delete old image:", err.message);
      }
    }

    const result = await uploadBufferToCloudinary(req.file.buffer);
    req.user.avatarUrl = result.secure_url;
    req.user.avatarPublicId = result.public_id;
    await req.user.save();

    return res.status(200).json({ success: true, user: publicUser(req.user) });
  } catch (err) {
    console.error("[uploadAvatar] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to upload image" });
  }
};

// DELETE /api/auth/avatar
export const removeAvatar = async (req, res) => {
  try {
    if (req.user.avatarPublicId) {
      try {
        await deleteFromCloudinary(req.user.avatarPublicId);
      } catch (err) {
        console.warn("[removeAvatar] cloudinary delete failed:", err.message);
      }
    }
    req.user.avatarUrl = "";
    req.user.avatarPublicId = "";
    await req.user.save();

    return res.status(200).json({ success: true, user: publicUser(req.user) });
  } catch (err) {
    console.error("[removeAvatar] failed:", err);
    return res.status(500).json({ success: false, message: "Failed to remove image" });
  }
};

// PUT /api/auth/profile — update name only
export const updateProfile = async (req, res) => {
  try {
    const { name } = req.body || {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    req.user.name = name.trim();
    await req.user.save();
    return res.status(200).json({ success: true, user: publicUser(req.user) });
  } catch (err) {
    console.error("[updateProfile] failed:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

// POST /api/auth/forgot-password
// Always returns 200 to avoid revealing whether the email is registered.
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: "Email is required" });

    const user = await User.findOne({ email: String(email).toLowerCase() });
    if (!user) {
      return res.status(200).json({ success: true, message: "If an account exists, a reset code was sent." });
    }

    const code = generateCode();
    user.resetCode = await hashCode(code);
    user.resetExpiresAt = codeExpiry(RESET_TTL_MIN);
    await user.save();

    try {
      await sendPasswordResetEmail(user.email, code);
    } catch (err) {
      console.error("[forgotPassword] email send failed:", err);
      // Still return generic success — don't expose whether the user exists.
      return res.status(200).json({ success: true, message: "If an account exists, a reset code was sent." });
    }

    return res.status(200).json({ success: true, message: "Reset code sent." });
  } catch (err) {
    console.error("[forgotPassword] failed:", err);
    return res.status(500).json({ success: false, message: "Request failed" });
  }
};

// POST /api/auth/reset-password
export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, message: "Email, code, and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email: String(email).toLowerCase() })
      .select("+resetCode +resetExpiresAt");
    if (!user || !user.resetCode || isExpired(user.resetExpiresAt)) {
      return res.status(400).json({ success: false, message: "Invalid or expired code" });
    }
    const ok = await compareCode(String(code), user.resetCode);
    if (!ok) return res.status(400).json({ success: false, message: "Invalid or expired code" });

    user.password = newPassword; // pre-save hook will hash
    user.resetCode = null;
    user.resetExpiresAt = null;
    await recordLogin(user, req); // also saves the user

    return res.status(200).json({
      success: true,
      token: signToken(user._id),
      user: publicUser(user),
    });
  } catch (err) {
    console.error("[resetPassword] failed:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Reset failed" });
  }
};

// PUT /api/auth/password — change password while logged in (requires current password)
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Current and new passwords are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
    }

    // Reload user with password field included so we can verify current.
    const user = await User.findById(req.user._id).select("+password");
    const ok = await user.comparePassword(currentPassword);
    if (!ok) return res.status(401).json({ success: false, message: "Current password is incorrect" });

    user.password = newPassword; // pre-save hook will hash
    await user.save();

    return res.status(200).json({ success: true, message: "Password updated" });
  } catch (err) {
    console.error("[changePassword] failed:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Password change failed" });
  }
};
