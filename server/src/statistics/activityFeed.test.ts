import { Types } from "mongoose";
import { describe, expect, it } from "vitest";

import { ActivityEvent } from "../models/ActivityEvent.js";
import {
  buildActivityWeeks,
  startOfWeekUtc,
  toActivityEvent,
} from "./activityFeed.js";
import { learningStatusOf, type PairProgress } from "./pairProgress.js";

describe("UTC activity weeks", () => {
  it.each([
    "2026-08-31T00:00:00.000Z",
    "2026-09-06T23:59:59.999Z",
    "2026-09-02T12:30:00.000Z",
  ])("finds the same Monday for %s without mutating the date", (value) => {
    const date = new Date(value);
    expect(startOfWeekUtc(date).toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(date.toISOString()).toBe(value);
  });

  it("returns four ordered weeks across a year boundary and fills gaps", () => {
    expect(
      buildActivityWeeks(
        new Map([["2025-12-22T00:00:00.000Z", 3]]),
        new Date("2026-01-07T12:00:00.000Z"),
      ),
    ).toEqual([
      { weekStart: "2025-12-15T00:00:00.000Z", count: 0 },
      { weekStart: "2025-12-22T00:00:00.000Z", count: 3 },
      { weekStart: "2025-12-29T00:00:00.000Z", count: 0 },
      { weekStart: "2026-01-05T00:00:00.000Z", count: 0 },
    ]);
  });

  it("returns four zeroes for an empty map", () => {
    expect(
      buildActivityWeeks(new Map(), new Date("2026-09-04T12:00:00Z")).map(
        (week) => week.count,
      ),
    ).toEqual([0, 0, 0, 0]);
  });

  it("maps only public fields, including nullable targets", () => {
    const event = new ActivityEvent({
      userId: new Types.ObjectId(),
      type: "course_completed",
      metadata: { courseTitle: null, lessonTitle: null },
      createdAt: new Date("2026-09-04T12:00:00Z"),
    });
    expect(toActivityEvent(event)).toEqual({
      id: event._id.toString(),
      type: "course_completed",
      courseId: null,
      lessonId: null,
      courseTitle: null,
      lessonTitle: null,
      createdAt: "2026-09-04T12:00:00.000Z",
    });
  });
});

describe("learning status across course pairs", () => {
  const pair: PairProgress = {
    userId: "user",
    courseId: "course",
    assignmentStatus: "active",
    assignedAt: new Date(),
    completedAt: null,
    completed: 0,
    total: 2,
    progressPercent: 0,
  };

  it("checks completed assignments before zero lesson counts", () => {
    expect(learningStatusOf([])).toBe("not_started");
    expect(learningStatusOf([pair])).toBe("not_started");
    expect(learningStatusOf([{ ...pair, assignmentStatus: "completed" }])).toBe(
      "completed",
    );
    expect(learningStatusOf([pair, { ...pair, completed: 1 }])).toBe(
      "in_progress",
    );
    expect(
      learningStatusOf([
        pair,
        { ...pair, assignmentStatus: "completed", completed: 2 },
      ]),
    ).toBe("in_progress");
  });
});
