import {
  learnerStatisticsSchema,
  type LearnerCourseStat,
} from "@lms/shared";
import { Router } from "express";
import { Types } from "mongoose";

import { sumCompletedLessonMinutes } from "../learning/courseProgress.js";
import { getAuthenticatedUser } from "../middleware/requireAuth.js";
import { Course } from "../models/Course.js";
import { LessonProgress } from "../models/LessonProgress.js";
import { loadAttemptSummaries } from "../statistics/attemptSummaries.js";
import {
  averagePairProgress,
  byAssignedAtDesc,
  countPairsWithStatus,
  loadPairProgress,
  PAIR_STAGES,
} from "../statistics/pairProgress.js";

/**
 * `GET /learning/me/statistics` (specification 7.8). Its own file rather than
 * another handler in `learning.ts`, which is already 477 lines — the threshold
 * at which slice 08 moved taking a test out of it was 496.
 *
 * Authentication comes from `learningRouter.use(requireAuth)` above; there is
 * no role check here for the reason there is none anywhere in `learning.ts`
 * (specification 4.3 allows an assignment for any role).
 *
 * The learner is taken from the session and the route has no identifier in its
 * path at all. That is how the risk zone "a learner sees only their own
 * statistics" is met: somebody else's cannot be requested, because a request of
 * that shape does not exist.
 */
export const learningStatisticsRouter = Router();

learningStatisticsRouter.get("/", async (request, response) => {
  const userId = new Types.ObjectId(getAuthenticatedUser(request).id);

  // Without `revoked`: specification 7.8 names the contents of the profile as
  // "the active and the finished courses". `/learning/me` is built from the
  // same set, so the overall progress here and there is one number computed by
  // one function.
  const [pairs, totalLearningMinutes, completedLessonsCount, testResults] =
    await Promise.all([
      loadPairProgress({ users: userId, statuses: PAIR_STAGES }),
      sumCompletedLessonMinutes(userId),
      // Every completed lesson, optional ones and courses with a revoked
      // assignment included: 7.8 asks for "the number of completed lessons"
      // without a qualifier, the same choice `totalLearningMinutes` makes.
      LessonProgress.countDocuments({ userId, status: "completed" }),
      loadAttemptSummaries(userId),
    ]);

  const courses = await Course.find({
    _id: { $in: pairs.map((pair) => pair.courseId) },
  }).select("title");
  const titleByCourseId = new Map(
    courses.map((course) => [course._id.toString(), course.title]),
  );

  const courseStats: LearnerCourseStat[] = [...pairs]
    .sort(byAssignedAtDesc)
    .flatMap((pair) => {
      const title = titleByCourseId.get(pair.courseId);

      return title === undefined
        ? []
        : [
            {
              courseId: pair.courseId,
              title,
              assignmentStatus: pair.assignmentStatus,
              progressPercent: pair.progressPercent,
              completedAt: pair.completedAt?.toISOString() ?? null,
            },
          ];
    });

  response.json(
    learnerStatisticsSchema.parse({
      totalLearningMinutes,
      completedLessonsCount,
      completedCoursesCount: countPairsWithStatus(pairs, "completed"),
      overallProgressPercent: averagePairProgress(pairs),
      courses: courseStats,
      testResults,
      // Both are filled from `ActivityEvent` in slice 12 (specification 18.2).
      activityWeeks: [],
      recentActivity: [],
    }),
  );
});
