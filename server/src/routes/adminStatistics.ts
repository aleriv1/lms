import {
  adminStatisticsResponseSchema,
  adminStatisticsQuerySchema,
  objectIdSchema,
  userStatisticsSchema,
  type AdminStatisticsQuery,
  type AdminStatisticsRow,
  type LearnerCourseStat,
} from "@lms/shared";
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { AppError } from "../errors/AppError.js";
import { sumCompletedLessonMinutes } from "../learning/courseProgress.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { Course } from "../models/Course.js";
import { LessonProgress } from "../models/LessonProgress.js";
import { TestAttempt } from "../models/TestAttempt.js";
import { toPublicUser, User } from "../models/User.js";
import { loadAttemptSummaries } from "../statistics/attemptSummaries.js";
import {
  averagePairProgress,
  averageProgressOverUsers,
  byAssignedAtDesc,
  buildCourseProgressStats,
  countPairsWithStatus,
  groupPairsByUser,
  loadPairProgress,
  PAIR_STAGES,
  PAIR_STAGES_WITH_HISTORY,
  type PairProgress,
} from "../statistics/pairProgress.js";

/**
 * The two administrative statistics screens (specification 7.15, 7.16). The
 * permission matrix of 3.2 gives both to the administrator alone — a teacher is
 * refused here just as a learner is.
 */
export const adminStatisticsRouter = Router();

adminStatisticsRouter.use(requireAuth, requireRole("admin"));

const userParamsSchema = z.object({ userId: objectIdSchema });

/** "Active — performed a learning action within the last 30 days" (7.15). */
const ACTIVE_WINDOW_DAYS = 30;

/**
 * The learning actions specification 7.16 lists are opening a lesson,
 * completing a lesson, submitting a test and finishing a course. The first two
 * both land in `updatedAt` of the progress row — `start` creates it, `complete`
 * updates it. Submitting a test needs the second read: an attempt at the final
 * test of a course touches no lesson progress at all, and its author would
 * otherwise be counted inactive on the day they finished the course. Finishing
 * a course leaves no trace of its own but never happens without a last lesson
 * or a last attempt, so it is already covered.
 */
