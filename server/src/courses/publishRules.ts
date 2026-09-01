import type { FieldError } from "@lms/shared";

import type { CourseAttributes } from "../models/Course.js";

/** Specification 4.2: what a course must have before it can be published. */
export function collectPublicationIssues(
  course: Pick<
    CourseAttributes,
    "title" | "category" | "audience" | "shortDescription"
  >,
): FieldError[] {
  const issues: FieldError[] = [];

  if (!course.title.trim()) {
    issues.push({ field: "title", message: "Укажите название курса" });
  }
  if (!course.category.trim()) {
    issues.push({ field: "category", message: "Укажите категорию курса" });
  }
  if (!course.audience) {
    issues.push({ field: "audience", message: "Укажите аудиторию курса" });
  }
  if (!course.shortDescription.trim()) {
    issues.push({
      field: "shortDescription",
      message: "Укажите краткое описание курса",
    });
  }

  // The lesson query lands with the Lesson model in slice 04.
  issues.push({
    field: "lessons",
    message: "Добавьте хотя бы один опубликованный обязательный урок",
  });

  return issues;
}
