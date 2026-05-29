import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import connectDB from "./config/db.js";
import authRouter from "./routes/authRoutes.js";
import taskRouter from "./routes/taskRoutes.js";

// Fail fast if any required env var is missing.
const required = [
  "MONGO_URI", "JWT_SECRET",
  "EMAIL_USER", "EMAIL_PASS",
  "CLOUDINARY_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env vars: ${missing.join(", ")}. Check server/.env`);
  process.exit(1);
}

connectDB();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/task", taskRouter);

app.get("/", (req, res) => res.send("Taskly API is running"));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
