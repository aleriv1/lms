import {
  createTestBodySchema,
  objectIdSchema,
  testSchema,
  updateTestBodySchema,
  type CreateTestBody,
  type UpdateTestBody,
} from "@lms/shared";
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { loadOwnedCourse } from "../courses/courseAccess.js";
import { isDuplicateKeyError } from "../db/duplicateKey.js";
import { getAuthenticatedUser } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { Test, toTest } from "../models/Test.js";
import { buildQuestions } from "../tests/questionRules.js";
import { loadCourseTest } from "../tests/testAccess.js";
import {
  ensureTestLinkIsFree,
  lessonTestConflictError,
} from "../tests/testLink.js";

/** Mounted under `/courses/:courseId/tests`, so `courseId` comes from the parent. */
export const courseTestsRouter = Router({ mergeParams: true });

const courseParamsSchema = z.object({ courseId: objectIdSchema });
// As in the lessons router: `validate(..., "params")` replaces `request.params`
// with the parsed object and Zod drops unknown keys, so a child schema has to
// name `courseId` too or the merged parameter never reaches the handler.
const testParamsSchema = z.object({
  courseId: objectIdSchema,
  testId: objectIdSchema,
});

courseTestsRouter.post(
  "/",
  validate(courseParamsSchema, "params"),
  validate(createTestBodySchema),
  async (request, response) => {
    const courseId = request.params.courseId as string;
    const course = await loadOwnedCourse(
      courseId,
      getAuthenticatedUser(request),
    );
    const body = request.body as CreateTestBody;

    // The body is judged before the state it would be written into:
    // specification 9.5 keeps 422 for a body that is wrong on its own terms and
    // 409 for a conflict with what is stored. A 409 carries no `fields`, so
    // answering it first would hide the form errors the body also has.
    const questions = buildQuestions(body.questions);
    await ensureTestLinkIsFree(course._id, body.lessonId);

    try {
      const test = await Test.create({
        courseId: course._id,
        lessonId: body.lessonId,
        title: body.title,
        passingScore: body.passingScore,
        version: 1,
        questions,
      });

      response.status(201).json(testSchema.parse(toTest(test)));
    } catch (error) {
      // The check above leaves a window open; the unique index closes it.
      if (isDuplicateKeyError(error)) {
        throw lessonTestConflictError();
      }

      throw error;
    }
  },
);

/**
 * Specification 7.17 saves a test whole and replaces its questions, so the
 * update schema is the create schema and this handler assigns every field. A
 * client that sends only what changed unlinks the test and resets the passing
 * score — the form submits all of it.
 */
courseTestsRouter.patch(
  "/:testId",
  validate(testParamsSchema, "params"),
  validate(updateTestBodySchema),
  async (request, response) => {
    const { courseId, testId } = request.params as {
      courseId: string;
      testId: string;
    };
    const { test } = await loadCourseTest(
      courseId,
      testId,
      getAuthenticatedUser(request),
    );
    const body = request.body as UpdateTestBody;

    const questions = buildQuestions(body.questions);
    await ensureTestLinkIsFree(test.courseId, body.lessonId, test._id);

    test.title = body.title;
    test.lessonId =
      body.lessonId === null ? null : new Types.ObjectId(body.lessonId);
    test.passingScore = body.passingScore;
    test.questions = questions;
    // A reference counter (specification 7.17): nothing is restored from it, so
    // it grows on every save rather than on a detected change.
    test.version += 1;

    try {
      await test.save();
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw lessonTestConflictError();
      }

      throw error;
    }

    response.json(testSchema.parse(toTest(test)));
  },
);

courseTestsRouter.delete(
  "/:testId",
  validate(testParamsSchema, "params"),
  async (request, response) => {
    const { courseId, testId } = request.params as {
      courseId: string;
      testId: string;
    };
    const { test } = await loadCourseTest(
      courseId,
      testId,
      getAuthenticatedUser(request),
    );

    await test.deleteOne();
    response.sendStatus(204);
  },
);
