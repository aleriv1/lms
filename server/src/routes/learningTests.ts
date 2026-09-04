import {
  attemptResultSchema,
  learnerTestSchema,
  objectIdSchema,
  submitAttemptBodySchema,
  type PublicUser,
  type SubmitAttemptBody,
} from "@lms/shared";
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { isDuplicateKeyError } from "../db/duplicateKey.js";
import { AppError } from "../errors/AppError.js";
import { lessonLockedError } from "../learning/accessRules.js";
import {
  buildAttemptReview,
  buildQuestionsSnapshot,
  gradeAttempt,
} from "../learning/attemptScoring.js";
import {
  loadReadableAssignedCourse,
  loadStudiableAssignedCourse,
} from "../learning/assignedCourse.js";
import { settleCourseCompletion } from "../learning/courseCompletion.js";
import { recordActivity } from "../learning/activityLog.js";
import type { CourseDocumentWithAuthor } from "../models/Course.js";
import { loadCourseLearningState } from "../learning/courseProgress.js";
import { completeLesson } from "../learning/lessonCompletion.js";
import { getAuthenticatedUser } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import type { CourseAssignmentDocument } from "../models/CourseAssignment.js";
import { Lesson, type LessonDocument } from "../models/Lesson.js";
import { Test, type TestDocument } from "../models/Test.js";
import {
  TestAttempt,
  type TestAttemptAttributes,
  type TestAttemptDocument,
} from "../models/TestAttempt.js";

/**
 * Taking a test (specification 7.7, 9.3). Mounted inside the learning router,
 * so `requireAuth` is already in place and no role is checked here for the same
 * reason as everywhere in `learning.ts`: specification 4.3 allows an assignment
 * for any role, so the assignment decides and the role decides nothing.
 */
export const learningTestsRouter = Router();

const testParamsSchema = z.object({ testId: objectIdSchema });

type LearnerTestAccess = {
  test: TestDocument;
  course: CourseDocumentWithAuthor;
  assignment: CourseAssignmentDocument;
  /** The lesson this test closes, or `null` for a final test of the course. */
  lesson: LessonDocument | null;
};

/**
 * The whole access story of the slice. A test is reached through its course, as
 * in `tests/testAccess.ts`: the entity is found first and its course grants the
 * rights.
 *
 * The part that matters is the lesson. Without it, the test of lesson 3 opens
 * by a direct link past the locks on lessons 1 and 2, and a passing attempt on
 * it completes lesson 3 — a jump over the whole course. So a lesson test is
 * refused exactly when its lesson would be.
 *
 * A final test (`lessonId === null`) is not locked by lessons. Specification
 * 4.2 gives the sequence to lessons and says nothing about the final test;
 * finishing the course still requires every mandatory lesson (4.3), so passing
 * it early finishes nothing early, and attempts are unlimited (4.4), so an
 * early one costs nothing.
 */
async function loadLearnerTest(
  testId: string,
  user: PublicUser,
  intent: "read" | "submit",
): Promise<LearnerTestAccess> {
  const test = await Test.findById(testId);

  if (!test) {
    throw new AppError(404, "not_found", "Тест не найден");
  }

  // Reading an archived course is history (7.4); acting on it is not, and
  // "must not start new attempts" is exactly this branch.
  const { course, assignment } =
    intent === "read"
      ? await loadReadableAssignedCourse(test.courseId, user.id)
      : await loadStudiableAssignedCourse(test.courseId, user.id);

  if (!test.lessonId) {
    return { test, course, assignment, lesson: null };
  }

  const lesson = await Lesson.findOne({
    _id: test.lessonId,
    courseId: course._id,
    status: "published",
  });

  // A draft lesson does not exist for the learner (specification 4.2), and
  // neither does its test: 403 would announce something hidden.
  if (!lesson) {
    throw new AppError(404, "not_found", "Тест не найден");
  }

  const state = await loadCourseLearningState(
    new Types.ObjectId(user.id),
    course._id,
  );
  const lessonState = state.stateByLessonId.get(lesson._id.toString());

  if (!lessonState || lessonState.state === "locked") {
    throw lessonLockedError();
  }

  return { test, course, assignment, lesson };
}

/** Specification 4.4, 10.3: the learner's view carries no `isCorrect`. */
learningTestsRouter.get(
  "/:testId",
  validate(testParamsSchema, "params"),
  async (request, response) => {
    const { test } = await loadLearnerTest(
      request.params.testId as string,
      getAuthenticatedUser(request),
      "read",
    );

    response.json(
      learnerTestSchema.parse({
        id: test._id.toString(),
        courseId: test.courseId.toString(),
        lessonId: test.lessonId ? test.lessonId.toString() : null,
        title: test.title,
        passingScore: test.passingScore,
        // Built field by field rather than spread: `learnerQuestionSchema` is
        // not `.strict()` and drops `isCorrect` silently, so `parse` is a
        // second line of defence and never the only one.
        questions: [...test.questions]
          .sort((first, second) => first.order - second.order)
          .map((question) => ({
            id: question._id.toString(),
            text: question.text,
            type: question.type,
            order: question.order,
            // Options keep their stored order: nothing shuffles them, and the
            // snapshot of an attempt has to match what the learner saw.
            options: question.options.map((option) => ({
              id: option._id.toString(),
              text: option.text,
            })),
          })),
      }),
    );
  },
);

