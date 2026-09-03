import {
  adminStatisticsResponseSchema,
  type LearningStatus,
} from "@lms/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Course } from "../models/Course.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import { Lesson } from "../models/Lesson.js";
import { LessonProgress } from "../models/LessonProgress.js";
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

describe("administrative learning status filter", () => {
  it("filters rows, totals, summaries and course averages before pagination", async () => {
    const admin = await createUser({ role: "admin" });
    const unassigned = await createUser({
      name: "А Без назначения",
      groupName: "Группа",
    });
    const untouched = await createUser({
      name: "Б Не начат",
      groupName: "Группа",
    });
    const progressing = await createUser({
      name: "В В процессе",
      groupName: "Группа",
    });
    const finished = await createUser({
      name: "Г Завершён",
      groupName: "Группа",
    });
    const course = await Course.create({
      title: "Курс фильтра",
      category: "Обучение",
      audience: "general",
      shortDescription: "Проверка статуса обучения",
      authorId: admin._id,
      status: "published",
    });
    const first = await Lesson.create({
      courseId: course._id,
      title: "Первый",
      order: 1,
      content: "Материал",
      durationMinutes: 5,
      isRequired: true,
      status: "published",
    });
    const second = await Lesson.create({
      courseId: course._id,
      title: "Второй",
      order: 2,
      content: "Материал",
      durationMinutes: 5,
      isRequired: true,
      status: "published",
    });
    for (const user of [untouched, progressing, finished]) {
      await CourseAssignment.create({
        userId: user._id,
        courseId: course._id,
        assignedBy: admin._id,
        status: user === finished ? "completed" : "active",
        completedAt: user === finished ? new Date() : null,
      });
    }
    for (const [user, lessons] of [
      [progressing, [first]],
      [finished, [first, second]],
    ] as const) {
      for (const lesson of lessons) {
        await LessonProgress.create({
          userId: user._id,
          courseId: course._id,
          lessonId: lesson._id,
          status: "completed",
          startedAt: new Date(),
          completedAt: new Date(),
        });
      }
    }
    const agent = await signIn(admin.email, TEST_PASSWORD);
    const cases: {
      status: LearningStatus;
      ids: string[];
      percent: number;
      active: number;
    }[] = [
      {
        status: "not_started",
        ids: [unassigned._id.toString(), untouched._id.toString()],
        percent: 0,
        active: 0,
      },
      {
        status: "in_progress",
        ids: [progressing._id.toString()],
        percent: 50,
        active: 1,
      },
      {
        status: "completed",
        ids: [finished._id.toString()],
        percent: 100,
        active: 1,
      },
    ];
    for (const { status, ids, percent, active } of cases) {
      for (const courseId of [undefined, course._id.toString()]) {
        const expected = courseId
          ? ids.filter((id) => id !== unassigned._id.toString())
          : ids;
        const response = await agent
          .get("/api/admin/statistics")
          .query({
            groupName: "Группа",
            learningStatus: status,
            ...(courseId ? { courseId } : {}),
          })
          .expect(200);
        const result = adminStatisticsResponseSchema.parse(response.body);
        expect(result.items.map((item) => item.userId)).toEqual(expected);
        expect(result.meta.total).toBe(expected.length);
        expect(result.summary).toEqual({
          usersCount: expected.length,
          activeUsersCount: active,
          completedUsersCount: status === "completed" ? 1 : 0,
          averageProgressPercent: percent,
        });
        expect(result.courseProgress).toEqual([
          {
            courseId: course._id.toString(),
            title: course.title,
            assignedUsersCount: 1,
            averageProgressPercent: percent,
          },
        ]);
      }
    }
    const secondPage = await agent
      .get("/api/admin/statistics")
      .query({
        groupName: "Группа",
        learningStatus: "not_started",
        page: 2,
        pageSize: 10,
      })
      .expect(200);
    const page = adminStatisticsResponseSchema.parse(secondPage.body);
    expect(page.items).toEqual([]);
    expect(page.meta).toEqual({
      page: 2,
      pageSize: 10,
      total: 2,
      totalPages: 1,
    });
    expect(page.summary.usersCount).toBe(2);
    const all = await agent
      .get("/api/admin/statistics")
      .query({ learningStatus: "not_started" })
      .expect(200);
    expect(
      adminStatisticsResponseSchema
        .parse(all.body)
        .items.map((item) => item.userId)
        .sort(),
    ).toEqual(
      [admin._id, unassigned._id, untouched._id]
        .map((id) => id.toString())
        .sort(),
    );
    const empty = await agent
      .get("/api/admin/statistics")
      .query({ groupName: "Нет группы", learningStatus: "completed" })
      .expect(200);
    expect(adminStatisticsResponseSchema.parse(empty.body)).toMatchObject({
      items: [],
      courseProgress: [],
      meta: { total: 0 },
      summary: { usersCount: 0, activeUsersCount: 0 },
    });
  });
});
