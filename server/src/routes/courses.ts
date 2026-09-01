import {
  courseDetailSchema,
  courseListItemSchema,
  courseSchema,
  coursesQuerySchema,
  createCourseBodySchema,
  createListResponseSchema,
  objectIdSchema,
  updateCourseBodySchema,
  type CoursesQuery,
  type CreateCourseBody,
  type UpdateCourseBody,
} from "@lms/shared";
import { Router, type RequestHandler } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { loadOwnedCourse } from "../courses/courseAccess.js";
import { buildCourseFilter, buildCourseSort } from "../courses/courseQuery.js";
import { collectPublicationIssues } from "../courses/publishRules.js";
import { AppError } from "../errors/AppError.js";
import {
  getAuthenticatedUser,
  requireAuth,
} from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import {
  Course,
  COURSE_AUTHOR_FIELDS,
  toCourse,
  toCourseListItem,
} from "../models/Course.js";

export const coursesRouter = Router();

const courseParamsSchema = z.object({ courseId: objectIdSchema });

const captureCourseUpdateFields: RequestHandler = (request, response, next) => {
  const body: unknown = request.body;
  response.locals.courseUpdateFields =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? Object.keys(body)
      : [];
  next();
};

coursesRouter.use(requireAuth, requireRole("teacher", "admin"));

coursesRouter.get(
  "/",
  validate(coursesQuerySchema, "query"),
  async (request, response) => {
    const query = request.query as unknown as CoursesQuery;
    const filter = buildCourseFilter(query);

    const [courses, total] = await Promise.all([
      Course.find(filter)
        .sort(buildCourseSort(query))
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize)
        .populate<{
          authorId: { _id: Types.ObjectId; name: string };
        }>("authorId", COURSE_AUTHOR_FIELDS),
      Course.countDocuments(filter),
    ]);

    response.json(
      createListResponseSchema(courseListItemSchema).parse({
        items: courses.map((course) => toCourseListItem(course, 0)),
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        },
      }),
    );
  },
);

coursesRouter.post(
  "/",
  validate(createCourseBodySchema),
  async (request, response) => {
    const user = getAuthenticatedUser(request);
    const body = request.body as CreateCourseBody;
    const course = await Course.create({
      ...body,
      authorId: user.id,
      status: "draft",
      publishedAt: null,
    });
    const populatedCourse = await course.populate<{
      authorId: { _id: Types.ObjectId; name: string };
    }>("authorId", COURSE_AUTHOR_FIELDS);

    response.status(201).json(courseSchema.parse(toCourse(populatedCourse, 0)));
  },
);

coursesRouter.get(
  "/:courseId",
  validate(courseParamsSchema, "params"),
  async (request, response) => {
    const courseId = request.params.courseId as string;
    const course = await loadOwnedCourse(
      courseId,
      getAuthenticatedUser(request),
    );

    response.json(
      courseDetailSchema.parse({
        ...toCourse(course, 0),
        lessons: [],
        tests: [],
      }),
    );
  },
);

coursesRouter.patch(
  "/:courseId",
  validate(courseParamsSchema, "params"),
  captureCourseUpdateFields,
  validate(updateCourseBodySchema),
  async (request, response) => {
    const courseId = request.params.courseId as string;
    const course = await loadOwnedCourse(
      courseId,
      getAuthenticatedUser(request),
    );
    const body = request.body as UpdateCourseBody;
    const submittedFields = new Set(
      response.locals.courseUpdateFields as (keyof UpdateCourseBody)[],
    );

    if (submittedFields.has("title") && body.title !== undefined) {
      course.title = body.title;
    }
    if (submittedFields.has("category") && body.category !== undefined) {
      course.category = body.category;
    }
    if (submittedFields.has("audience") && body.audience !== undefined) {
      course.audience = body.audience;
    }
    if (
      submittedFields.has("shortDescription") &&
      body.shortDescription !== undefined
    ) {
      course.shortDescription = body.shortDescription;
    }
    if (submittedFields.has("description") && body.description !== undefined) {
      course.description = body.description;
    }
    if (submittedFields.has("coverUrl") && body.coverUrl !== undefined) {
      course.coverUrl = body.coverUrl;
    }
    await course.save();

    response.json(courseSchema.parse(toCourse(course, 0)));
  },
);

coursesRouter.delete(
  "/:courseId",
  validate(courseParamsSchema, "params"),
  async (request, response) => {
    const courseId = request.params.courseId as string;
    const course = await loadOwnedCourse(
      courseId,
      getAuthenticatedUser(request),
    );

    if (course.status !== "draft") {
      throw new AppError(
        409,
        "course_delete_forbidden",
        "Опубликованный курс нельзя удалить — его можно архивировать",
      );
    }

    await course.deleteOne();
    response.sendStatus(204);
  },
);

coursesRouter.post(
  "/:courseId/publish",
  validate(courseParamsSchema, "params"),
  async (request, response) => {
    const courseId = request.params.courseId as string;
    const course = await loadOwnedCourse(
      courseId,
      getAuthenticatedUser(request),
    );

    if (course.status === "published") {
      throw new AppError(409, "conflict", "Курс уже опубликован");
    }

    const issues = collectPublicationIssues(course);
    if (issues.length > 0) {
      throw new AppError(
        422,
        "course_not_publishable",
        "Курс нельзя опубликовать: не выполнены условия",
        issues,
      );
    }

    course.status = "published";
    course.publishedAt ??= new Date();
    await course.save();

    response.json(courseSchema.parse(toCourse(course, 0)));
  },
);

coursesRouter.post(
  "/:courseId/archive",
  validate(courseParamsSchema, "params"),
  async (request, response) => {
    const courseId = request.params.courseId as string;
    const course = await loadOwnedCourse(
      courseId,
      getAuthenticatedUser(request),
    );

    if (course.status === "archived") {
      throw new AppError(409, "conflict", "Курс уже в архиве");
    }

    course.status = "archived";
    await course.save();

    response.json(courseSchema.parse(toCourse(course, 0)));
  },
);
