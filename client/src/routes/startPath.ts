import type { UserRole } from "@lms/shared";

/** Specification 7.1. See "Expected intermediate state" in the slice prompt. */
export function getStartPath(role: UserRole): string {
  const startPaths: Record<UserRole, string> = {
    student: "/learning",
    teacher: "/manage/courses",
    admin: "/admin",
  };

  return startPaths[role];
}
