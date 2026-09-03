import type { LearningTestRef } from "@lms/shared";
import type { Types } from "mongoose";

import { TestAttempt } from "../models/TestAttempt.js";

/**
 * What the learner is shown about a test they have already met: whether it is
 * passed, the best score and how many attempts there were (`learningTestRef`
 * of `shared/src/learning.ts`). Slice 07 returned these three as constants —
 * truthfully, because no attempt could exist — and this is where they start
 * being counted.
 */

export type AttemptStats = Pick<
  LearningTestRef,
  "passed" | "bestScore" | "attemptsCount"
>;

export const NO_ATTEMPTS: AttemptStats = {
  passed: false,
  bestScore: null,
  attemptsCount: 0,
};

export type AttemptStatsRow = {
  _id: Types.ObjectId;
  attemptsCount: number;
  bestScore: number;
  passedCount: number;
};

/**
 * `passed` comes from a count and not from `$max` over the boolean field:
 * comparing booleans in Mongo leans on the BSON type order, and a rule the
 * reader has to remember costs more than one `$cond`.
 */
export function toAttemptStatsByTestId(
  rows: AttemptStatsRow[],
): Map<string, AttemptStats> {
  return new Map(
    rows.map((row) => [
      row._id.toString(),
      {
        passed: row.passedCount > 0,
        bestScore: row.bestScore,
        attemptsCount: row.attemptsCount,
      },
    ]),
  );
}

/**
 * One aggregation for any number of tests. A query per test would turn the
 * course page into a query per lesson (specification 11.2), which is the thing
 * `courseProgress.ts` was written to avoid in the first place.
 */
export async function findAttemptStats(
  userId: Types.ObjectId,
  testIds: Types.ObjectId[],
): Promise<Map<string, AttemptStats>> {
  if (testIds.length === 0) {
    return new Map();
  }

  const rows = await TestAttempt.aggregate<AttemptStatsRow>([
    { $match: { userId, testId: { $in: testIds } } },
    {
      $group: {
        _id: "$testId",
        attemptsCount: { $sum: 1 },
        bestScore: { $max: "$score" },
        passedCount: { $sum: { $cond: ["$passed", 1, 0] } },
      },
    },
  ]);

  return toAttemptStatsByTestId(rows);
}

/** Has this learner ever passed this test? */
export async function hasPassedTest(
  userId: Types.ObjectId,
  testId: Types.ObjectId,
): Promise<boolean> {
  return (await TestAttempt.exists({ userId, testId, passed: true })) !== null;
}
