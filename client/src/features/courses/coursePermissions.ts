import type { PublicUser } from "@lms/shared";

export function canEditCourse(
  user: PublicUser | null,
  course: { author: { id: string } },
): boolean {
  return user?.role === "admin" || user?.id === course.author.id;
}
