import {
  apiErrorSchema,
  attemptResultSchema,
  learnerTestSchema,
} from "@lms/shared";
import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Course } from "../models/Course.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import { Test } from "../models/Test.js";
import { TestAttempt } from "../models/TestAttempt.js";
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

describe("learner tests over HTTP", () => {
  it("hides correct options and stores two separately numbered attempts with snapshots", async () => {
    const teacher = await createUser({ role: "teacher" });
    const student = await createUser();
    const course = await Course.create({
      title: "Курс для тестирования",
      category: "Обучение",
      audience: "general",
      shortDescription: "Опубликованный курс с итоговым тестом",
      authorId: teacher._id,
      status: "published",
    });
    await CourseAssignment.create({
      userId: student._id,
      courseId: course._id,
      assignedBy: teacher._id,
    });
    const questionId = new Types.ObjectId();
    const correctId = new Types.ObjectId();
    const wrongId = new Types.ObjectId();
    const test = await Test.create({
      courseId: course._id,
      lessonId: null,
      title: "Итоговый тест",
      passingScore: 70,
      questions: [
        {
          _id: questionId,
          text: "Какой ответ правильный?",
          type: "single",
          order: 1,
          options: [
            { _id: correctId, text: "Первый", isCorrect: true },
            { _id: wrongId, text: "Второй", isCorrect: false },
          ],
        },
      ],
    });
    const agent = await signIn(student.email, TEST_PASSWORD);
    const read = await agent.get(`/api/learning/tests/${test._id}`).expect(200);
    expect(learnerTestSchema.parse(read.body).questions).toHaveLength(1);
    expect(JSON.stringify(read.body)).not.toContain("isCorrect");
    const answers = [
      { questionId: questionId.toString(), optionIds: [correctId.toString()] },
    ];
    const firstResponse = await agent
      .post(`/api/learning/tests/${test._id}/attempts`)
      .send({ answers })
      .expect(201);
    const firstResult = attemptResultSchema.parse(firstResponse.body);
    expect(firstResult).toMatchObject({
      score: 100,
      passed: true,
      correctCount: 1,
      totalCount: 1,
      attemptNumber: 1,
    });
    const first = await TestAttempt.findById(firstResult.id).lean();
    expect(first).toMatchObject({
      userId: student._id,
      testId: test._id,
      courseId: course._id,
      attemptNumber: 1,
      answers,
      score: 100,
      passed: true,
      questionsSnapshot: [
        {
          questionId: questionId.toString(),
          text: "Какой ответ правильный?",
          type: "single",
          order: 1,
          options: [
            { optionId: correctId.toString(), text: "Первый", isCorrect: true },
            { optionId: wrongId.toString(), text: "Второй", isCorrect: false },
          ],
        },
      ],
    });
    const secondResponse = await agent
      .post(`/api/learning/tests/${test._id}/attempts`)
      .send({ answers })
      .expect(201);
    const secondResult = attemptResultSchema.parse(secondResponse.body);
    expect(secondResult).toMatchObject({
      attemptNumber: 2,
      score: 100,
      passed: true,
    });
    expect(secondResult.id).not.toBe(firstResult.id);
    expect(await TestAttempt.findById(secondResult.id)).toMatchObject({
      attemptNumber: 2,
    });
    expect(
      await TestAttempt.countDocuments({
        userId: student._id,
        testId: test._id,
      }),
    ).toBe(2);
    expect(await TestAttempt.findById(firstResult.id).lean()).toEqual(first);
  });

  it("allows reading an archived test but refuses a new attempt", async () => {
    const teacher = await createUser({ role: "teacher" });
    const student = await createUser();
    const course = await Course.create({
      title: "Архивный курс",
      category: "Обучение",
      audience: "general",
      shortDescription: "Архивный курс доступен для чтения",
      authorId: teacher._id,
      status: "archived",
    });
    await CourseAssignment.create({
      userId: student._id,
      courseId: course._id,
      assignedBy: teacher._id,
    });
    const test = await Test.create({
      courseId: course._id,
      title: "Архивный тест",
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
    const read = await agent.get(`/api/learning/tests/${test._id}`).expect(200);
    expect(learnerTestSchema.parse(read.body).id).toBe(test._id.toString());
    expect(JSON.stringify(read.body)).not.toContain("isCorrect");
    const response = await agent
      .post(`/api/learning/tests/${test._id}/attempts`)
      .send({ answers: [] })
      .expect(403);
    expect(apiErrorSchema.parse(response.body).code).toBe("forbidden");
    expect(await TestAttempt.countDocuments({ testId: test._id })).toBe(0);
  });
});
