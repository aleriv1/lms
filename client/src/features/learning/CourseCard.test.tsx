import { learningCourseCardSchema } from "@lms/shared";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { CourseCard } from "./CourseCard";

function cardWith(overrides: Record<string, unknown>) {
  return learningCourseCardSchema.parse({
    courseId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    title: "Вводный инструктаж по охране труда",
    shortDescription: "Обязательный вводный курс для всех сотрудников.",
    coverUrl: null,
    courseStatus: "published",
    assignmentStatus: "active",
    progressPercent: 40,
    completedLessonsCount: 2,
    requiredLessonsCount: 5,
    lastActivityAt: "2026-09-05T10:00:00.000Z",
    ...overrides,
  });
}

function renderCard(overrides: Record<string, unknown>) {
  render(
    <MemoryRouter>
      <CourseCard card={cardWith(overrides)} />
    </MemoryRouter>,
  );
  return screen.getByRole("link");
}

describe("CourseCard", () => {
  it("invites an untouched course to be started", () => {
    expect(
      renderCard({
        progressPercent: 0,
        completedLessonsCount: 0,
        lastActivityAt: null,
      }),
    ).toHaveTextContent("Начать");
  });

  it("invites an unfinished course to be continued", () => {
    expect(renderCard({})).toHaveTextContent("Продолжить");
  });

  it("offers a finished course for re-reading instead of continuing", () => {
    const link = renderCard({
      assignmentStatus: "completed",
      progressPercent: 100,
      completedLessonsCount: 5,
    });
    expect(link).toHaveTextContent("Просмотреть материалы");
    expect(link).not.toHaveTextContent("Продолжить");
  });

  it("continues a finished course that gained a lesson afterwards", () => {
    expect(
      renderCard({
        assignmentStatus: "completed",
        progressPercent: 83,
        completedLessonsCount: 5,
        requiredLessonsCount: 6,
      }),
    ).toHaveTextContent("Продолжить");
  });

  it("only opens an archived course", () => {
    expect(renderCard({ courseStatus: "archived" })).toHaveTextContent(
      "Открыть",
    );
  });
});
