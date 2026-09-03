import type {
  AssignmentStatus,
  CourseProgressStat,
  LearningStatus,
} from "@lms/shared";
import type { Types } from "mongoose";

import { computeProgressPercent } from "../learning/lessonStates.js";
import { CourseAssignment } from "../models/CourseAssignment.js";
import { Lesson } from "../models/Lesson.js";
import { LessonProgress } from "../models/LessonProgress.js";

/**
 * The one place where "how far has this learner got in this course" is
 * answered for statistics. Every figure of slice 09 — the dashboard average,
 * the summary of the statistics page, the rows of its table, the card of one
 * learner and the learner's own profile — is assembled from the output of
 * `loadPairProgress`, and nothing recomputes progress on its own.
 *
 * That is the point of the module rather than a tidiness preference. The
 * progress formula already exists in `learning/lessonStates.ts` and already
 * shows up on three learning screens; a second formula here would give the
 * project two plausible numbers for the same thing.
 *
 * The unit of counting is the pair `userId + courseId` and not the assignment:
 * `LessonProgress` has no assignment (specification 8.6), which is what makes
 * "progress is restored on a repeated assignment" (4.3) free and what makes a
 * snapshot of progress at the moment of revocation impossible — there is no
 * such number anywhere in the database.
 */

export type PairProgress = {
  userId: string;
  courseId: string;
  /** The status of the assignment that governs the pair (see `PAIR_STAGES`). */
  assignmentStatus: AssignmentStatus;
  assignedAt: Date;
  completedAt: Date | null;
  completed: number;
  total: number;
  progressPercent: number;
};

export function learningStatusOf(pairs: PairProgress[]): LearningStatus {
  if (pairs.length === 0) return "not_started";
  if (pairs.every((pair) => pair.assignmentStatus === "completed"))
    return "completed";
  if (pairs.every((pair) => pair.completed === 0)) return "not_started";
  return "in_progress";
}

export type PairScope = {
  /**
   * Omitted — every learner. One identifier — a learner's own two screens. A
   * list — the users a filter of 7.15 left on the statistics page; the pairs
   * have to be narrowed with the table, or the summary above it would describe
   * a different set of people than the rows below.
   */
  users?: Types.ObjectId | Types.ObjectId[];
  /** Set by the `courseId` filter of 7.15: only the pairs of that course. */
  courseId?: Types.ObjectId;
  statuses: AssignmentStatus[];
};

/**
 * The scope as a `$match` fragment. Both fields sit on indexed keys of the two
 * collections, so a filtered page costs the same reads as an unfiltered one.
 */
function scopeMatch(scope: PairScope): Record<string, unknown> {
  const users = scope.users;

  return {
    ...(users ? { userId: Array.isArray(users) ? { $in: users } : users } : {}),
    ...(scope.courseId ? { courseId: scope.courseId } : {}),
  };
}

/* --- The three reads --------------------------------------------------- */

type AssignmentPairRow = {
  _id: { userId: Types.ObjectId; courseId: Types.ObjectId };
  status: AssignmentStatus;
  assignedAt: Date;
  completedAt: Date | null;
};

type CourseTotalRow = { _id: Types.ObjectId; total: number };

type CompletedPairRow = {
  _id: { userId: Types.ObjectId; courseId: Types.ObjectId };
  completed: number;
};

/**
 * Required published lessons per course. Not narrowed to the courses of the
 * scope even when the scope is a single learner: the output is bounded by the
 * number of courses (specification 11.2 sizes the local set at 200), so
 * narrowing would cost a list of identifiers and save nothing.
 */
function aggregateCourseTotals(): Promise<CourseTotalRow[]> {
  return Lesson.aggregate<CourseTotalRow>([
    { $match: { status: "published", isRequired: true } },
    { $group: { _id: "$courseId", total: { $sum: 1 } } },
  ]);
}

