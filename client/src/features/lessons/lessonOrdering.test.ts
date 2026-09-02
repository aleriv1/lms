import {
  LESSON_ORDER_MAX,
  reorderLessonsBodySchema,
  type LessonSummary,
} from "@lms/shared";
import { describe, expect, it } from "vitest";

import { moveLesson, nextFreeOrder, sortLessons } from "./lessonOrdering";

function lesson(id: string, order: number): LessonSummary {
  return {
    id,
    title: `Урок ${order}`,
    order,
    durationMinutes: 10,
    isRequired: true,
    status: "draft",
    testId: null,
  };
}

const firstId = "000000000000000000000001";
const secondId = "000000000000000000000002";
const thirdId = "000000000000000000000003";

describe("sortLessons", () => {
  it("orders lessons ascending without mutating the input", () => {
    const lessons = [lesson(thirdId, 3), lesson(firstId, 1), lesson(secondId, 2)];

    const result = sortLessons(lessons);

    expect(result.map((item) => item.order)).toEqual([1, 2, 3]);
    expect(lessons.map((item) => item.order)).toEqual([3, 1, 2]);
    expect(result).not.toBe(lessons);
  });
});

describe("nextFreeOrder", () => {
  it("returns 1 for an empty list", () => {
    expect(nextFreeOrder([])).toBe(1);
  });

  it("fills the first gap", () => {
    expect(nextFreeOrder([lesson(firstId, 1), lesson(thirdId, 3)])).toBe(2);
  });

  it("returns the maximum when every order is occupied", () => {
    const lessons = Array.from({ length: LESSON_ORDER_MAX }, (_, index) =>
      lesson(index.toString(16).padStart(24, "0"), index + 1),
    );

    expect(nextFreeOrder(lessons)).toBe(LESSON_ORDER_MAX);
  });
});

describe("moveLesson", () => {
  it("moves a middle lesson up and renumbers the whole list", () => {
    const result = moveLesson(
      [lesson(firstId, 1), lesson(secondId, 2), lesson(thirdId, 3)],
      secondId,
      "up",
    );

    expect(result).toEqual({
      lessons: [
        { lessonId: secondId, order: 1 },
        { lessonId: firstId, order: 2 },
        { lessonId: thirdId, order: 3 },
      ],
    });
  });

  it("returns null for impossible moves", () => {
    const lessons = [lesson(firstId, 1), lesson(secondId, 2)];

    expect(moveLesson(lessons, firstId, "up")).toBeNull();
    expect(moveLesson(lessons, secondId, "down")).toBeNull();
    expect(
      moveLesson(lessons, "000000000000000000000099", "up"),
    ).toBeNull();
  });

  it("closes gaps while renumbering", () => {
    const result = moveLesson(
      [lesson(firstId, 2), lesson(secondId, 5), lesson(thirdId, 9)],
      secondId,
      "down",
    );

    expect(result?.lessons).toEqual([
      { lessonId: firstId, order: 1 },
      { lessonId: thirdId, order: 2 },
      { lessonId: secondId, order: 3 },
    ]);
  });

  it("returns a body accepted by the shared schema", () => {
    const result = moveLesson(
      [lesson(firstId, 1), lesson(secondId, 2)],
      firstId,
      "down",
    );

    expect(reorderLessonsBodySchema.safeParse(result).success).toBe(true);
  });
});
