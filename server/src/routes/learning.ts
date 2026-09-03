import {
  learningCourseSchema,
  learningLessonSchema,
  learningOverviewSchema,
  lessonProgressResponseSchema,
  objectIdSchema,
  type LearningCourseCard,
  type LearningTestRef,
} from "@lms/shared";
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { isDuplicateKeyError } from "../db/duplicateKey.js";
import { AppError } from "../errors/AppError.js";
import {
  lessonLockedError,
  lessonTestRequiredError,
} from "../learning/accessRules.js";
import {
  loadReadableAssignedCourse,
  loadStudiableAssignedCourse,
} from "../learning/assignedCourse.js";
import {
  findAttemptStats,
  hasPassedTest,
  NO_ATTEMPTS,
  type AttemptStats,
} from "../learning/attemptStats.js";
import {
  findFinalTestState,
  settleCourseCompletion,
} from "../learning/courseCompletion.js";
import {
  computeCourseProgress,
  findLastActivityByCourse,
  loadCourseLearningState,
  sumCompletedLessonMinutes,
} from "../learning/courseProgress.js";
import { completeLesson } from "../learning/lessonCompletion.js";
import { recordActivity } from "../learning/activityLog.js";
import {
  computeProgressPercent,
  findAdjacentLessons,
  isCourseCompleted,
} from "../learning/lessonStates.js";
import {
  getAuthenticatedUser,
  requireAuth,
} from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { averagePercent } from "../statistics/pairProgress.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import { Lesson, type LessonDocument } from "../models/Lesson.js";
import { LessonProgress } from "../models/LessonProgress.js";
import { Test } from "../models/Test.js";
import { learningStatisticsRouter } from "./learningStatistics.js";
import { learningTestsRouter } from "./learningTests.js";

/**
 * The learner's half of the system (specification 9.3). No `requireRole` here:
 * specification 4.3 allows an assignment for any role — "a teacher and an
 * administrator may take training too" — so the role decides nothing and the
 * assignment decides everything.
 */
export const learningRouter = Router();

learningRouter.use(requireAuth);

// Taking a test lives in its own file: two handlers plus the scoring would have
// made this one unreadable end to end. The statistics of specification 7.8 are
// out for the same reason.
learningRouter.use("/tests", learningTestsRouter);
learningRouter.use("/me/statistics", learningStatisticsRouter);

const courseParamsSchema = z.object({ courseId: objectIdSchema });
const courseLessonParamsSchema = z.object({
  courseId: objectIdSchema,
  lessonId: objectIdSchema,
});
const lessonParamsSchema = z.object({ lessonId: objectIdSchema });

/** Exactly the course fields a card of specification 7.4 shows. */
const LEARNING_CARD_COURSE_FIELDS = "title shortDescription coverUrl status";

type PopulatedCardCourse = {
  _id: Types.ObjectId;
  title: string;
  shortDescription: string;
  coverUrl: string | null;
  status: LearningCourseCard["courseStatus"];
};

type LearningTestSource = {
  _id: Types.ObjectId;
  title: string;
  passingScore: number;
};

/**
 * A test as the learner sees it listed. The three result fields come from
 * `TestAttempt` (slice 08); a test nobody has attempted reports the same
 * `false`, `null` and `0` this function returned unconditionally before
 * attempts existed.
 */
function toLearningTestRef(
  test: LearningTestSource,
  stats: AttemptStats = NO_ATTEMPTS,
): LearningTestRef {
  return {
    id: test._id.toString(),
    title: test.title,
    passingScore: test.passingScore,
    ...stats,
  };
}

/** The lesson a learning action addresses: published, or it does not exist. */
async function loadPublishedLesson(lessonId: string): Promise<LessonDocument> {
  const lesson = await Lesson.findById(lessonId);

  // A draft lesson answers 404 and not 403: a learner has no business knowing
  // that an unpublished lesson exists (specification 4.2).
  if (!lesson || lesson.status !== "published") {
    throw new AppError(404, "not_found", "Урок не найден");
  }

  return lesson;
}

/**
 * Specification 7.4. Every figure on the page is computed here: the count of
 * courses, the total time and the overall progress have to agree with the cards
 * below them, so they are derived from the same set of assignments.
 */
