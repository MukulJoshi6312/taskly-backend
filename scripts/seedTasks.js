// Usage: node scripts/seedTasks.js [email]
// Inserts a set of varied dummy tasks under the given user's account.

import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";
import Task from "../models/Task.js";

const TARGET_EMAIL = (process.argv[2] || "mukuljoshi6312@gmail.com").toLowerCase();

const day = (offsetDays, hour = 9, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const SEED = [
  {
    title: "Finalise Q3 brand deck",
    note: "Tighten the 3 story slides and swap the cover image. Send to Priya before EOD for review.",
    tag: "Work", priority: "high",
    completed: false, due: day(0, 16, 0),
    subtasks: [
      { t: "Rewrite story slides", d: true },
      { t: "Swap cover image", d: false },
      { t: "Share with Priya", d: false },
    ],
  },
  {
    title: "Morning run — 5km",
    note: "Riverside loop. Keep pace under 6:00/km.",
    tag: "Health", priority: "low",
    completed: true, due: day(0, 6, 30),
    subtasks: [],
  },
  {
    title: "Book dentist appointment",
    note: "Annual cleaning. Ask about the night guard.",
    tag: "Personal", priority: "med",
    completed: false, due: day(1),
    subtasks: [
      { t: "Call clinic", d: false },
      { t: "Add to calendar", d: false },
    ],
  },
  {
    title: "Read 20 pages — Atomic Habits",
    note: "Chapter on environment design.",
    tag: "Personal", priority: "low",
    completed: false, due: day(0, 21, 30),
    subtasks: [],
  },
  {
    title: "Reply to client invoice email",
    note: "Confirm the revised figure and attach the PO.",
    tag: "Work", priority: "high",
    completed: false, due: day(0, 14, 0),
    subtasks: [
      { t: "Confirm figure", d: false },
      { t: "Attach PO", d: false },
    ],
  },
  {
    title: "Grocery shopping",
    note: "Milk, eggs, bread, fresh greens, paneer.",
    tag: "Personal", priority: "med",
    completed: false, due: day(1, 18, 0),
    subtasks: [],
  },
  {
    title: "Yoga class",
    note: "Vinyasa flow at the studio.",
    tag: "Health", priority: "low",
    completed: false, due: day(2, 7, 0),
    subtasks: [],
  },
  {
    title: "Code review for backend PR",
    note: "Auth migration PR from Aarav. Focus on the JWT verification middleware.",
    tag: "Work", priority: "high",
    completed: false, due: day(0, 18, 0),
    subtasks: [
      { t: "Read PR description", d: true },
      { t: "Run tests locally", d: false },
      { t: "Leave inline comments", d: false },
    ],
  },
  {
    title: "Pay credit card bill",
    note: "Auto-pay isn't active yet. Due before the 5th.",
    tag: "Personal", priority: "high",
    completed: false, due: day(3, 10, 0),
    subtasks: [],
  },
  {
    title: "Meal prep for the week",
    note: "Quinoa bowls + roasted veg + chicken. 5 portions.",
    tag: "Health", priority: "med",
    completed: false, due: day(4, 11, 0),
    subtasks: [
      { t: "Chop veg", d: false },
      { t: "Cook quinoa", d: false },
      { t: "Pack containers", d: false },
    ],
  },
];

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✓ Mongo connected");

  const user = await User.findOne({ email: TARGET_EMAIL });
  if (!user) {
    console.error(`✗ No user found with email ${TARGET_EMAIL}`);
    process.exit(1);
  }
  console.log(`✓ Found user: ${user.email} (${user._id})`);

  const docs = SEED.map((t) => ({ ...t, userId: user._id }));
  const inserted = await Task.insertMany(docs);
  console.log(`✓ Inserted ${inserted.length} tasks for ${user.email}`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