/**
 * Completed required published lessons per pair. The shape repeats
 * `sumCompletedLessonMinutes` — lookup, unwind, group — and groups by the
 * `courseId` of the progress row rather than of the lesson: the field is
 * denormalised for exactly this (`models/LessonProgress.ts`) and
 * `computeCourseProgress` reads it the same way.
 *
 * The grouping happens in the database, so what crosses into Node is one row
 * per pair and not one per completed lesson.
 */
function aggregateCompletedPairs(
  scope: PairScope,
): Promise<CompletedPairRow[]> {
  return LessonProgress.aggregate<CompletedPairRow>([
    { $match: { status: "completed", ...scopeMatch(scope) } },
    {
      $lookup: {
        from: Lesson.collection.name,
        localField: "lessonId",
        foreignField: "_id",
        as: "lesson",
      },
    },
    { $unwind: "$lesson" },
    { $match: { "lesson.status": "published", "lesson.isRequired": true } },
    {
      $group: {
        _id: { userId: "$userId", courseId: "$courseId" },
        completed: { $sum: 1 },
      },
    },
  ]);
}

/**
 * Assignments reduced to pairs. Specification 7.4 counts courses and not rows
 * of assignment, so a course assigned again after it was finished takes part
 * once, and the newest row governs it — the same rule, with the same sort, that
 * `/learning/me` applies with a `Set`.
 *
 * `revokedRank` is the only addition, and only the administrator's card needs
 * it: a non-revoked row always outranks a revoked one, so a course shows as
 * revoked only when it has no assignment in force. With `revoked` outside
 * `statuses` the rank is identically zero and the sort degenerates to the
 * original one.
 */
function aggregateAssignmentPairs(
  scope: PairScope,
): Promise<AssignmentPairRow[]> {
  return CourseAssignment.aggregate<AssignmentPairRow>([
    { $match: { status: { $in: scope.statuses }, ...scopeMatch(scope) } },
    {
      $addFields: {
        revokedRank: { $cond: [{ $eq: ["$status", "revoked"] }, 1, 0] },
      },
    },
    { $sort: { revokedRank: 1, assignedAt: -1, _id: -1 } },
    {
      $group: {
        _id: { userId: "$userId", courseId: "$courseId" },
        status: { $first: "$status" },
        assignedAt: { $first: "$assignedAt" },
        completedAt: { $first: "$completedAt" },
      },
    },
  ]);
}

/* --- Assembly ---------------------------------------------------------- */

function pairKey(userId: string, courseId: string): string {
  return `${userId}:${courseId}`;
}

/**
 * Joins the three reads. The percentage is computed here, by the same pure
 * function the learning screens use, and deliberately not in the pipeline:
 * MongoDB's `$round` rounds a half to even while `Math.round` rounds it up, so
 * a pair at 1 of 8 required lessons would be 12% in the database and 13% on
 * the course page. Rounding is the only arithmetic left for Node, and it is
 * precisely the arithmetic that must not move into the database.
 *
 * A progress row without an assignment in the scope is dropped: the assignment
 * decides which pairs exist, progress only fills them in.
 */
export function assemblePairProgress(
  assignments: AssignmentPairRow[],
  courseTotals: CourseTotalRow[],
  completedPairs: CompletedPairRow[],
): PairProgress[] {
  const totalByCourseId = new Map(
    courseTotals.map((row) => [row._id.toString(), row.total]),
  );
  const completedByPair = new Map(
    completedPairs.map((row) => [
      pairKey(row._id.userId.toString(), row._id.courseId.toString()),
      row.completed,
    ]),
  );

  return assignments.map((assignment) => {
    const userId = assignment._id.userId.toString();
    const courseId = assignment._id.courseId.toString();
    const count = {
      completed: completedByPair.get(pairKey(userId, courseId)) ?? 0,
      total: totalByCourseId.get(courseId) ?? 0,
    };

    return {
      userId,
      courseId,
      assignmentStatus: assignment.status,
      assignedAt: assignment.assignedAt,
      completedAt: assignment.completedAt,
      completed: count.completed,
      total: count.total,
      progressPercent: computeProgressPercent(count),
    };
  });
}

