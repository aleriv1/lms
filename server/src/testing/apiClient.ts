import { createHash, randomUUID } from "node:crypto";
import { open, unlink, type FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import mongoose from "mongoose";
import request from "supertest";
import type TestAgent from "supertest/lib/agent.js";

import { app } from "../app.js";
import { hashPassword } from "../auth/password.js";
import { connectToDatabase } from "../db/connect.js";
import { Course } from "../models/Course.js";
import { ActivityEvent } from "../models/ActivityEvent.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import { Lesson } from "../models/Lesson.js";
import { LessonProgress } from "../models/LessonProgress.js";
import { Test } from "../models/Test.js";
import { TestAttempt } from "../models/TestAttempt.js";
import { User, type UserDocument } from "../models/User.js";

export const TEST_PASSWORD = "Password1";

// Vitest files share one database, so a file owns the reset until afterAll.
const lockPath = join(
  tmpdir(),
  `lms-tests-${createHash("sha256").update(process.cwd()).digest("hex").slice(0, 16)}.lock`,
);
let lock: FileHandle | undefined;
let databaseApproved = false;

export async function connectTestDatabase(): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (!lock) {
    try {
      lock = await open(lockPath, "wx");
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "EEXIST"
      ) {
        throw error;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `Test database lock timed out: ${lockPath}. Check for another test run or a stale lock.`,
        );
      }
      await setTimeout(100);
    }
  }

  try {
    // Connecting must not create collections or indexes before the guard.
    mongoose.set("autoCreate", false);
    mongoose.set("autoIndex", false);
    await connectToDatabase();
    const name = mongoose.connection.name;
    if (!name.endsWith("-test")) {
      await mongoose.disconnect();
      throw new Error(
        `Test run refused: database "${name}" must end with "-test".`,
      );
    }
    databaseApproved = true;
    for (const model of [
      User,
      Course,
      Lesson,
      Test,
      CourseAssignment,
      LessonProgress,
      TestAttempt,
      ActivityEvent,
    ]) {
      await model.createCollection();
      await model.createIndexes();
    }
  } catch (error) {
    await disconnectTestDatabase();
    throw new Error(
      `Test database setup failed: ${error instanceof Error ? error.message : String(error)}. MongoDB must be running (npm run db:up).`,
      { cause: error },
    );
  }
}

export async function disconnectTestDatabase(): Promise<void> {
  databaseApproved = false;
  try {
    await mongoose.disconnect();
  } finally {
    if (lock) {
      await lock.close();
      lock = undefined;
      await unlink(lockPath);
    }
  }
}

export async function clearDatabase(): Promise<void> {
  if (!databaseApproved || !mongoose.connection.name.endsWith("-test")) {
    throw new Error("Test database reset refused: no approved connection.");
  }
  await Promise.all([
    User.deleteMany({}),
    Course.deleteMany({}),
    Lesson.deleteMany({}),
    Test.deleteMany({}),
    CourseAssignment.deleteMany({}),
    LessonProgress.deleteMany({}),
    TestAttempt.deleteMany({}),
    ActivityEvent.deleteMany({}),
  ]);
}

export function api(): TestAgent {
  return request.agent(app);
}

export async function signIn(
  email: string,
  password: string,
): Promise<TestAgent> {
  const agent = api();
  await agent.post("/api/auth/login").send({ email, password }).expect(200);
  return agent;
}

export async function createUser(
  overrides?: Partial<{
    email: string;
    name: string;
    role: "admin" | "teacher" | "student";
    groupName: string | null;
    status: "active" | "blocked" | "archived";
  }>,
): Promise<UserDocument> {
  return User.create({
    email: `${randomUUID()}@example.test`,
    name: "Тестовый пользователь",
    role: "student",
    groupName: null,
    status: "active",
    ...overrides,
    passwordHash: await hashPassword(TEST_PASSWORD),
  });
}
