import type { LessonProgressStatus } from "@lms/shared";
import { describe, expect, it } from "vitest";

import {
  computeLessonStates,
  computeProgressPercent,
  countRequiredLessons,
  findAdjacentLessons,
  findNextLessonId,
  isCourseCompleted,
  type LearnerLesson,
} from "./lessonStates.js";

/** `id` doubles as the readable name of the lesson in the expectations. */
function lesson(
  id: string,
  isRequired: boolean,
  progressStatus: LessonProgressStatus = "not_started",
  order = Number(id.replace(/\D/g, "")),
): LearnerLesson {
  return { id, order, isRequired, progressStatus };
}

function states(lessons: LearnerLesson[]): Record<string, string> {
  return Object.fromEntries(
    computeLessonStates(lessons).map((item) => [item.id, item.state]),
  );
}

describe("lesson states", () => {
  it("opens the first required lesson and locks the next one", () => {
    expect(
      states([lesson("r1", true), lesson("o2", false), lesson("r3", true)]),
    ).toEqual({
      r1: "available",
      o2: "available",
      r3: "locked",
    });
  });

  it("moves the frontier on and locks everything past it", () => {
    expect(
      states([
        lesson("r1", true, "completed"),
        lesson("r2", true),
        lesson("o3", false),
        lesson("r4", true),
        lesson("o5", false),
      ]),
    ).toEqual({
      r1: "completed",
      r2: "available",
      o3: "available",
      r4: "locked",
      o5: "locked",
    });
  });

  it("opens an optional lesson that stands before every required one", () => {
    expect(states([lesson("o1", false), lesson("r2", true)])).toEqual({
      o1: "available",
      r2: "available",
    });
  });

  it("keeps a completed lesson completed behind the frontier", () => {
    expect(
      states([
        lesson("r1", true),
        lesson("r2", true, "completed"),
        lesson("r3", true),
      ]),
    ).toEqual({ r1: "available", r2: "completed", r3: "locked" });
  });

  it("orders by the lesson number, not by the order it was given", () => {
    expect(
      computeLessonStates([
        lesson("r3", true),
        lesson("r1", true, "completed"),
      ]).map((item) => item.id),
    ).toEqual(["r1", "r3"]);
  });

  it("counts only the required lessons", () => {
    const count = countRequiredLessons([
      lesson("r1", true, "completed"),
      lesson("o2", false, "completed"),
      lesson("r3", true),
    ]);

    expect(count).toEqual({ completed: 1, total: 2 });
  });

  it("rounds the percentage to a whole number", () => {
    expect(computeProgressPercent({ completed: 1, total: 3 })).toBe(33);
    expect(computeProgressPercent({ completed: 2, total: 3 })).toBe(67);
    expect(computeProgressPercent({ completed: 3, total: 3 })).toBe(100);
  });

  it("reports zero for a course with no required published lesson", () => {
    expect(computeProgressPercent({ completed: 0, total: 0 })).toBe(0);
    expect(isCourseCompleted({ completed: 0, total: 0 }, null)).toBe(false);
  });

  it("takes the first available lesson as the next one", () => {
    const items = computeLessonStates([
      lesson("r1", true, "completed"),
      lesson("o2", false),
      lesson("r3", true),
    ]);

    expect(findNextLessonId(items)).toBe("o2");
  });

  it("has no next lesson when everything available is done", () => {
    const items = computeLessonStates([
      lesson("r1", true, "completed"),
      lesson("o2", false, "completed"),
    ]);

    expect(findNextLessonId(items)).toBeNull();
    expect(findNextLessonId([])).toBeNull();
  });

  it("gives the nearest open neighbours, skipping the locked ones", () => {
    const items = computeLessonStates([
      lesson("r1", true, "completed"),
      lesson("r2", true),
      lesson("r3", true),
      lesson("r4", true, "completed"),
    ]);

    expect(findAdjacentLessons(items, "r2")).toEqual({
      previousLessonId: "r1",
      nextLessonId: "r4",
    });
    expect(findAdjacentLessons(items, "r1")).toEqual({
      previousLessonId: null,
      nextLessonId: "r2",
    });
    expect(findAdjacentLessons(items, "r4")).toEqual({
      previousLessonId: "r2",
      nextLessonId: null,
    });
  });

  it("has no neighbours for a lesson outside the course", () => {
    expect(findAdjacentLessons(computeLessonStates([]), "r1")).toEqual({
      previousLessonId: null,
      nextLessonId: null,
    });
  });

  it("finishes a course only with the final test passed", () => {
    const done = { completed: 2, total: 2 };

    expect(isCourseCompleted(done, null)).toBe(true);
    expect(isCourseCompleted(done, { passed: true })).toBe(true);
    expect(isCourseCompleted(done, { passed: false })).toBe(false);
    expect(isCourseCompleted({ completed: 1, total: 2 }, null)).toBe(false);
  });
});
