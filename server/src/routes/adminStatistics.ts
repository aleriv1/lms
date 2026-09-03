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
import { Types, type FilterQuery } from "mongoose";
import { z } from "zod";

import { buildStatisticsUserFilter } from "../admin/userQuery.js";
import { AppError } from "../errors/AppError.js";
import { sumCompletedLessonMinutes } from "../learning/courseProgress.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import { Course } from "../models/Course.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import { LessonProgress } from "../models/LessonProgress.js";
import { TestAttempt } from "../models/TestAttempt.js";
import { toPublicUser, User, type UserAttributes } from "../models/User.js";
import { loadAttemptSummaries } from "../statistics/attemptSummaries.js";
import { loadRecentActivity } from "../statistics/activityFeed.js";
import {
  averagePairProgress,
  averageProgressOverUsers,
  byAssignedAtDesc,
  buildCourseProgressStats,
  countPairsWithStatus,
  groupPairsByUser,
  learningStatusOf,
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
async function countActiveUsers(userIds?: Types.ObjectId[]): Promise<number> {
  const since = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Narrowed to the filtered users for the reason the pairs are: the figure
  // stands over the table and has to describe the people in it.
  const scoped = userIds ? { userId: { $in: userIds } } : {};

  const [progressUsers, attemptUsers] = await Promise.all([
    LessonProgress.aggregate<{ _id: Types.ObjectId }>([
      { $match: { updatedAt: { $gte: since }, ...scoped } },
      { $group: { _id: "$userId" } },
    ]),
    TestAttempt.aggregate<{ _id: Types.ObjectId }>([
      { $match: { submittedAt: { $gte: since }, ...scoped } },
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
 * The set of users the page describes. Everything the answer reports — the
 * rows, the summary above them and the per-course averages — is built from
 * this one set, so the headline figures always describe the people in the
 * table and not a wider crowd.
 *
 * Course and group define the initial scope. The handler then applies
 * `learningStatus` using the pairs already needed for the summary.
 */
async function resolveScope(query: AdminStatisticsQuery): Promise<{
  filter: FilterQuery<UserAttributes>;
  courseId?: Types.ObjectId;
  filtered: boolean;
}> {
  const courseId = query.courseId
    ? new Types.ObjectId(query.courseId)
    : undefined;

  // An unassigned course gives an empty list, and an empty `$in` is the right
  // answer for it — an empty page, not the whole collection.
  const assignedUserIds = courseId
    ? ((await CourseAssignment.distinct("userId", {
        courseId,
        status: { $in: PAIR_STAGES },
      })) as Types.ObjectId[])
    : undefined;

  return {
    filter: buildStatisticsUserFilter({
      groupName: query.groupName,
      assignedUserIds,
    }),
    courseId,
    filtered: courseId !== undefined || Boolean(query.groupName),
  };
}

/**
 * Specification 7.15. All three filters narrow the whole answer before
 * MongoDB counts and paginates the matching users.
 */
adminStatisticsRouter.get(
  "/",
  validate(adminStatisticsQuerySchema, "query"),
  async (request, response) => {
    const query = request.query as unknown as AdminStatisticsQuery;
    const scope = await resolveScope(query);

    // Unfiltered, the table holds every account, of any role and any status:
    // specification 4.3 allows an assignment for any role, and narrowing the
    // table is the job of the filters rather than of a hidden rule. There is no
    // sort parameter in the query schema, so the order is fixed — by the name
    // the table of 7.15 starts with.
    //
    // The identifiers are read only when a filter is on. They bound the pairs
    // to the same people the table shows; without a filter the pairs are read
    // for everybody and no list is needed at all.
    const scopedUserIds = scope.filtered
      ? ((await User.distinct("_id", scope.filter)) as Types.ObjectId[])
      : undefined;

    const allPairs = await loadPairProgress({
      statuses: PAIR_STAGES,
      users: scopedUserIds,
      courseId: scope.courseId,
    });
    let filter = scope.filter;
    let pairs = allPairs;
    let activeUserIds = scopedUserIds;

    if (query.learningStatus) {
      const userIds =
        scopedUserIds ??
        ((await User.distinct("_id", scope.filter)) as Types.ObjectId[]);
      const grouped = groupPairsByUser(allPairs);
      const matchedIds = userIds.filter(
        (id) =>
          learningStatusOf(grouped.get(id.toString()) ?? []) ===
          query.learningStatus,
      );
      const matched = new Set(matchedIds.map((id) => id.toString()));
      filter = { ...scope.filter, _id: { $in: matchedIds } };
      pairs = allPairs.filter((pair) => matched.has(pair.userId));
      activeUserIds = matchedIds;
    }

    const [total, users, activeUsersCount] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .sort({ name: 1, _id: 1 })
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize),
      countActiveUsers(activeUserIds),
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
    const [pairs, totalLearningMinutes, testResults, recentActivity] =
      await Promise.all([
        loadPairProgress({
          users: user._id,
          statuses: PAIR_STAGES_WITH_HISTORY,
        }),
        sumCompletedLessonMinutes(user._id),
        loadAttemptSummaries(user._id),
        loadRecentActivity(user._id),
      ]);

    // The figures cover the assignments in force only, so they agree with what
    // the learner sees on their own screens. A revoked pair shows its current
    // progress — no snapshot of progress at the moment of revocation exists
    // anywhere (specification 8.6) — and takes part in no average.
    const inForce = pairs.filter((pair) => pair.assignmentStatus !== "revoked");

    const courseTitles = await loadCourseTitles(
      pairs.map((pair) => pair.courseId),
    );

    response.json(
      userStatisticsSchema.parse({
        user: toPublicUser(user),
        averageProgressPercent: averagePairProgress(inForce),
        completedCoursesCount: countPairsWithStatus(inForce, "completed"),
        totalLearningMinutes,
        courses: [...pairs].sort(byAssignedAtDesc).flatMap((pair) => {
          const title = courseTitles.get(pair.courseId);
          return title === undefined ? [] : [toLearnerCourseStat(pair, title)];
        }),
        testResults,
        recentActivity,
      }),
    );
  },
);