learningRouter.get("/me", async (request, response) => {
  const userId = new Types.ObjectId(getAuthenticatedUser(request).id);

  const assignments = await CourseAssignment.find({
    userId,
    status: { $in: ["active", "completed"] },
  })
    .sort({ assignedAt: -1, _id: -1 })
    .populate<{ courseId: PopulatedCardCourse }>(
      "courseId",
      LEARNING_CARD_COURSE_FIELDS,
    );

  // Specification 7.4 counts courses, not rows. A course finished and then
  // assigned again leaves two assignments in force (8.5 forbids only a second
  // active one), and listing both would show one course twice, count it twice
  // and give it double weight in the average below. The list is sorted newest
  // first, so the first row of a course is the one that governs it.
  const seenCourseIds = new Set<string>();
  const currentAssignments = assignments.filter((assignment) => {
    const courseId = assignment.courseId._id.toString();

    if (seenCourseIds.has(courseId)) {
      return false;
    }

    seenCourseIds.add(courseId);
    return true;
  });

  const courseIds = currentAssignments.map(
    (assignment) => assignment.courseId._id,
  );

  const [counts, lastActivity, totalLearningMinutes] = await Promise.all([
    computeCourseProgress(userId, courseIds),
    findLastActivityByCourse(userId, courseIds),
    sumCompletedLessonMinutes(userId),
  ]);

  const courses: LearningCourseCard[] = currentAssignments.map((assignment) => {
    const course = assignment.courseId;
    const courseId = course._id.toString();
    const count = counts.get(courseId) ?? { completed: 0, total: 0 };

    return {
      courseId,
      title: course.title,
      shortDescription: course.shortDescription,
      coverUrl: course.coverUrl,
      courseStatus: course.status,
      assignmentStatus: assignment.status,
      progressPercent: computeProgressPercent(count),
      completedLessonsCount: count.completed,
      requiredLessonsCount: count.total,
      lastActivityAt: lastActivity.get(courseId)?.toISOString() ?? null,
    };
  });

  // "The average progress over the assignments in force" (7.4): the same set
  // the cards show, so the two numbers on the page cannot disagree. The
  // averaging itself is shared with the statistics of slice 09 — one rounding
  // rule for the whole project.
  const overallProgressPercent = averagePercent(
    courses.map((course) => course.progressPercent),
  );

  response.json(
    learningOverviewSchema.parse({
      assignedCoursesCount: courses.length,
      totalLearningMinutes,
      overallProgressPercent,
      courses,
    }),
  );
});

/** Specification 7.5: the assigned course with the state of every lesson. */
learningRouter.get(
  "/courses/:courseId",
  validate(courseParamsSchema, "params"),
  async (request, response) => {
    const user = getAuthenticatedUser(request);
    const userId = new Types.ObjectId(user.id);
    const { course, assignment } = await loadReadableAssignedCourse(
      request.params.courseId as string,
      user.id,
    );

    const [state, tests] = await Promise.all([
      loadCourseLearningState(userId, course._id),
      Test.find({ courseId: course._id }).select("title passingScore lessonId"),
    ]);

    const lessonTests = new Map<string, LearningTestSource>();
    let finalTest: LearningTestSource | null = null;
    for (const test of tests) {
      if (test.lessonId) {
        lessonTests.set(test.lessonId.toString(), test);
      } else {
        finalTest = test;
      }
    }

    // One aggregation for every test of the course, not one per test: the page
    // must not issue a query per lesson (specification 11.2).
    const attemptStats = await findAttemptStats(
      userId,
      tests.map((test) => test._id),
    );

    response.json(
      learningCourseSchema.parse({
        id: course._id.toString(),
        title: course.title,
        shortDescription: course.shortDescription,
        description: course.description,
        category: course.category,
        audience: course.audience,
        coverUrl: course.coverUrl,
        author: {
          id: course.authorId._id.toString(),
          name: course.authorId.name,
        },
        courseStatus: course.status,
        assignmentStatus: assignment.status,
        progressPercent: state.progressPercent,
        lessons: state.lessons.map((lesson) => {
          const lessonId = lesson._id.toString();

          return {
            id: lessonId,
            title: lesson.title,
            order: lesson.order,
            durationMinutes: lesson.durationMinutes,
            isRequired: lesson.isRequired,
            state: state.stateByLessonId.get(lessonId)?.state ?? "locked",
            hasTest: lessonTests.has(lessonId),
          };
        }),
        finalTest: finalTest
          ? toLearningTestRef(
              finalTest,
              attemptStats.get(finalTest._id.toString()),
            )
          : null,
        nextLessonId: state.nextLessonId,
      }),
    );
  },
);

/** Specification 7.6: the lesson itself, refused outright when it is locked. */
learningRouter.get(
  "/courses/:courseId/lessons/:lessonId",
  validate(courseLessonParamsSchema, "params"),
  async (request, response) => {
    const user = getAuthenticatedUser(request);
    const userId = new Types.ObjectId(user.id);
    const { course } = await loadReadableAssignedCourse(
      request.params.courseId as string,
      user.id,
    );

    // Somebody else's lesson reached by a direct link must look exactly like a
    // missing one, so the course is part of the query rather than a later check.
    const lesson = await Lesson.findOne({
      _id: request.params.lessonId as string,
      courseId: course._id,
      status: "published",
    });

    if (!lesson) {
      throw new AppError(404, "not_found", "Урок не найден");
    }

    // The identifier of the loaded document, never the one from the path: both
    // spellings of a hexadecimal identifier pass `objectIdSchema`, and a map
    // keyed by `_id.toString()` would miss the upper-case one.
    const lessonId = lesson._id.toString();
    const state = await loadCourseLearningState(userId, course._id);
    const lessonState = state.stateByLessonId.get(lessonId);

    if (!lessonState || lessonState.state === "locked") {
      throw lessonLockedError();
    }

    const requiredTest = await Test.findOne({ lessonId: lesson._id }).select(
      "title passingScore",
    );
    const requiredTestStats = requiredTest
      ? (await findAttemptStats(userId, [requiredTest._id])).get(
          requiredTest._id.toString(),
        )
      : undefined;

    response.json(
      learningLessonSchema.parse({
        id: lessonId,
        courseId: course._id.toString(),
        title: lesson.title,
        order: lesson.order,
        durationMinutes: lesson.durationMinutes,
        isRequired: lesson.isRequired,
        content: lesson.content,
        videoUrl: lesson.videoUrl,
        resourceLinks: lesson.resourceLinks.map((link) => ({
          title: link.title,
          url: link.url,
        })),
        progressStatus: lessonState.progressStatus,
        requiredTest: requiredTest
          ? toLearningTestRef(requiredTest, requiredTestStats)
          : null,
        ...findAdjacentLessons(state.states, lessonId),
        courseProgressPercent: state.progressPercent,
      }),
    );
  },
);

