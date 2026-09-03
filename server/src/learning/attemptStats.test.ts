import { Types } from "mongoose";
import { describe, expect, it } from "vitest";

import { NO_ATTEMPTS, toAttemptStatsByTestId } from "./attemptStats.js";

describe("toAttemptStatsByTestId", () => {
  it("derives passed from the count of passing attempts", () => {
    const passedTestId = new Types.ObjectId();
    const failedTestId = new Types.ObjectId();

    const stats = toAttemptStatsByTestId([
      {
        _id: passedTestId,
        attemptsCount: 3,
        bestScore: 90,
        passedCount: 1,
      },
      {
        _id: failedTestId,
        attemptsCount: 2,
        bestScore: 40,
        passedCount: 0,
      },
    ]);

    expect(stats.get(passedTestId.toString())).toEqual({
      passed: true,
      bestScore: 90,
      attemptsCount: 3,
    });
    expect(stats.get(failedTestId.toString())).toEqual({
      passed: false,
      bestScore: 40,
      attemptsCount: 2,
    });
  });

  it("reports nothing for a test with no attempts", () => {
    const stats = toAttemptStatsByTestId([]);

    // The caller falls back to `NO_ATTEMPTS`, the value slice 07 returned as a
    // constant while no attempt could exist.
    expect(stats.get(new Types.ObjectId().toString())).toBeUndefined();
    expect(NO_ATTEMPTS).toEqual({
      passed: false,
      bestScore: null,
      attemptsCount: 0,
    });
  });
});
