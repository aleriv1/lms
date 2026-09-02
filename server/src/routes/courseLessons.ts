import {
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
import { buildCourseDetail } from "../courses/courseDetail.js";
import { isDuplicateKeyError } from "../db/duplicateKey.js";
import { AppError } from "../errors/AppError.js";
import { loadCourseLesson } from "../lessons/lessonAccess.js";
import {
  applyReorder,
  ensureOrderIsFree,
  orderConflictError,
  planReorder,
} from "../lessons/lessonOrder.js";
import { sanitizeLessonContent } from "../lessons/sanitizeContent.js";
import { getAuthenticatedUser } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { Lesson, toLesson, type LessonDocument } from "../models/Lesson.js";
import {
  assertLessonHasNoTest,
  attachTestToLesson,
  ensureTestCanBeAttached,
  findLinkedTestId,
} from "../tests/testLink.js";

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

    // The lesson does not exist yet, so the test is checked before the write
    // and attached after it. There is no transaction — Mongo runs as a single
    // container — and a race between the two writes is repaired by saving the
    // form again.
    if (body.testId !== null) {
      await ensureTestCanBeAttached(course._id, body.testId);
    }
    const content = prepareContent(body.content);
    await ensureOrderIsFree(course._id, body.order);

    let lesson: LessonDocument;
    try {
      lesson = await Lesson.create({
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
    } catch (error) {
      // The check above leaves a window open; the unique index closes it.
      if (isDuplicateKeyError(error)) {
        throw orderConflictError();
      }

      throw error;
    }

    // Outside the block above: a duplicate key raised while linking the test
    // would be a conflict over the lesson's test, not over its number.
    if (body.testId !== null) {
      await attachTestToLesson(course._id, body.testId, lesson._id);
    }

    // A lesson created a moment ago can carry no other link.
    response
      .status(201)
      .json(lessonSchema.parse(toLesson(lesson, body.testId)));
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

    response.json(await buildCourseDetail(course));
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

    // Specification 7.13 lets the lesson form pick a test, but only attaching
    // is honoured here: `LessonForm` sends `testId: null` unconditionally, so
    // treating null as "detach" would break the link on every lesson save.
    // Detaching belongs to the test form, which owns the field.
    if (submittedFields.has("testId") && body.testId) {
      await attachTestToLesson(lesson.courseId, body.testId, lesson._id);
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

    response.json(
      lessonSchema.parse(
        toLesson(lesson, await findLinkedTestId(lesson._id)),
      ),
    );
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

    await assertLessonHasNoTest(lesson._id);

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

    response.json(
      lessonSchema.parse(toLesson(lesson, await findLinkedTestId(lesson._id))),
    );
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

    response.json(
      lessonSchema.parse(toLesson(lesson, await findLinkedTestId(lesson._id))),
    );
  },
);
