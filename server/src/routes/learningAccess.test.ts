import {
  apiErrorSchema,
  learningCourseSchema,
  lessonProgressResponseSchema,
} from "@lms/shared";
import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Course } from "../models/Course.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import { Lesson } from "../models/Lesson.js";
import { LessonProgress } from "../models/LessonProgress.js";
import { Test } from "../models/Test.js";
import {
  clearDatabase,
  connectTestDatabase,
  createUser,
  disconnectTestDatabase,
  signIn,
  TEST_PASSWORD,
} from "../testing/apiClient.js";

beforeAll(connectTestDatabase, 120_000);
afterAll(disconnectTestDatabase);
beforeEach(clearDatabase);

describe("learning access over HTTP", () => {
  it("refuses unassigned and nonexistent courses identically", async () => {
    const teacher = await createUser({ role: "teacher" });
    const student = await createUser();
    const course = await Course.create({
      title: "Неназначенный курс",
      category: "Обучение",
      audience: "general",
      shortDescription: "Опубликованный неназначенный курс",
      authorId: teacher._id,
      status: "published",
    });
    const agent = await signIn(student.email, TEST_PASSWORD);
    const unassigned = await agent
      .get(`/api/learning/courses/${course._id}`)
      .expect(403);
    const missing = await agent.get(
      `/api/learning/courses/${new Types.ObjectId()}`,
    );
    expect(apiErrorSchema.parse(unassigned.body).code).toBe(
      "course_not_assigned",
    );
    expect(missing.status).toBe(unassigned.status);
    expect(apiErrorSchema.parse(missing.body)).toEqual(
      apiErrorSchema.parse(unassigned.body),
    );
  });

  it("locks the second required lesson and reports 50 percent after completing the first", async () => {
    const teacher = await createUser({ role: "teacher" });
    const student = await createUser();
    const course = await Course.create({
      title: "Последовательный курс",
      category: "Обучение",
      audience: "general",
      shortDescription: "Курс с двумя обязательными уроками",
      authorId: teacher._id,
      status: "published",
    });
    await CourseAssignment.create({
      userId: student._id,
      courseId: course._id,
      assignedBy: teacher._id,
    });
    const first = await Lesson.create({
      courseId: course._id,
      title: "Первый урок",
      order: 1,
      content: "Материал",
      durationMinutes: 5,
      isRequired: true,
      status: "published",
    });
    const second = await Lesson.create({
      courseId: course._id,
      title: "Второй урок",
      order: 2,
      content: "Материал",
      durationMinutes: 5,
      isRequired: true,
      status: "published",
    });
    const agent = await signIn(student.email, TEST_PASSWORD);
    const locked = await agent
      .get(`/api/learning/courses/${course._id}/lessons/${second._id}`)
      .expect(403);
    expect(apiErrorSchema.parse(locked.body).code).toBe("lesson_locked");
    const initial = await agent
      .get(`/api/learning/courses/${course._id}`)
      .expect(200);
    expect(learningCourseSchema.parse(initial.body).progressPercent).toBe(0);
    const completed = await agent
      .post(`/api/learning/lessons/${first._id}/complete`)
      .send({})
      .expect(200);
    expect(lessonProgressResponseSchema.parse(completed.body)).toMatchObject({
      status: "completed",
      courseProgressPercent: 50,
      courseCompleted: false,
    });
    expect(
      await LessonProgress.findOne({
        userId: student._id,
        lessonId: first._id,
      }),
    ).toMatchObject({ status: "completed" });
    const updated = await agent
      .get(`/api/learning/courses/${course._id}`)
      .expect(200);
    expect(learningCourseSchema.parse(updated.body).progressPercent).toBe(50);
    await agent
      .get(`/api/learning/courses/${course._id}/lessons/${second._id}`)
      .expect(200);
  });

  it("refuses lesson completion without a passing required test", async () => {
    const teacher = await createUser({ role: "teacher" });
    const student = await createUser();
    const course = await Course.create({
      title: "Курс с тестом",
      category: "Обучение",
      audience: "general",
      shortDescription: "Курс с обязательным тестированием",
      authorId: teacher._id,
      status: "published",
    });
    await CourseAssignment.create({
      userId: student._id,
      courseId: course._id,
      assignedBy: teacher._id,
    });
    const lesson = await Lesson.create({
      courseId: course._id,
      title: "Первый урок",
      order: 1,
      content: "Материал",
      durationMinutes: 5,
      isRequired: true,
      status: "published",
    });
    await Test.create({
      courseId: course._id,
      lessonId: lesson._id,
      title: "Обязательный тест",
      passingScore: 70,
      questions: [
        {
          text: "Правильный ответ?",
          type: "single",
          order: 1,
          options: [
            { text: "Да", isCorrect: true },
            { text: "Нет", isCorrect: false },
          ],
        },
      ],
    });
    const agent = await signIn(student.email, TEST_PASSWORD);
    const response = await agent
      .post(`/api/learning/lessons/${lesson._id}/complete`)
      .send({})
      .expect(422);
    expect(apiErrorSchema.parse(response.body).code).toBe(
      "lesson_test_required",
    );
    expect(
      await LessonProgress.countDocuments({
        userId: student._id,
        lessonId: lesson._id,
        status: "completed",
      }),
    ).toBe(0);
  });
});