async function countActiveUsers(): Promise<number> {
  const since = new Date(
    Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  const [progressUsers, attemptUsers] = await Promise.all([
    LessonProgress.aggregate<{ _id: Types.ObjectId }>([
      { $match: { updatedAt: { $gte: since } } },
      { $group: { _id: "$userId" } },
    ]),
    TestAttempt.aggregate<{ _id: Types.ObjectId }>([
      { $match: { submittedAt: { $gte: since } } },
      { $group: { _id: "$userId" } },
    ]),
  ]);

  const active = new Set(
    [...progressUsers, ...attemptUsers].map((row) => row._id.toString()),
  );

  return active.size;
}

async function loadCourseTitles(
  courseIds: string[],
): Promise<Map<string, string>> {
  if (courseIds.length === 0) {
    return new Map();
  }

  const courses = await Course.find({ _id: { $in: courseIds } }).select(
    "title",
  );

  return new Map(
    courses.map((course) => [course._id.toString(), course.title]),
  );
}

function toLearnerCourseStat(
  pair: PairProgress,
  title: string,
): LearnerCourseStat {
  return {
    courseId: pair.courseId,
    title,
    assignmentStatus: pair.assignmentStatus,
    progressPercent: pair.progressPercent,
    completedAt: pair.completedAt?.toISOString() ?? null,
  };
}

/**
 * Specification 7.15. `courseId`, `groupName` and `learningStatus` are part of
 * the contract and are **not** applied in stage 1 (specification 18.2, the
 * slice plan puts the filters in slice 12). `learningStatus` is derived from
 * progress, so filtering by it before pagination — the only way `meta.total`
 * can stay honest — means computing progress for every user and selecting in
 * Node, which is the thing this slice is reviewed for not doing. It arrives
 * with the pagination moved inside one pipeline.
 */
adminStatisticsRouter.get(
  "/",
  validate(adminStatisticsQuerySchema, "query"),
  async (request, response) => {
    const query = request.query as unknown as AdminStatisticsQuery;

    const [total, users, pairs, activeUsersCount] = await Promise.all([
      User.countDocuments({}),
      // Every account, any role and any status: specification 4.3 allows an
      // assignment for any role, narrowing the table is the job of the filters
      // that are not here yet, and only this composition makes
      // `summary.usersCount` equal to `meta.total`. There is no sort parameter
      // in the query schema, so the order is fixed — by the name the table of
      // 7.15 starts with.
      User.find({})
        .sort({ name: 1, _id: 1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize),
      // One read for the whole answer: the rows of the page, the summary and
      // the per-course averages are all assembled from it.
      loadPairProgress({ statuses: PAIR_STAGES }),
      countActiveUsers(),
    ]);

    const pairsByUser = groupPairsByUser(pairs);

    const items: AdminStatisticsRow[] = users.map((user) => {
      // A user with no assignment gives three zeroes rather than being skipped:
      // they are counted in `meta.total`, and a hole in the page would be worse
      // than a row of zeroes.
      const own = pairsByUser.get(user._id.toString()) ?? [];

      return {
        userId: user._id.toString(),
        name: user.name,
        groupName: user.groupName,
        activeCoursesCount: countPairsWithStatus(own, "active"),
        completedCoursesCount: countPairsWithStatus(own, "completed"),
        averageProgressPercent: averagePairProgress(own),
      };
    });

    const completedUsers = new Set(
      pairs
        .filter((pair) => pair.assignmentStatus === "completed")
        .map((pair) => pair.userId),
    );

    const courseTitles = await loadCourseTitles([
      ...new Set(pairs.map((pair) => pair.courseId)),
    ]);

    response.json(
      adminStatisticsResponseSchema.parse({
        summary: {
          usersCount: total,
          activeUsersCount,
          completedUsersCount: completedUsers.size,
          averageProgressPercent: averageProgressOverUsers(pairs),
        },
        courseProgress: buildCourseProgressStats(pairs, courseTitles),
        items,
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

/** Specification 7.16: the card of one learner. */
adminStatisticsRouter.get(
  "/users/:userId",
  validate(userParamsSchema, "params"),
  async (request, response) => {
    const user = await User.findById(request.params.userId as string);

    if (!user) {
      throw new AppError(404, "not_found", "Пользователь не найден");
    }

    // History included, unlike the learner's own profile: 7.16 asks for "the
    // assigned courses", and a course taken away should not fall out of the
    // administrator's history. `revokedRank` in the pipeline makes a revoked
    // row show up only for a course with no assignment in force.
    const [pairs, totalLearningMinutes, testResults] = await Promise.all([
      loadPairProgress({
        userId: user._id,
        statuses: PAIR_STAGES_WITH_HISTORY,
      }),
      sumCompletedLessonMinutes(user._id),
      loadAttemptSummaries(user._id),
    ]);

    // The figures cover the assignments in force only, so they agree with what
    // the learner sees on their own screens. A revoked pair shows its current
    // progress — no snapshot of progress at the moment of revocation exists
    // anywhere (specification 8.6) — and takes part in no average.
    const inForce = pairs.filter(
      (pair) => pair.assignmentStatus !== "revoked",
    );

    const courseTitles = await loadCourseTitles(
      pairs.map((pair) => pair.courseId),
    );

    response.json(
      userStatisticsSchema.parse({
        user: toPublicUser(user),
        averageProgressPercent: averagePairProgress(inForce),
        completedCoursesCount: countPairsWithStatus(inForce, "completed"),
        totalLearningMinutes,
        courses: [...pairs]
          .sort(byAssignedAtDesc)
          .flatMap((pair) => {
            const title = courseTitles.get(pair.courseId);
            return title === undefined
              ? []
              : [toLearnerCourseStat(pair, title)];
          }),
        testResults,
        // `ActivityEvent` does not exist yet (specification 8.8); slice 12.
        recentActivity: [],
      }),
    );
  },
);
