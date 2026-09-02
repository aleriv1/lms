import { createTestBodySchema, type QuestionInput } from "@lms/shared";
import { describe, expect, it } from "vitest";

import { canMoveQuestion, renumberQuestions } from "./questionOrdering";

function question(text: string, order: number): QuestionInput {
  return {
    text,
    order,
    type: "single",
    options: [
      { text: "Верный ответ", isCorrect: true },
      { text: "Неверный ответ", isCorrect: false },
    ],
  };
}

describe("renumberQuestions", () => {
  it("returns an empty array for no questions", () => {
    expect(renumberQuestions([])).toEqual([]);
  });

  it("numbers by position, preserves content and does not mutate the input", () => {
    const questions = [
      question("Третий вопрос", 9),
      question("Первый вопрос", 2),
    ];
    const result = renumberQuestions(questions);

    expect(result).toEqual([
      { ...questions[0], order: 1 },
      { ...questions[1], order: 2 },
    ]);
    expect(questions.map((item) => item.order)).toEqual([9, 2]);
    expect(result).not.toBe(questions);
    expect(result[0]).not.toBe(questions[0]);
  });

  it("closes the gap after removal and assigns the appended question its position", () => {
    const questions = [
      question("Первый", 1),
      question("Второй", 2),
      question("Третий", 3),
    ];
    const remaining = questions.filter((_, index) => index !== 1);
    const result = renumberQuestions([...remaining, question("Новый", 4)]);

    expect(result.map(({ text, order }) => ({ text, order }))).toEqual([
      { text: "Первый", order: 1 },
      { text: "Третий", order: 2 },
      { text: "Новый", order: 3 },
    ]);
    expect(
      createTestBodySchema.safeParse({
        title: "Проверка порядка",
        lessonId: null,
        passingScore: 70,
        questions: result,
      }).success,
    ).toBe(true);
  });
});

describe("canMoveQuestion", () => {
  it("allows both directions in the middle", () => {
    expect(canMoveQuestion(1, 3, "up")).toBe(true);
    expect(canMoveQuestion(1, 3, "down")).toBe(true);
  });

  it("only allows moves inside the array", () => {
    expect(canMoveQuestion(0, 3, "up")).toBe(false);
    expect(canMoveQuestion(0, 3, "down")).toBe(true);
    expect(canMoveQuestion(2, 3, "down")).toBe(false);
    expect(canMoveQuestion(2, 3, "up")).toBe(true);
  });

  it("refuses empty, single and invalid positions", () => {
    for (const direction of ["up", "down"] as const) {
      expect(canMoveQuestion(0, 0, direction)).toBe(false);
      expect(canMoveQuestion(0, 1, direction)).toBe(false);
      expect(canMoveQuestion(-1, 3, direction)).toBe(false);
      expect(canMoveQuestion(3, 3, direction)).toBe(false);
      expect(canMoveQuestion(0.5, 3, direction)).toBe(false);
    }
  });
});
