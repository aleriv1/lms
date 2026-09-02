import type { AssignmentStatus, CourseStatus } from "@lms/shared";

import { AppError } from "../errors/AppError.js";

/**
 * Who may open an assigned course and who may study it. Pure status rules plus
 * the refusals they produce, in the shape `admin/assignmentRules.ts` uses:
 * the decision is unit-tested, the handler only asks.
 */

/**
 * An assignment gives access while it is not revoked. A completed one still
 * does: the course stays in "my learning" as history, and a lesson published
 * after the learner finished is theirs to take.
 */
export function isAssignmentEffective(status: AssignmentStatus): boolean {
  return status === "active" || status === "completed";
}

/**
 * Specification 7.4: an archived course that was assigned "may be displayed for
 * history only and must not start new attempts". So reading it is allowed and
 * acting on it is not.
 */
export function isCourseReadable(status: CourseStatus): boolean {
  return status === "published" || status === "archived";
}

/** Specification 4.2: only a published course is available to the learner. */
export function isCourseStudiable(status: CourseStatus): boolean {
  return status === "published";
}

export function courseNotAssignedError(): AppError {
  return new AppError(403, "course_not_assigned", "Курс вам не назначен");
}

/**
 * A draft course is unreachable in practice — a draft cannot be assigned
 * (specification 4.3) and a published course has no way back to draft — so it
 * answers like a course that is not assigned. The check costs nothing and a
 * hole in access rights costs a lot.
 */
export function courseNotStudiableError(status: CourseStatus): AppError {
  if (status === "archived") {
    return new AppError(
      403,
      "forbidden",
      "Курс архивирован: новые действия по нему недоступны",
    );
  }

  return courseNotAssignedError();
}

export function lessonLockedError(): AppError {
  return new AppError(
    403,
    "lesson_locked",
    "Урок откроется после завершения предыдущего",
  );
}

/**
 * Specification 4.2: a lesson with a mandatory test is completed only by a
 * passing result. The lesson has no "test is mandatory" flag — neither 8.3 nor
 * `lessonSchema` has one — so the link itself is the requirement: a test
 * attached to a lesson closes it.
 */
export function lessonTestRequiredError(): AppError {
  return new AppError(
    422,
    "lesson_test_required",
    "Урок завершается прохождением теста",
  );
}