/**
 * Both actions answer 200 with the recomputed progress rather than 201: the row
 * may be created or updated, a repeated click has to be harmless (5.3), and
 * what the client needs back is the progress, not which of the two happened.
 */
learningRouter.post(
  "/lessons/:lessonId/start",
  validate(lessonParamsSchema, "params"),
  async (request, response) => {
    const user = getAuthenticatedUser(request);
    const userId = new Types.ObjectId(user.id);
    const lesson = await loadPublishedLesson(request.params.lessonId as string);
    const { course } = await loadStudiableAssignedCourse(
      lesson.courseId,
      user.id,
    );

    const state = await loadCourseLearningState(userId, lesson.courseId);
    const lessonState = state.stateByLessonId.get(lesson._id.toString());

    if (!lessonState || lessonState.state === "locked") {
      throw lessonLockedError();
    }

    let status = lessonState.progressStatus;

    if (status === "not_started") {
      try {
        await LessonProgress.create({
          userId,
          courseId: lesson.courseId,
          lessonId: lesson._id,
          status: "in_progress",
          startedAt: new Date(),
        });
        await recordActivity({
          userId,
          type: "lesson_started",
          course: { id: course._id, title: course.title },
          lesson: { id: lesson._id, title: lesson.title },
        });
      } catch (error) {
        // Two simultaneous clicks: the unique index closes the window the check
        // above leaves open, and the second one has nothing left to do.
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }

      status = "in_progress";
    }

    response.json(
      lessonProgressResponseSchema.parse({
        lessonId: lesson._id.toString(),
        courseId: lesson.courseId.toString(),
        status,
        // Starting a lesson changes no lesson's state, so the course figures
        // are the ones computed above.
        courseProgressPercent: state.progressPercent,
        // Starting a lesson completes nothing, so this reports the state and
        // does not settle it: the transition belongs to `complete` and to a
        // passing attempt.
        courseCompleted: isCourseCompleted(
          state.required,
          await findFinalTestState(userId, lesson.courseId),
        ),
        nextLessonId: state.nextLessonId,
      }),
    );
  },
);

/**
 * Specification 4.2: a lesson without a mandatory test is completed by the
 * learner's action; a lesson with one is completed only by a passing result.
 */
learningRouter.post(
  "/lessons/:lessonId/complete",
  validate(lessonParamsSchema, "params"),
  async (request, response) => {
    const user = getAuthenticatedUser(request);
    const userId = new Types.ObjectId(user.id);
    const lesson = await loadPublishedLesson(request.params.lessonId as string);
    const { course, assignment } = await loadStudiableAssignedCourse(
      lesson.courseId,
      user.id,
    );

    const state = await loadCourseLearningState(userId, course._id);
    const lessonState = state.stateByLessonId.get(lesson._id.toString());

    if (!lessonState || lessonState.state === "locked") {
      throw lessonLockedError();
    }

    if (lessonState.progressStatus !== "completed") {
      // The lesson has no flag of its own for this: the link to a test is what
      // makes the test mandatory (specification 4.2, 8.3). A passing attempt
      // lifts the refusal, and it is looked up by the test rather than by the
      // attempt's own `lessonId`, because a test reattached after the attempt
      // is still the test that was passed.
      const lessonTest = await Test.findOne({ lessonId: lesson._id }).select(
        "_id",
      );

      if (lessonTest && !(await hasPassedTest(userId, lessonTest._id))) {
        throw lessonTestRequiredError();
      }

      await completeLesson(userId, lesson);
      await recordActivity({
        userId,
        type: "lesson_completed",
        course: { id: course._id, title: course.title },
        lesson: { id: lesson._id, title: lesson.title },
      });
    }

    const updated = await loadCourseLearningState(userId, course._id);
    const courseCompleted = await settleCourseCompletion(
      userId,
      course,
      assignment,
      updated.required,
    );

    response.json(
      lessonProgressResponseSchema.parse({
        lessonId: lesson._id.toString(),
        courseId: course._id.toString(),
        status: "completed",
        courseProgressPercent: updated.progressPercent,
        courseCompleted,
        nextLessonId: updated.nextLessonId,
      }),
    );
  },
);
