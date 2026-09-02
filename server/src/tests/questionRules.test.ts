import { createTestBodySchema, type QuestionInput } from "@lms/shared";
import { describe, expect, it } from "vitest";

import { AppError } from "../errors/AppError.js";
import { buildQuestions } from "./questionRules.js";

function question(
  text: string,
  order: number,
  options: QuestionInput["options"] = [
    { text: "Верно", isCorrect: true },
    { text: "Неверно", isCorrect: false },
  ],
  type: QuestionInput["type"] = "single",
): QuestionInput {
  return { text, type, order, options };
}

describe("buildQuestions", () => {
  it("returns the questions sorted by order", () => {
    const built = buildQuestions([
      question("Третий вопрос", 3),
      question("Первый вопрос", 1),
      question("Второй вопрос", 2),
    ]);

    expect(built.map((entry) => entry.text)).toEqual([
      "Первый вопрос",
      "Второй вопрос",
      "Третий вопрос",
    ]);
  });

  it("accepts a single question", () => {
    expect(buildQuestions([question("Единственный вопрос", 1)])).toHaveLength(1);
  });

  it("gives every question and every option its own identifier", () => {
    const built = buildQuestions([
      question("Первый вопрос", 1),
      question("Второй вопрос", 2),
    ]);
    const identifiers = [
      ...built.map((entry) => entry._id.toString()),
      ...built.flatMap((entry) =>
        entry.options.map((option) => option._id.toString()),
      ),
    ];

    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it("refuses two questions with the same order", () => {
    expect(() =>
      buildQuestions([
        question("Первый вопрос", 1),
        question("Второй вопрос", 1),
      ]),
    ).toThrowError(
      expect.objectContaining({
        status: 422,
        code: "unprocessable",
        fields: [
          {
            field: "questions.1.order",
            message: "Порядковые номера вопросов не должны повторяться",
          },
        ],
      }) as unknown as AppError,
    );
  });
});

/**
 * The rules of specification 4.4 belong to `questionInputSchema` in `shared/`,
 * and `validate(createTestBodySchema)` runs it before the handler. These cases
 * record where that check lives, so it is not quietly duplicated here.
 */
describe("createTestBodySchema", () => {
  function parse(options: QuestionInput["options"], type: QuestionInput["type"]) {
    return createTestBodySchema.safeParse({
      title: "Проверочный тест",
      questions: [question("Вопрос теста", 1, options, type)],
    });
  }

  it("refuses a question without a correct option", () => {
    const result = parse(
      [
        { text: "Верно", isCorrect: false },
        { text: "Неверно", isCorrect: false },
      ],
      "single",
    );

    expect(result.success).toBe(false);
  });

  it("refuses a single-answer question with two correct options", () => {
    const result = parse(
      [
        { text: "Верно", isCorrect: true },
        { text: "Тоже верно", isCorrect: true },
      ],
      "single",
    );

    expect(result.success).toBe(false);
  });

  it("refuses a question with one option", () => {
    const result = parse([{ text: "Верно", isCorrect: true }], "single");

    expect(result.success).toBe(false);
  });

  it("accepts a multiple-answer question with two correct options", () => {
    const result = parse(
      [
        { text: "Верно", isCorrect: true },
        { text: "Тоже верно", isCorrect: true },
        { text: "Неверно", isCorrect: false },
      ],
      "multiple",
    );

    expect(result.success).toBe(true);
  });
});
