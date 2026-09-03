import { apiErrorSchema, courseDetailSchema, courseSchema } from "@lms/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Course } from "../models/Course.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import { Lesson } from "../models/Lesson.js";
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

describe("course CRUD over HTTP", () => {
  it("creates a draft, reads, renames and publishes it, then refuses deletion", async () => {
    const teacher = await createUser({ role: "teacher" });
    const agent = await signIn(teacher.email, TEST_PASSWORD);
    const created = await agent
      .post("/api/courses")
      .send({
        title: "Вводный курс",
        category: "Обучение",
        audience: "general",
        shortDescription: "Краткое описание вводного учебного курса",
        coverUrl: null,
      })
      .expect(201);
    const course = courseSchema.parse(created.body);
    expect(course).toMatchObject({
      status: "draft",
      author: { id: teacher._id.toString() },
      publishedAt: null,
    });
    const read = await agent.get(`/api/courses/${course.id}`).expect(200);
    expect(courseDetailSchema.parse(read.body)).toMatchObject({
      ...course,
      lessons: [],
      tests: [],
    });
    const renamed = await agent
      .patch(`/api/courses/${course.id}`)
      .send({ title: "Обновлённый курс" })
      .expect(200);
    expect(courseSchema.parse(renamed.body).title).toBe("Обновлённый курс");
    await Lesson.create({
      courseId: course.id,
      title: "Первый урок",
      order: 1,
      content: "Учебный материал",
      durationMinutes: 10,
      status: "published",
      isRequired: true,
    });
    const published = await agent
      .post(`/api/courses/${course.id}/publish`)
      .expect(200);
    expect(courseSchema.parse(published.body)).toMatchObject({
      status: "published",
      lessonsCount: 1,
    });
    expect(courseSchema.parse(published.body).publishedAt).not.toBeNull();
    const refused = await agent.delete(`/api/courses/${course.id}`).expect(409);
    expect(apiErrorSchema.parse(refused.body).code).toBe(
      "course_delete_forbidden",
    );
    expect(await Course.findById(course.id)).toMatchObject({
      title: "Обновлённый курс",
      status: "published",
    });
  });

  it("deletes a draft and its children while retaining an unrelated assignment", async () => {
    const teacher = await createUser({ role: "teacher" });
    const student = await createUser();
    const course = await Course.create({
      title: "Черновик курса",
      category: "Обучение",
      audience: "general",
      shortDescription: "Черновик для проверки удаления",
      authorId: teacher._id,
    });
    const lesson = await Lesson.create({
      courseId: course._id,
      title: "Урок черновика",
      order: 1,
      content: "Материал",
      durationMinutes: 5,
    });
    await Test.create({
      courseId: course._id,
      lessonId: lesson._id,
      title: "Тест черновика",
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
    const otherCourse = await Course.create({
      title: "Другой курс",
      category: "Обучение",
      audience: "general",
      shortDescription: "Опубликованный курс другого назначения",
      authorId: teacher._id,
      status: "published",
    });
    const assignment = await CourseAssignment.create({
      courseId: otherCourse._id,
      userId: student._id,
      assignedBy: teacher._id,
    });
    const before = await CourseAssignment.findById(assignment._id).lean();
    expect(await Lesson.countDocuments({ courseId: course._id })).toBe(1);
    expect(await Test.countDocuments({ courseId: course._id })).toBe(1);
    const agent = await signIn(teacher.email, TEST_PASSWORD);
    await agent.delete(`/api/courses/${course._id}`).expect(204);
    expect(await Course.findById(course._id)).toBeNull();
    expect(await Lesson.countDocuments({ courseId: course._id })).toBe(0);
    expect(await Test.countDocuments({ courseId: course._id })).toBe(0);
    expect(await CourseAssignment.findById(assignment._id).lean()).toEqual(
      before,
    );
  });

  it("refuses another teacher's course", async () => {
    const owner = await createUser({ role: "teacher" });
    const other = await createUser({ role: "teacher" });
    const course = await Course.create({
      title: "Чужой курс",
      category: "Обучение",
      audience: "general",
      shortDescription: "Курс принадлежит другому преподавателю",
      authorId: owner._id,
    });
    const agent = await signIn(other.email, TEST_PASSWORD);
    const response = await agent.get(`/api/courses/${course._id}`).expect(403);
    expect(apiErrorSchema.parse(response.body).code).toBe("forbidden");
  });
});
