import {
  courseDetailSchema,
  createLessonBodySchema,
  lessonSchema,
  objectIdSchema,
  reorderLessonsBodySchema,
  updateLessonBodySchema,
  type CreateLessonBody,
  type FieldError,
  type ReorderLessonsBody,
  type UpdateLessonBody,
} from "@lms/shared";
import { Router, type RequestHandler } from "express";
import { z } from "zod";

import { loadOwnedCourse } from "../courses/courseAccess.js";
import { AppError } from "../errors/AppError.js";
import { loadCourseLesson } from "../lessons/lessonAccess.js";
import {
  applyReorder,
  ensureOrderIsFree,
  isDuplicateKeyError,
  orderConflictError,
  planReorder,
} from "../lessons/lessonOrder.js";
import { sanitizeLessonContent } from "../lessons/sanitizeContent.js";
import { getAuthenticatedUser } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { toCourse } from "../models/Course.js";
import {
  Lesson,
  toLesson,
  toLessonSummary,
  type LessonDocument,
} from "../models/Lesson.js";

/** Mounted under `/courses/:courseId/lessons`, so `courseId` comes from the parent. */
export const courseLessonsRouter = Router({ mergeParams: true });

const courseParamsSchema = z.object({ courseId: objectIdSchema });
// `validate(..., "params")` replaces `request.params` with the parsed object and
// Zod drops unknown keys, so a child schema has to name `courseId` too — without
// it the merged parameter would not survive to the handler.
const lessonParamsSchema = z.object({
  courseId: objectIdSchema,
  lessonId: objectIdSchema,
});

const captureLessonUpdateFields: RequestHandler = (request, response, next) => {
  const body: unknown = request.body;
  response.locals.lessonUpdateFields =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? Object.keys(body)
      : [];
  next();
};

/**
 * Zod validates the raw input, where `<script>x</script>` is not empty; after
 * cleaning nothing may be left. Hence the second check, carrying the message the
 * schema uses, so the client shows it the same way.
 */
function prepareContent(raw: string): string {
  const content = sanitizeLessonContent(raw);

  if (!content.trim()) {
    throw new AppError(
      422,
      "validation_error",
      "Проверьте правильность заполнения полей",
      [{ field: "content", message: "Содержание обязательно" }],
    );
  }

  return content;
}

/**
 * Until slice 05 there is no `Test` collection, so any identifier sent here
 * points at a test that does not exist. The branch becomes a real lookup there.
 */
function ensureTestExists(testId: string | null): void {
  if (testId !== null) {
    throw new AppError(404, "not_found", "Тест не найден");
  }
}

function readCourseLessons(courseId: string): Promise<LessonDocument[]> {
  return Lesson.find({ courseId }).sort({ order: 1 }).exec();
}

courseLessonsRouter.post(
  "/",
  validate(courseParamsSchema, "params"),
  validate(createLessonBodySchema),
  async (request, response) => {
    const courseId = request.params.courseId as string;
    const course = await loadOwnedCourse(
      courseId,
      getAuthenticatedUser(request),
    );
    const body = request.body as CreateLessonBody;

    ensureTestExists(body.testId);
    const content = prepareContent(body.content);
    await ensureOrderIsFree(course._id, body.order);

    try {
      const lesson = await Lesson.create({
        courseId: course._id,
        title: body.title,
        order: body.order,
        content,
        durationMinutes: body.durationMinutes,
        videoUrl: body.videoUrl,
        resourceLinks: body.resourceLinks,
        isRequired: body.isRequired,
        status: "draft",
      });

      response.status(201).json(lessonSchema.parse(toLesson(lesson)));
    } catch (error) {
      // The check above leaves a window open; the unique index closes it.
      if (isDuplicateKeyError(error)) {
        throw orderConflictError();
      }

      throw error;
    }
  },
);

courseLessonsRouter.post(
  "/reorder",
  validate(courseParamsSchema, "params"),
  validate(reorderLessonsBodySchema),
  async (request, response) => {
    const courseId = request.params.courseId as string;
    const course = await loadOwnedCourse(
      courseId,
      getAuthenticatedUser(request),
    );
    const body = request.body as ReorderLessonsBody;

    const existingLessons = await readCourseLessons(courseId);
    const plan = planReorder(
      existingLessons.map((lesson) => lesson._id.toString()),
      body.lessons,
    );
    await applyReorder(course._id, plan);

    const lessons = await readCourseLessons(courseId);
    response.json(
      courseDetailSchema.parse({
        ...toCourse(course, lessons.length),
        lessons: lessons.map((lesson) => toLessonSummary(lesson)),
        tests: [],
      }),
    );
  },
);

