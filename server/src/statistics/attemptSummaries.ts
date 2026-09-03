import type { TestAttemptSummary } from "@lms/shared";
import type { Types } from "mongoose";

import { Course } from "../models/Course.js";
import { Test } from "../models/Test.js";
import { TestAttempt } from "../models/TestAttempt.js";

/**
 * The history of attempts as statistics shows it. Specification 4.4 asks for
 * "the last and the best attempt" of each test, and both screens that show the
 * history — the administrator's card of one learner (7.16) and the learner's
 * own profile (7.8) — ask this module for it, so the rule lives once.
 *
 * The number of attempts per test is not limited by specification 4.4, so the
 * two attempts are picked by the database rather than by reading them all: two
 * `$top` accumulators over one group. The output carries neither
 * `questionsSnapshot` nor `answers` — the snapshot is the heaviest field in
 * the database and the history has no use for it in any form.
 */

type AttemptFields = {
  id: Types.ObjectId;
  testId: Types.ObjectId;
  courseId: Types.ObjectId;
  score: number;
  passed: boolean;
  attemptNumber: number;
  submittedAt: Date;
};

export type AttemptTopRow = {
  _id: Types.ObjectId;
  last: AttemptFields;
  best: AttemptFields;
};

const ATTEMPT_OUTPUT = {
  id: "$_id",
  testId: "$testId",
  courseId: "$courseId",
  score: "$score",
  passed: "$passed",
  attemptNumber: "$attemptNumber",
  submittedAt: "$submittedAt",
};

/**
 * Ties are resolved explicitly: with equal scores the later attempt is the
 * better one, hence `submittedAt` as the second key of `best` and `_id` as the
 * third, for two attempts submitted within the same millisecond.
 */
function aggregateTopAttempts(
  userId: Types.ObjectId,
): Promise<AttemptTopRow[]> {
  return TestAttempt.aggregate<AttemptTopRow>([
    { $match: { userId } },
    {
      $group: {
        _id: "$testId",
        last: {
          $top: {
            sortBy: { submittedAt: -1, _id: -1 },
            output: ATTEMPT_OUTPUT,
          },
        },
        best: {
          $top: {
            sortBy: { score: -1, submittedAt: -1, _id: -1 },
            output: ATTEMPT_OUTPUT,
          },
        },
      },
    },
  ]);
}

/**
 * One row per test when the last attempt is also the best one, two otherwise.
 * The flags sit on the row rather than splitting the answer into two arrays:
 * this way the client cannot draw the same attempt twice.
 *
 * A test or a course whose title cannot be resolved drops out of the history.
 * `testAttemptSummarySchema` has no field for "deleted", and inventing a
 * caption the specification never asked for would be worse than a shorter
 * list. The case is reachable: `DELETE /courses/:courseId` removes one document
 * and leaves its lessons and tests orphaned (a tail of slice 10).
 */
export function buildAttemptSummaries(
  rows: AttemptTopRow[],
  titleByTestId: Map<string, string>,
  titleByCourseId: Map<string, string>,
): TestAttemptSummary[] {
  const summaries: TestAttemptSummary[] = [];

  const ordered = [...rows].sort(
    (first, second) =>
      second.last.submittedAt.getTime() - first.last.submittedAt.getTime(),
  );

  for (const row of ordered) {
    const testTitle = titleByTestId.get(row._id.toString());
    const courseTitle = titleByCourseId.get(row.last.courseId.toString());

    if (testTitle === undefined || courseTitle === undefined) {
      continue;
    }

    const sameAttempt = row.last.id.toString() === row.best.id.toString();

    const toSummary = (
      attempt: AttemptFields,
      flags: { isLast: boolean; isBest: boolean },
    ): TestAttemptSummary => ({
      id: attempt.id.toString(),
      testId: attempt.testId.toString(),
      testTitle,
      courseId: attempt.courseId.toString(),
      courseTitle,
      score: attempt.score,
      passed: attempt.passed,
      attemptNumber: attempt.attemptNumber,
      submittedAt: attempt.submittedAt.toISOString(),
      ...flags,
    });

    if (sameAttempt) {
      summaries.push(toSummary(row.last, { isLast: true, isBest: true }));
      continue;
    }

    summaries.push(toSummary(row.last, { isLast: true, isBest: false }));
    summaries.push(toSummary(row.best, { isLast: false, isBest: true }));
  }

  return summaries;
}

export async function loadAttemptSummaries(
  userId: Types.ObjectId,
): Promise<TestAttemptSummary[]> {
  const rows = await aggregateTopAttempts(userId);

  if (rows.length === 0) {
    return [];
  }

  // Titles by identifier rather than by `$lookup`: one learner meets a handful
  // of tests, and the course titles are needed by the same handler anyway.
  const [tests, courses] = await Promise.all([
    Test.find({ _id: { $in: rows.map((row) => row._id) } }).select("title"),
    Course.find({
      _id: { $in: rows.map((row) => row.last.courseId) },
    }).select("title"),
  ]);

  return buildAttemptSummaries(
    rows,
    new Map(tests.map((test) => [test._id.toString(), test.title])),
    new Map(courses.map((course) => [course._id.toString(), course.title])),
  );
}
