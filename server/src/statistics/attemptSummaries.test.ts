import { Types } from "mongoose";
import { describe, expect, it } from "vitest";

import {
  buildAttemptSummaries,
  type AttemptTopRow,
} from "./attemptSummaries.js";

const id = (hex: string): Types.ObjectId =>
  new Types.ObjectId(hex.padStart(24, "0"));

const TEST_ONE = id("71");
const TEST_TWO = id("72");
const COURSE = id("c1");

const attempt = (
  attemptId: Types.ObjectId,
  score: number,
  submittedAt: string,
  attemptNumber: number,
  testId: Types.ObjectId = TEST_ONE,
) => ({
  id: attemptId,
  testId,
  courseId: COURSE,
  score,
  passed: score >= 70,
  attemptNumber,
  submittedAt: new Date(submittedAt),
});

const TITLES = new Map([
  [TEST_ONE.toString(), "Тест по охране труда"],
  [TEST_TWO.toString(), "Итоговый тест"],
]);
const COURSE_TITLES = new Map([[COURSE.toString(), "Охрана труда"]]);

const row = (
  testId: Types.ObjectId,
  last: AttemptTopRow["last"],
  best: AttemptTopRow["best"],
): AttemptTopRow => ({ _id: testId, last, best });

describe("buildAttemptSummaries", () => {
  it("marks a single attempt as both the last and the best one", () => {
    const only = attempt(id("a1"), 80, "2026-03-01T10:00:00.000Z", 1);

    const summaries = buildAttemptSummaries(
      [row(TEST_ONE, only, only)],
      TITLES,
      COURSE_TITLES,
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      score: 80,
      passed: true,
      attemptNumber: 1,
      isLast: true,
      isBest: true,
      testTitle: "Тест по охране труда",
      courseTitle: "Охрана труда",
    });
  });

  it("emits two rows when the best attempt is not the last one", () => {
    const summaries = buildAttemptSummaries(
      [
        row(
          TEST_ONE,
          attempt(id("a3"), 40, "2026-03-03T10:00:00.000Z", 3),
          attempt(id("a2"), 90, "2026-03-02T10:00:00.000Z", 2),
        ),
      ],
      TITLES,
      COURSE_TITLES,
    );

    expect(summaries).toHaveLength(2);
    // The last attempt first, the best one after it.
    expect(summaries[0]).toMatchObject({
      attemptNumber: 3,
      isLast: true,
      isBest: false,
    });
    expect(summaries[1]).toMatchObject({
      attemptNumber: 2,
      isLast: false,
      isBest: true,
    });
  });

  it("collapses a tie into one row, the later attempt winning", () => {
    // The pipeline resolves the tie with `submittedAt` as the second sort key,
    // so the later of two equal scores arrives as both `last` and `best`.
    const later = attempt(id("a2"), 75, "2026-03-02T10:00:00.000Z", 2);

    const summaries = buildAttemptSummaries(
      [row(TEST_ONE, later, later)],
      TITLES,
      COURSE_TITLES,
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ attemptNumber: 2, isBest: true });
  });

  it("drops a test whose title cannot be resolved", () => {
    const only = attempt(id("a1"), 80, "2026-03-01T10:00:00.000Z", 1, id("79"));

    expect(
      buildAttemptSummaries(
        [row(id("79"), only, only)],
        TITLES,
        COURSE_TITLES,
      ),
    ).toEqual([]);
  });

  it("drops an attempt whose course was deleted", () => {
    const only = attempt(id("a1"), 80, "2026-03-01T10:00:00.000Z", 1);

    expect(
      buildAttemptSummaries([row(TEST_ONE, only, only)], TITLES, new Map()),
    ).toEqual([]);
  });

  it("orders the tests by their last attempt, newest first", () => {
    const older = attempt(id("a1"), 80, "2026-03-01T10:00:00.000Z", 1);
    const newer = attempt(
      id("b1"),
      60,
      "2026-03-05T10:00:00.000Z",
      1,
      TEST_TWO,
    );

    const summaries = buildAttemptSummaries(
      [row(TEST_ONE, older, older), row(TEST_TWO, newer, newer)],
      TITLES,
      COURSE_TITLES,
    );

    expect(summaries.map((summary) => summary.testTitle)).toEqual([
      "Итоговый тест",
      "Тест по охране труда",
    ]);
  });
});
