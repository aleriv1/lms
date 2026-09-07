import type { PublicUser, UserRole } from "@lms/shared";

export type NavItem = { to: string; label: string };

/**
 * Specification 4.3 lets an administrator assign a course to any active user,
 * and the learning API checks the assignment rather than the role
 * (`learningRouter.use(requireAuth)` with no `requireRole`). So «Мое обучение»
 * belongs to every role: a teacher or an administrator who was assigned a
 * course had the progress on their profile but no way in to earn it.
 */
const LEARNING_ITEM: NavItem = { to: "/learning", label: "Мое обучение" };
const PROFILE_ITEM: NavItem = { to: "/profile", label: "Личный кабинет" };

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  student: [LEARNING_ITEM, PROFILE_ITEM],
  teacher: [
    { to: "/manage/courses", label: "Каталог курсов" },
    LEARNING_ITEM,
    PROFILE_ITEM,
  ],
  admin: [
    { to: "/admin", label: "Главная" },
    { to: "/manage/courses", label: "Каталог курсов" },
    { to: "/admin/users", label: "Пользователи" },
    LEARNING_ITEM,
    PROFILE_ITEM,
  ],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  student: "Обучающийся",
  teacher: "Преподаватель",
  admin: "Администратор",
};

/**
 * A teacher's daily list is their own courses, so their one catalogue item
 * carries the author filter. It was a second item before — the same page under
 * two names — and the pair said nothing the checkbox inside the page does not.
 * Clearing that checkbox drops the parameter and shows everyone's courses.
 */
export function getNavItems(user: PublicUser): NavItem[] {
  const items = NAV_ITEMS[user.role];

  if (user.role !== "teacher") {
    return items;
  }

  return items.map((item) =>
    item.to === "/manage/courses"
      ? { ...item, to: `/manage/courses?authorId=${user.id}` }
      : item,
  );
}

/**
 * «Главная» (`/admin`) is a prefix of «Пользователи» (`/admin/users`), so a
 * plain prefix test lit both rails at once. The longest matching item wins:
 * `/admin/users/:id` still belongs to «Пользователи», `/admin/statistics` —
 * which has no item of its own — still belongs to «Главная».
 */
export function findActiveNavItem(
  items: NavItem[],
  pathname: string,
): NavItem | null {
  return items.reduce<NavItem | null>((active, item) => {
    if (!isNavItemActive(item, pathname)) {
      return active;
    }
    return active && active.to.length >= item.to.length ? active : item;
  }, null);
}

/**
 * The query string of an item is a starting filter, not part of its identity:
 * «Каталог курсов» stays lit whether or not the author filter is on.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const itemPath = item.to.split("?")[0] ?? item.to;
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}
