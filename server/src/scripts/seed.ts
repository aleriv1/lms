import "dotenv/config";

import mongoose from "mongoose";

import { hashPassword } from "../auth/password.js";
import { connectToDatabase } from "../db/connect.js";
import { User } from "../models/User.js";

const DEMO_USERS = [
  {
    email: "admin@lms.local",
    name: "Администратор Системы",
    role: "admin",
  },
  {
    email: "teacher@lms.local",
    name: "Преподаватель Иванов",
    role: "teacher",
  },
  {
    email: "student@lms.local",
    name: "Обучающийся Петров",
    role: "student",
  },
] as const;

try {
  await connectToDatabase();

  for (const demoUser of DEMO_USERS) {
    const existingUser = await User.exists({ email: demoUser.email });
    if (existingUser) {
      console.info(`${demoUser.email}: already present`);
      continue;
    }

    await User.create({
      ...demoUser,
      passwordHash: await hashPassword("Password1"),
      status: "active",
    });
    console.info(`${demoUser.email}: created`);
  }
} catch (error) {
  console.error("Failed to seed demo users", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