const ATTEMPT_NUMBER_RETRIES = 3;

type NewAttempt = Omit<
  TestAttemptAttributes,
  "attemptNumber" | "createdAt" | "updatedAt"
>;

/**
 * The attempt number is counted, and counting leaves a window before the write.
 * The unique index closes it, and a rejected write means somebody took the
 * number: count again and retry, as `start` does with its progress row.
 *
 * There is no de-duplication of attempts beyond that, and that is a decision
 * rather than an omission: `submitAttemptBodySchema` carries no idempotency
 * key, and two identical attempts in a row are legitimate — attempts are
 * unlimited (4.4). Guarding a double click belongs to the client, which locks
 * the form while the request is in flight. The server promises one thing: two
 * attempts never share a number.
 */
async function createAttempt(
  attempt: NewAttempt,
): Promise<TestAttemptDocument> {
  for (let retry = 0; retry < ATTEMPT_NUMBER_RETRIES; retry += 1) {
    const attemptNumber =
      (await TestAttempt.countDocuments({
        userId: attempt.userId,
        testId: attempt.testId,
      })) + 1;

    try {
      return await TestAttempt.create({ ...attempt, attemptNumber });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  throw new AppError(
    409,
    "conflict",
    "Не удалось сохранить попытку, попробуйте ещё раз",
  );
}

/**
 * Specification 4.3, 4.4: the client sends the chosen options and nothing else.
 * The score, the pass and what the pass unlocks are all decided here.
 */
learningTestsRouter.post(
  "/:testId/attempts",
  validate(testParamsSchema, "params"),
  validate(submitAttemptBodySchema),
  async (request, response) => {
    const user = getAuthenticatedUser(request);
    const userId = new Types.ObjectId(user.id);
    const body = request.body as SubmitAttemptBody;
    const { test, course, assignment, lesson } = await loadLearnerTest(
      request.params.testId as string,
      user,
      "submit",
    );

    // Specification 7.17: the attempt is graded against its own snapshot, so an
    // edit landing between these two lines cannot split the result.
    const questionsSnapshot = buildQuestionsSnapshot(test.questions);
    const graded = gradeAttempt(
      questionsSnapshot,
      body.answers,
      test.passingScore,
    );

    const attempt = await createAttempt({
      userId,
      testId: test._id,
      courseId: course._id,
      lessonId: lesson ? lesson._id : null,
      testVersion: test.version,
      questionsSnapshot,
      answers: graded.answers,
      correctCount: graded.correctCount,
      totalCount: graded.totalCount,
      score: graded.score,
      passed: graded.passed,
      submittedAt: new Date(),
    });
    await recordActivity({
      userId,
      type: "test_submitted",
      course: { id: course._id, title: course.title },
      lesson: lesson ? { id: lesson._id, title: lesson.title } : null,
    });

    // Only a pass changes anything. A failed attempt is recorded and leaves the
    // course exactly as it was, so recomputing it would be two queries spent on
    // a state that cannot have moved.
    if (graded.passed) {
      // Specification 7.7: "a successful result unlocks what follows". A test
      // attached to a lesson is what makes that lesson's test mandatory
      // (4.2, 8.3), so passing it completes the lesson itself.
      // Specification 8.8 lists lesson completion among the events the feed
      // must hold, and this is the second way a lesson gets completed. The
      // return value keeps a repeated pass on a finished lesson from writing a
      // second event.
      if (lesson && (await completeLesson(userId, lesson))) {
        await recordActivity({
          userId,
          type: "lesson_completed",
          course: { id: course._id, title: course.title },
          lesson: { id: lesson._id, title: lesson.title },
        });
      }

      // Reached after any pass, not only a final test: a lesson closed by its
      // own test may have been the last mandatory one, and then the course is
      // finished by this very request.
      const state = await loadCourseLearningState(userId, course._id);
      await settleCourseCompletion(userId, course, assignment, state.required);
    }

    response.status(201).json(
      attemptResultSchema.parse({
        review: buildAttemptReview(questionsSnapshot, graded.answers),
        id: attempt._id.toString(),
        testId: test._id.toString(),
        courseId: course._id.toString(),
        lessonId: lesson ? lesson._id.toString() : null,
        score: graded.score,
        passingScore: test.passingScore,
        passed: graded.passed,
        correctCount: graded.correctCount,
        totalCount: graded.totalCount,
        attemptNumber: attempt.attemptNumber,
        submittedAt: attempt.submittedAt.toISOString(),
      }),
    );
  },
);
