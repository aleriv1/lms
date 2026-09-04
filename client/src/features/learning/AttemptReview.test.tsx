import { attemptReviewQuestionSchema } from "@lms/shared";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AttemptReview } from "./AttemptReview";

function rowWithText(text: string) {
  const row = screen.getByText(text).closest("li");
  if (!row) throw new Error(`No review row for: ${text}`);
  return row;
}

const wrongQuestion = attemptReviewQuestionSchema.parse({
  questionId: "inspection",
  text: "Что сделать перед выездом?",
  type: "single",
  order: 2,
  isCorrect: false,
  options: [
    { id: "skip", text: "Пропустить осмотр", isCorrect: false, isSelected: true },
    { id: "inspect", text: "Осмотреть машину", isCorrect: true, isSelected: false },
  ],
});

const correctQuestion = attemptReviewQuestionSchema.parse({
  questionId: "documents",
  text: "Какой документ взять?",
  type: "single",
  order: 1,
  isCorrect: true,
  options: [
    { id: "license", text: "Водительское удостоверение", isCorrect: true, isSelected: true },
    { id: "ticket", text: "Билет в кино", isCorrect: false, isSelected: false },
  ],
});

describe("AttemptReview", () => {
  it("renders no content for an empty review", () => {
    const { container } = render(<AttemptReview review={[]} />);
    expect(screen.queryByRole("heading", { name: "Разбор ответов" })).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("labels the wrong selection and the missed correct answer independently", () => {
    render(<AttemptReview review={[wrongQuestion]} />);
    expect(screen.getByText("Неверно")).toBeInTheDocument();
    const selected = within(rowWithText("Пропустить осмотр"));
    expect(selected.getByText("Пропустить осмотр")).toBeInTheDocument();
    expect(selected.getByText("ваш выбор")).toBeInTheDocument();
    expect(selected.queryByText("правильный ответ")).not.toBeInTheDocument();
    const missed = within(rowWithText("Осмотреть машину"));
    expect(missed.getByText("Осмотреть машину")).toBeInTheDocument();
    expect(missed.getByText("правильный ответ")).toBeInTheDocument();
    expect(missed.queryByText("ваш выбор")).not.toBeInTheDocument();
  });

  it("identifies an unanswered question", () => {
    const unanswered = attemptReviewQuestionSchema.parse({
      ...wrongQuestion,
      options: wrongQuestion.options.map((option) => ({ ...option, isSelected: false })),
    });
    render(<AttemptReview review={[unanswered]} />);
    expect(screen.getByText("Вы не ответили")).toBeInTheDocument();
  });

  it("preserves array order and gives a correct selection both labels", () => {
    render(<AttemptReview review={[wrongQuestion, correctQuestion]} />);
    const questions = screen.getAllByRole("listitem")
      .filter((item) => item.parentElement?.tagName === "OL");
    expect(questions).toEqual([
      rowWithText(wrongQuestion.text),
      rowWithText(correctQuestion.text),
    ]);
    const correct = within(rowWithText(correctQuestion.text));
    expect(correct.getByText(correctQuestion.text)).toBeInTheDocument();
    expect(correct.getByText("Верно")).toBeInTheDocument();
    const option = within(rowWithText("Водительское удостоверение"));
    expect(option.getByText("Водительское удостоверение")).toBeInTheDocument();
    expect(option.getByText("правильный ответ")).toBeInTheDocument();
    expect(option.getByText("ваш выбор")).toBeInTheDocument();
  });
});
