import { Types } from "mongoose";
import { describe, expect, it } from "vitest";

import {
  assemblePairProgress,
  averagePercent,
  averageProgressOverUsers,
  buildCourseProgressStats,
  type PairProgress,
} from "./pairProgress.js";

const id = (hex: string): Types.ObjectId =>
  new Types.ObjectId(hex.padStart(24, "0"));

const USER_A = id("a1");
const USER_B = id("b1");
const COURSE_ONE = id("c1");
const COURSE_TWO = id("c2");

const assignment = (
  userId: Types.ObjectId,
  courseId: Types.ObjectId,
  overrides: Partial<{
    status: "active" | "revoked" | "completed";
    assignedAt: Date;
    completedAt: Date | null;
  }> = {},
) => ({
  _id: { userId, courseId },
  status: overrides.status ?? ("active" as const),
  assignedAt: overrides.assignedAt ?? new Date("2026-01-01T00:00:00.000Z"),
  completedAt: overrides.completedAt ?? null,
});

const pair = (
  userId: string,
  courseId: string,
  progressPercent: number,
  status: PairProgress["assignmentStatus"] = "active",
): PairProgress => ({
  userId,
  courseId,
  assignmentStatus: status,
  assignedAt: new Date("2026-01-01T00:00:00.000Z"),
  completedAt: null,
  completed: 0,
  total: 0,
  progressPercent,
});

describe("averagePercent", () => {
  it("reports zero for an empty list", () => {
    expect(averagePercent([])).toBe(0);
  });

  it("rounds a half upwards, like Math.round", () => {
    expect(averagePercent([50, 51])).toBe(51);
  });

  it("rounds downwards below a half", () => {
    expect(averagePercent([33, 33, 34])).toBe(33);
  });

  it("averages the extremes", () => {
    expect(averagePercent([0, 100])).toBe(50);
  });
});

describe("assemblePairProgress", () => {
  it("reports zero for an assignment with no progress at all", () => {
    const [result] = assemblePairProgress(
      [assignment(USER_A, COURSE_ONE)],
      [{ _id: COURSE_ONE, total: 4 }],
      [],
    );

    expect(result).toMatchObject({
      completed: 0,
      total: 4,
      progressPercent: 0,
    });
  });

  it("computes the share of completed required lessons", () => {
    const [result] = assemblePairProgress(
      [assignment(USER_A, COURSE_ONE)],
      [{ _id: COURSE_ONE, total: 8 }],
      [{ _id: { userId: USER_A, courseId: COURSE_ONE }, completed: 1 }],
    );

    // 12.5 rounded upwards: the same answer the course page gives, and the
    // reason the rounding is not left to MongoDB's `$round`.
    expect(result?.progressPercent).toBe(13);
  });

  it("reports zero for a course with no required published lesson", () => {
    const [result] = assemblePairProgress(
      [assignment(USER_A, COURSE_ONE)],
      [],
      [{ _id: { userId: USER_A, courseId: COURSE_ONE }, completed: 2 }],
    );

    expect(result).toMatchObject({ total: 0, progressPercent: 0 });
  });

  it("drops progress that belongs to no assignment in the scope", () => {
    const result = assemblePairProgress(
      [assignment(USER_A, COURSE_ONE)],
      [{ _id: COURSE_ONE, total: 2 }],
      [
        { _id: { userId: USER_A, courseId: COURSE_ONE }, completed: 2 },
        { _id: { userId: USER_B, courseId: COURSE_ONE }, completed: 1 },
      ],
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      userId: USER_A.toString(),
      progressPercent: 100,
    });
  });

  it("carries the status and the completion date of the governing assignment", () => {
    const completedAt = new Date("2026-02-02T10:00:00.000Z");
    const [result] = assemblePairProgress(
      [
        assignment(USER_A, COURSE_ONE, {
          status: "completed",
          completedAt,
        }),
      ],
      [{ _id: COURSE_ONE, total: 1 }],
      [{ _id: { userId: USER_A, courseId: COURSE_ONE }, completed: 1 }],
    );

    expect(result).toMatchObject({
      assignmentStatus: "completed",
      completedAt,
    });
  });
});

describe("averageProgressOverUsers", () => {
  it("weighs learners equally, whatever the number of their courses", () => {
    const pairs = [
      pair("a", "one", 0),
      pair("b", "one", 100),
      pair("b", "two", 100),
      pair("b", "three", 100),
    ];

    // Per learner: 0 and 100. Averaging the four pairs instead would give 75.
    expect(averageProgressOverUsers(pairs)).toBe(50);
  });

  it("keeps a learner without assignments out of the denominator", () => {
    // A user with no pair contributes no row at all, so the figure cannot be
    // dragged down by accounts that never study.
    expect(averageProgressOverUsers([pair("a", "one", 60)])).toBe(60);
  });

  it("reports zero when nobody has an assignment", () => {
    expect(averageProgressOverUsers([])).toBe(0);
  });
});

describe("buildCourseProgressStats", () => {
  it("counts the pairs of each course and averages them", () => {
    const stats = buildCourseProgressStats(
      [
        pair("a", COURSE_ONE.toString(), 100),
        pair("b", COURSE_ONE.toString(), 0),
        pair("a", COURSE_TWO.toString(), 40),
      ],
      new Map([
        [COURSE_ONE.toString(), "Безопасность"],
        [COURSE_TWO.toString(), "Автоматика"],
      ]),
    );

    expect(stats.map((stat) => stat.title)).toEqual(["Автоматика", "Безопасность"]);
    expect(stats[1]).toMatchObject({
      assignedUsersCount: 2,
      averageProgressPercent: 50,
    });
  });

  it("drops a course whose title cannot be resolved", () => {
    const stats = buildCourseProgressStats(
      [pair("a", COURSE_ONE.toString(), 100)],
      new Map(),
    );

    expect(stats).toEqual([]);
  });
});
