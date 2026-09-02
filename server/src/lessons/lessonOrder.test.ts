import { describe, expect, it } from "vitest";

import { isDuplicateKeyError } from "../db/duplicateKey.js";
import { AppError } from "../errors/AppError.js";
import { planReorder } from "./lessonOrder.js";

const FIRST = "507f1f77bcf86cd799439011";
const SECOND = "507f1f77bcf86cd799439012";
const THIRD = "507f1f77bcf86cd799439013";

function expectAppError(run: () => unknown, status: number): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(status);
    return;
  }

  expect.unreachable("planReorder was expected to throw");
}

describe("planReorder", () => {
  it("plans a swap of two neighbours", () => {
    const plan = planReorder(
      [FIRST, SECOND, THIRD],
      [
        { lessonId: FIRST, order: 2 },
        { lessonId: SECOND, order: 1 },
        { lessonId: THIRD, order: 3 },
      ],
    );

    expect(plan).toEqual([
      { lessonId: FIRST, order: 2 },
      { lessonId: SECOND, order: 1 },
      { lessonId: THIRD, order: 3 },
    ]);
  });

  it("rejects a body that misses a lesson of the course", () => {
    expectAppError(
      () =>
        planReorder(
          [FIRST, SECOND],
          [{ lessonId: FIRST, order: 1 }],
        ),
      422,
    );
  });

  it("rejects a lesson that does not belong to the course", () => {
    expectAppError(
      () =>
        planReorder(
          [FIRST],
          [
            { lessonId: FIRST, order: 1 },
            { lessonId: SECOND, order: 2 },
          ],
        ),
      422,
    );
  });

  it("rejects a repeated lesson identifier", () => {
    expectAppError(
      () =>
        planReorder(
          [FIRST, SECOND],
          [
            { lessonId: FIRST, order: 1 },
            { lessonId: FIRST, order: 2 },
          ],
        ),
      422,
    );
  });

  it("rejects repeated order numbers with a conflict", () => {
    expectAppError(
      () =>
        planReorder(
          [FIRST, SECOND],
          [
            { lessonId: FIRST, order: 1 },
            { lessonId: SECOND, order: 1 },
          ],
        ),
      409,
    );
  });
});

describe("isDuplicateKeyError", () => {
  it("recognises the Mongo duplicate key code and nothing else", () => {
    expect(isDuplicateKeyError({ code: 11000 })).toBe(true);
    expect(isDuplicateKeyError({ code: 121 })).toBe(false);
    expect(isDuplicateKeyError(new Error("boom"))).toBe(false);
    expect(isDuplicateKeyError(null)).toBe(false);
  });
});
