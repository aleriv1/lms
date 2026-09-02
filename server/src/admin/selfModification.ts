import type { AdminUpdateUserBody, FieldError, PublicUser } from "@lms/shared";

/**
 * Specification 4.1: an administrator may not block or demote their own active
 * account through the ordinary editing form. Archiving oneself is refused on
 * the same grounds — the rule is written around keeping that account active,
 * and archiving takes the access away exactly as blocking does.
 *
 * The name and the group are not restricted: specification 3.2 lets everyone
 * edit their own profile, and the administrative form must not be stricter than
 * `PATCH /users/me`.
 */
export function collectSelfModificationIssues(
  actor: PublicUser,
  targetUserId: string,
  body: AdminUpdateUserBody,
): FieldError[] {
  if (actor.id !== targetUserId) {
    return [];
  }

  const issues: FieldError[] = [];

  if (body.role !== "admin") {
    issues.push({
      field: "role",
      message: "Нельзя понизить роль собственной учетной записи",
    });
  }

  if (body.status !== "active") {
    issues.push({
      field: "status",
      message: "Нельзя заблокировать или архивировать собственную учетную запись",
    });
  }

  return issues;
}
