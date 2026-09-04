import {
  attemptResultSchema,
  learnerStatisticsSchema,
  userStatisticsSchema,
} from "@lms/shared";
import { Types } from "mongoose";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { recordActivity } from "../learning/activityLog.js";
import { ActivityEvent } from "../models/ActivityEvent.js";
import { Course } from "../models/Course.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import { Lesson } from "../models/Lesson.js";
import { LessonProgress } from "../models/LessonProgress.js";
import { Test } from "../models/Test.js";
import {
  loadActivityWeeks,
  loadRecentActivity,
} from "../statistics/activityFeed.js";
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

async function setup(lessonTest = false) {
  const admin = await createUser({ role: "admin" });
  const student = await createUser();
  const course = await Course.create({
    title: "Курс активности",
    category: "Обучение",
    audience: "general",
    shortDescription: "Проверка учебных событий",
    authorId: admin._id,
    status: "published",
  });
  await CourseAssignment.create({
    userId: student._id,
    courseId: course._id,
    assignedBy: admin._id,
  });
  const lesson = await Lesson.create({
    courseId: course._id,
    title: "Обязательный урок",
    order: 1,
    content: "Материал",
    durationMinutes: 5,
    isRequired: true,
    status: "published",
  });
  const questionId = new Types.ObjectId();
  const correctId = new Types.ObjectId();
  const wrongId = new Types.ObjectId();
  const test = await Test.create({
    courseId: course._id,
    lessonId: lessonTest ? lesson._id : null,
    title: "Тест",
    passingScore: 70,
    questions: [
      {
        _id: questionId,
        text: "Правильный ответ?",
        type: "single",
        order: 1,
        options: [
          { _id: correctId, text: "Да", isCorrect: true },
          { _id: wrongId, text: "Нет", isCorrect: false },
        ],
      },
    ],
  });
  const agent = await signIn(student.email, TEST_PASSWORD);
  const answer = (optionId: Types.ObjectId) => ({
    answers: [
      { questionId: questionId.toString(), optionIds: [optionId.toString()] },
    ],
  });
  return {
    admin,
    student,
    course,
    lesson,
    test,
    agent,
    answer,
    correctId,
    wrongId,
  };
}

