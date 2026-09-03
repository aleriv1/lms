import { learnerQuestionSchema, learnerTestSchema } from "@lms/shared";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { FormError } from "../../api/formError";
import { TestAttemptForm } from "./TestAttemptForm";

const test = learnerTestSchema.parse({
  id: "aaaaaaaaaaaaaaaaaaaaaaaa",
  courseId: "bbbbbbbbbbbbbbbbbbbbbbbb",
  lessonId: null,
  title: "Проверка знаний",
  passingScore: 70,
  questions: [
    learnerQuestionSchema.parse({
      id: "single-question",
      text: "Выберите действие",
      type: "single",
      order: 1,
      options: [
        { id: "inspect", text: "Проверить оборудование" },
        { id: "skip", text: "Пропустить проверку" },
      ],
    }),
    learnerQuestionSchema.parse({
      id: "multiple-question",
      text: "Выберите документы",
      type: "multiple",
      order: 2,
      options: [
        { id: "log", text: "Журнал осмотров" },
        { id: "manual", text: "Инструкция" },
        { id: "schedule", text: "Расписание" },
      ],
    }),
  ],
});

describe("TestAttemptForm", () => {
  it("keeps single and multiple answers when navigating in both directions", async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    render(
      <MemoryRouter>
        <TestAttemptForm test={test} onSubmit={onSubmit} />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole("radio", { name: "Проверить оборудование" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    expect(screen.getByText("Вопрос 2 из 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: "Журнал осмотров" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Инструкция" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Расписание" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Расписание" }));
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(
      screen.getByRole("radio", { name: "Проверить оборудование" }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Пропустить проверку" }),
    ).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    expect(
      screen.getByRole("checkbox", { name: "Журнал осмотров" }),
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Инструкция" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Расписание" }),
    ).not.toBeChecked();
    expect(screen.getByRole("progressbar")).toHaveAttribute("value", "100");

    const submit = screen.getByRole("button", { name: "Отправить ответы" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
        answers: [
          { questionId: "single-question", optionIds: ["inspect"] },
          { questionId: "multiple-question", optionIds: ["log", "manual"] },
        ],
      }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("counts unanswered questions and sends all entries only after confirmation", async () => {
    const onSubmit = vi.fn().mockResolvedValue(null);
    render(
      <MemoryRouter>
        <TestAttemptForm test={test} onSubmit={onSubmit} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    const submit = screen.getByRole("button", { name: "Отправить ответы" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText("Вопросов без ответа: 2. Отправить попытку?"),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Подтвердить отправку" }),
    );
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
        answers: [
          { questionId: "single-question", optionIds: [] },
          { questionId: "multiple-question", optionIds: [] },
        ],
      }),
    );
  });

  it("blocks double clicks and a direct submit event while the request is pending", async () => {
    const onSubmit = vi.fn(() => new Promise<FormError | null>(() => {}));
    render(
      <MemoryRouter>
        <TestAttemptForm test={test} onSubmit={onSubmit} />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("radio", { name: "Проверить оборудование" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Далее" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Журнал осмотров" }));
    const submit = screen.getByRole("button", { name: "Отправить ответы" });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(submit).toBeDisabled();

    await act(async () => {
      fireEvent.click(submit);
      fireEvent.submit(screen.getByRole("form", { name: "Ответы на тест" }));
    });
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
