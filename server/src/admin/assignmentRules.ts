import type { AssignmentStatus, CourseStatus, UserStatus } from "@lms/shared";

import { AppError } from "../errors/AppError.js";

/**
 * Specification 4.3 allows an assignment only for a published course and only
 * for an active user. Neither refusal has a code of its own in
 * `API_ERROR_CODES`: the client shows both the same way, next to the field of
 * the assignment form, and tells them apart by `fields[].field`.
 */
export function courseNotAssignableError(status: CourseStatus): AppError {
  const reason =
    status === "draft"
      ? "Черновик курса назначить нельзя"
      : "Архивный курс назначить нельзя";

  return new AppError(422, "unprocessable", reason, [
    { field: "courseId", message: reason },
  ]);
}

export function userNotAssignableError(status: UserStatus): AppError {
  const reason =
    status === "blocked"
      ? "Заблокированному пользователю курс назначить нельзя"
      : "Архивному пользователю курс назначить нельзя";

  return new AppError(422, "unprocessable", reason, [
    { field: "userId", message: reason },
  ]);
}

export function assignmentExistsError(): AppError {
  return new AppError(
    409,
    "assignment_exists",
    "Этот курс уже назначен пользователю",
  );
}

export function assignmentNotActiveError(status: AssignmentStatus): AppError {
  return new AppError(
    409,
    "assignment_not_active",
    status === "revoked"
      ? "Назначение уже снято"
      : "Завершенное назначение снять нельзя",
  );
}

export function isCourseAssignable(status: CourseStatus): boolean {
  return status === "published";
}

export function isUserAssignable(status: UserStatus): boolean {
  return status === "active";
}

export function isAssignmentRevocable(status: AssignmentStatus): boolean {
  return status === "active";
}