export async function loadPairProgress(
  scope: PairScope,
): Promise<PairProgress[]> {
  const [assignments, courseTotals, completedPairs] = await Promise.all([
    aggregateAssignmentPairs(scope),
    aggregateCourseTotals(),
    aggregateCompletedPairs(scope),
  ]);

  return assemblePairProgress(assignments, courseTotals, completedPairs);
}

/** The statuses that make an assignment count towards a figure (7.4). */
export const PAIR_STAGES: AssignmentStatus[] = ["active", "completed"];

/** Everything the administrator's card of one learner shows, history included. */
export const PAIR_STAGES_WITH_HISTORY: AssignmentStatus[] = [
  "active",
  "revoked",
  "completed",
];

/* --- Averages ---------------------------------------------------------- */

/**
 * The average of whole percentages, rounded to a whole number; an empty list
 * is 0. One function for the whole project, `overallProgressPercent` of
 * `/learning/me` included.
 */
export function averagePercent(percents: number[]): number {
  if (percents.length === 0) {
    return 0;
  }

  const sum = percents.reduce((total, percent) => total + percent, 0);
  return Math.round(sum / percents.length);
}

export function groupPairsByUser(
  pairs: PairProgress[],
): Map<string, PairProgress[]> {
  const byUser = new Map<string, PairProgress[]>();

  for (const pair of pairs) {
    const own = byUser.get(pair.userId);
    if (own) {
      own.push(pair);
    } else {
      byUser.set(pair.userId, [pair]);
    }
  }

  return byUser;
}

export function averagePairProgress(pairs: PairProgress[]): number {
  return averagePercent(pairs.map((pair) => pair.progressPercent));
}

/**
 * "Average progress" as both administrator screens report it (specification
 * 7.10, 7.15): the average over the learners who have at least one pair, each
 * learner counted by their own average over courses. A user with no assignment
 * stays out of the denominator — the figure is about training, and counting
 * zeroes for every account would make the dashboard depend on how many
 * administrators the installation has.
 */
export function averageProgressOverUsers(pairs: PairProgress[]): number {
  return averagePercent(
    [...groupPairsByUser(pairs).values()].map(averagePairProgress),
  );
}

export function countPairsWithStatus(
  pairs: PairProgress[],
  status: AssignmentStatus,
): number {
  return pairs.filter((pair) => pair.assignmentStatus === status).length;
}

/**
 * Average progress per course (specification 7.15). Only courses that have at
 * least one pair appear: there is nothing to average for a course nobody was
 * assigned. A course whose title cannot be resolved is dropped for the reason
 * `attemptSummaries` drops a nameless test — the contract has no field for
 * "deleted".
 */
export function buildCourseProgressStats(
  pairs: PairProgress[],
  titleByCourseId: Map<string, string>,
): CourseProgressStat[] {
  const byCourse = new Map<string, PairProgress[]>();

  for (const pair of pairs) {
    const own = byCourse.get(pair.courseId);
    if (own) {
      own.push(pair);
    } else {
      byCourse.set(pair.courseId, [pair]);
    }
  }

  const stats: CourseProgressStat[] = [];

  for (const [courseId, coursePairs] of byCourse) {
    const title = titleByCourseId.get(courseId);

    if (title === undefined) {
      continue;
    }

    stats.push({
      courseId,
      title,
      assignedUsersCount: coursePairs.length,
      averageProgressPercent: averagePairProgress(coursePairs),
    });
  }

  return stats.sort((first, second) =>
    first.title.localeCompare(second.title, "ru"),
  );
}

/** Newest assignment first, as the cards of "My learning" are ordered. */
export function byAssignedAtDesc(
  first: PairProgress,
  second: PairProgress,
): number {
  return second.assignedAt.getTime() - first.assignedAt.getTime();
}