courseLessonsRouter.patch(
  "/:lessonId",
  validate(lessonParamsSchema, "params"),
  captureLessonUpdateFields,
  validate(updateLessonBodySchema),
  async (request, response) => {
    const { courseId, lessonId } = request.params as {
      courseId: string;
      lessonId: string;
    };
    const { lesson } = await loadCourseLesson(
      courseId,
      lessonId,
      getAuthenticatedUser(request),
    );
    const body = request.body as UpdateLessonBody;
    // `.partial()` does not remove `.default()` inside a field, so the parsed
    // body carries `resourceLinks`, `isRequired` and `testId` even when the
    // client sent none of them. Only the keys actually submitted are assigned.
    const submittedFields = new Set(
      response.locals.lessonUpdateFields as (keyof UpdateLessonBody)[],
    );

    if (submittedFields.has("testId") && body.testId !== undefined) {
      ensureTestExists(body.testId);
    }
    if (submittedFields.has("title") && body.title !== undefined) {
      lesson.title = body.title;
    }
    if (submittedFields.has("content") && body.content !== undefined) {
      lesson.content = prepareContent(body.content);
    }
    if (
      submittedFields.has("durationMinutes") &&
      body.durationMinutes !== undefined
    ) {
      lesson.durationMinutes = body.durationMinutes;
    }
    if (submittedFields.has("videoUrl") && body.videoUrl !== undefined) {
      lesson.videoUrl = body.videoUrl;
    }
    if (
      submittedFields.has("resourceLinks") &&
      body.resourceLinks !== undefined
    ) {
      lesson.resourceLinks = body.resourceLinks;
    }
    if (submittedFields.has("isRequired") && body.isRequired !== undefined) {
      lesson.isRequired = body.isRequired;
    }
    if (submittedFields.has("order") && body.order !== undefined) {
      await ensureOrderIsFree(lesson.courseId, body.order, lesson._id);
      lesson.order = body.order;
    }

    try {
      await lesson.save();
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw orderConflictError();
      }

      throw error;
    }

    response.json(lessonSchema.parse(toLesson(lesson)));
  },
);

courseLessonsRouter.delete(
  "/:lessonId",
  validate(lessonParamsSchema, "params"),
  async (request, response) => {
    const { courseId, lessonId } = request.params as {
      courseId: string;
      lessonId: string;
    };
    const { lesson } = await loadCourseLesson(
      courseId,
      lessonId,
      getAuthenticatedUser(request),
    );

    // Gaps in the numbering are fine: order comes from sorting by `order`, and
    // renumbering the remaining lessons would be an unexpected side effect.
    await lesson.deleteOne();
    response.sendStatus(204);
  },
);

courseLessonsRouter.post(
  "/:lessonId/publish",
  validate(lessonParamsSchema, "params"),
  async (request, response) => {
    const { courseId, lessonId } = request.params as {
      courseId: string;
      lessonId: string;
    };
    const { lesson } = await loadCourseLesson(
      courseId,
      lessonId,
      getAuthenticatedUser(request),
    );

    if (lesson.status === "published") {
      throw new AppError(409, "conflict", "Урок уже опубликован");
    }

    const issues: FieldError[] = [];
    if (!lesson.title.trim()) {
      issues.push({ field: "title", message: "Укажите название урока" });
    }
    if (!lesson.content.trim()) {
      issues.push({ field: "content", message: "Содержание обязательно" });
    }
    if (issues.length > 0) {
      throw new AppError(
        422,
        "unprocessable",
        "Урок нельзя опубликовать: не выполнены условия",
        issues,
      );
    }

    lesson.status = "published";
    await lesson.save();

    response.json(lessonSchema.parse(toLesson(lesson)));
  },
);

courseLessonsRouter.post(
  "/:lessonId/unpublish",
  validate(lessonParamsSchema, "params"),
  async (request, response) => {
    const { courseId, lessonId } = request.params as {
      courseId: string;
      lessonId: string;
    };
    const { lesson } = await loadCourseLesson(
      courseId,
      lessonId,
      getAuthenticatedUser(request),
    );

    if (lesson.status === "draft") {
      throw new AppError(409, "conflict", "Урок не опубликован");
    }

    // Specification 4.2: unpublishing never touches stored progress.
    lesson.status = "draft";
    await lesson.save();

    response.json(lessonSchema.parse(toLesson(lesson)));
  },
);