describe("activity over HTTP", () => {
  it("records four transitions once and shares the safe feed with the administrator", async () => {
    const { admin, student, course, lesson, test, agent, answer, correctId } =
      await setup();
    const start = `/api/learning/lessons/${lesson._id}/start`;
    const complete = `/api/learning/lessons/${lesson._id}/complete`;
    await agent.post(start).send({}).expect(200);
    await agent.post(start).send({}).expect(200);
    await agent
      .post(`/api/learning/tests/${test._id}/attempts`)
      .send(answer(correctId))
      .expect(201);
    await agent.post(complete).send({}).expect(200);
    await agent.post(complete).send({}).expect(200);
    const response = await agent.get("/api/learning/me/statistics").expect(200);
    const statistics = learnerStatisticsSchema.parse(response.body);
    expect(statistics.recentActivity.map((event) => event.type)).toEqual([
      "course_completed",
      "lesson_completed",
      "test_submitted",
      "lesson_started",
    ]);
    expect(
      statistics.recentActivity.every(
        (event) => event.courseTitle === course.title,
      ),
    ).toBe(true);
    expect(
      statistics.recentActivity.find(
        (event) => event.type === "lesson_started",
      ),
    ).toMatchObject({
      lessonId: lesson._id.toString(),
      lessonTitle: lesson.title,
    });
    expect(
      statistics.recentActivity.find(
        (event) => event.type === "test_submitted",
      ),
    ).toMatchObject({
      lessonId: null,
      lessonTitle: null,
    });
    expect(statistics.activityWeeks).toHaveLength(4);
    expect(
      statistics.activityWeeks.reduce((sum, week) => sum + week.count, 0),
    ).toBe(4);
    expect(await ActivityEvent.countDocuments({ userId: student._id })).toBe(4);
    for (const type of [
      "lesson_started",
      "lesson_completed",
      "course_completed",
    ]) {
      expect(
        await ActivityEvent.countDocuments({ userId: student._id, type }),
      ).toBe(1);
    }
    const adminAgent = await signIn(admin.email, TEST_PASSWORD);
    const adminResponse = await adminAgent
      .get(`/api/admin/statistics/users/${student._id}`)
      .expect(200);
    expect(
      userStatisticsSchema.parse(adminResponse.body).recentActivity,
    ).toEqual(statistics.recentActivity);
    expect(JSON.stringify(adminResponse.body)).not.toContain('"metadata"');
    expect(JSON.stringify(response.body)).not.toContain('"metadata"');
    const own = await adminAgent.get("/api/learning/me/statistics").expect(200);
    expect(learnerStatisticsSchema.parse(own.body).recentActivity).toEqual([]);
  });

  it("records a failed attempt too", async () => {
    const { student, test, agent, answer, wrongId } = await setup();
    const response = await agent
      .post(`/api/learning/tests/${test._id}/attempts`)
      .send(answer(wrongId))
      .expect(201);
    expect(attemptResultSchema.parse(response.body).passed).toBe(false);
    expect(
      await ActivityEvent.countDocuments({
        userId: student._id,
        type: "test_submitted",
      }),
    ).toBe(1);
    expect(await ActivityEvent.countDocuments({ userId: student._id })).toBe(1);
  });

  it("keeps a successful start successful when recording fails", async () => {
    const { student, lesson, agent } = await setup();
    const failure = new Error("activity unavailable");
    const create = vi
      .spyOn(ActivityEvent, "create")
      .mockRejectedValueOnce(failure);
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await agent
        .post(`/api/learning/lessons/${lesson._id}/start`)
        .send({})
        .expect(200);
      expect(
        await LessonProgress.findOne({
          userId: student._id,
          lessonId: lesson._id,
        }),
      ).toMatchObject({ status: "in_progress" });
      expect(log).toHaveBeenCalledWith("activity event not recorded:", failure);
    } finally {
      create.mockRestore();
      log.mockRestore();
    }
  });

  it("records the lesson completed by a passing test, once", async () => {
    const { student, lesson, test, agent, answer, correctId } =
      await setup(true);
    await agent
      .post(`/api/learning/tests/${test._id}/attempts`)
      .send(answer(correctId))
      .expect(201);
    await agent
      .post(`/api/learning/lessons/${lesson._id}/complete`)
      .send({})
      .expect(200);
    expect(
      await LessonProgress.findOne({
        userId: student._id,
        lessonId: lesson._id,
      }),
    ).toMatchObject({ status: "completed" });
    expect(
      (await loadRecentActivity(student._id)).map((event) => event.type),
    ).toEqual(["course_completed", "lesson_completed", "test_submitted"]);
    // A second pass re-completes an already finished lesson; the feed must not
    // grow a second `lesson_completed` for it.
    await agent
      .post(`/api/learning/tests/${test._id}/attempts`)
      .send(answer(correctId))
      .expect(201);
    expect(
      await ActivityEvent.countDocuments({
        userId: student._id,
        type: "lesson_completed",
      }),
    ).toBe(1);
  });

  it("limits and orders snapshots and aggregates only the learner's four-week window", async () => {
    const userId = new Types.ObjectId();
    const course = { id: new Types.ObjectId(), title: "Удалённый курс" };
    const now = new Date("2026-09-04T12:00:00Z");
    for (let index = 0; index < 12; index += 1) {
      await recordActivity({
        userId,
        type: "test_submitted",
        course,
        lesson: null,
        createdAt: now,
      });
    }
    await recordActivity({
      userId,
      type: "lesson_started",
      course,
      lesson: null,
      createdAt: new Date("2026-08-09T23:59:59.999Z"),
    });
    await recordActivity({
      userId,
      type: "lesson_started",
      course,
      lesson: null,
      createdAt: new Date("2026-08-10T00:00:00Z"),
    });
    await recordActivity({
      userId: new Types.ObjectId(),
      type: "test_submitted",
      course,
      lesson: null,
      createdAt: now,
    });
    const feed = await loadRecentActivity(userId);
    const stored = await ActivityEvent.find({ userId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(10);
    expect(feed).toHaveLength(10);
    expect(feed.map((event) => event.id)).toEqual(
      stored.map((event) => event._id.toString()),
    );
    expect(feed.every((event) => event.courseTitle === course.title)).toBe(
      true,
    );
    expect(
      (await loadActivityWeeks(userId, now)).map((week) => week.count),
    ).toEqual([1, 0, 0, 12]);
  });
});
