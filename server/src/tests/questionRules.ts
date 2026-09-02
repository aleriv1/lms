import type { FieldError, QuestionInput } from "@lms/shared";
import { Types } from "mongoose";

import { AppError } from "../errors/AppError.js";
import type { QuestionAttributes } from "../models/Test.js";

/**
 * Turns the submitted questions into what is stored.
 *
 * `questionInputSchema` refines one question at a time, so it cannot see two
 * questions sharing an `order` — that rule of specification 8.4 lives here. The
 * contradiction is inside the submitted body rather than with stored state, so
 * it answers 422 and not the 409 a taken lesson number gets.
 *
 * Identifiers are assigned here and are new on every save: the input carries
 * none, and an update replaces the questions wholesale. That is exactly why an
 * attempt stores a snapshot of the questions instead of pointing at them
 * (specification 7.17).
 */
export function buildQuestions(questions: QuestionInput[]): QuestionAttributes[] {
  const takenOrders = new Set<number>();
  const duplicates: FieldError[] = [];

  questions.forEach((question, index) => {
    if (takenOrders.has(question.order)) {
      duplicates.push({
        field: `questions.${index}.order`,
        message: "Порядковые номера вопросов не должны повторяться",
      });
      return;
    }

    takenOrders.add(question.order);
  });

  if (duplicates.length > 0) {
    throw new AppError(
      422,
      "unprocessable",
      "Порядковые номера вопросов не должны повторяться",
      duplicates,
    );
  }

  return [...questions]
    .sort((first, second) => first.order - second.order)
    .map((question) => ({
      _id: new Types.ObjectId(),
      text: question.text,
      type: question.type,
      order: question.order,
      options: question.options.map((option) => ({
        _id: new Types.ObjectId(),
        text: option.text,
        isCorrect: option.isCorrect,
      })),
    }));
}
