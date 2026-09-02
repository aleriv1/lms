import "dotenv/config";

import mongoose from "mongoose";

import { hashPassword } from "../auth/password.js";
import { connectToDatabase } from "../db/connect.js";
import { Course } from "../models/Course.js";
import { Lesson } from "../models/Lesson.js";
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
  // Hand checks need something to open. Until the full demo set of
  // specification 12 arrives in slice 10, one course with one published and one
  // draft lesson is the minimum that makes the management screens reachable.
  const teacher = await User.findOne({ email: "teacher@lms.local" });
  if (!teacher) {
    throw new Error("teacher@lms.local is missing after seeding users");
  }

  const DEMO_COURSE_TITLE = "Вводный инструктаж по охране труда";
  let course = await Course.findOne({
    title: DEMO_COURSE_TITLE,
    authorId: teacher._id,
  });

  if (course) {
    console.info(`${DEMO_COURSE_TITLE}: already present`);
  } else {
    course = await Course.create({
      title: DEMO_COURSE_TITLE,
      category: "Безопасность",
      audience: "general",
      shortDescription: "Обязательный вводный курс для всех сотрудников.",
      description:
        "Порядок прохождения вводного инструктажа, права и обязанности работника.",
      authorId: teacher._id,
      status: "draft",
    });
    console.info(`${DEMO_COURSE_TITLE}: created`);
  }

  const DEMO_LESSONS = [
    {
      title: "Что такое вводный инструктаж",
      order: 1,
      content:
        "<p>Вводный инструктаж проходит каждый работник до начала работ.</p>",
      durationMinutes: 15,
      isRequired: true,
      status: "published" as const,
    },
    {
      title: "Средства индивидуальной защиты",
      order: 2,
      content: "<p>Перечень средств защиты и правила их применения.</p>",
      durationMinutes: 20,
      isRequired: true,
      status: "draft" as const,
    },
  ];

  for (const demoLesson of DEMO_LESSONS) {
    const existingLesson = await Lesson.exists({
      courseId: course._id,
      order: demoLesson.order,
    });
    if (existingLesson) {
      console.info(`${demoLesson.title}: already present`);
      continue;
    }

    await Lesson.create({ ...demoLesson, courseId: course._id, videoUrl: null });
    console.info(`${demoLesson.title}: created`);
  }
} catch (error) {
  console.error("Failed to seed demo data", error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
