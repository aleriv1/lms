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

export function getNavItems(user: PublicUser): NavItem[] {
  const items = NAV_ITEMS[user.role];

  if (user.role !== "teacher") {
    return items;
  }

  return items.flatMap((item) =>
    item.to === "/manage/courses"
      ? [
          item,
          { to: `/manage/courses?authorId=${user.id}`, label: "Мои курсы" },
        ]
      : [item],
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
  search: string,
): NavItem | null {
  return items.reduce<NavItem | null>((active, item) => {
    if (!isNavItemActive(item, pathname, search)) {
      return active;
    }
    return active && active.to.length >= item.to.length ? active : item;
  }, null);
}

/** «Каталог курсов» and «Мои курсы» share a path and differ only by query. */
export function isNavItemActive(
  item: NavItem,
  pathname: string,
  search: string,
): boolean {
  const [itemPath, itemSearch = ""] = item.to.split("?");
  const pathMatches =
    pathname === itemPath || pathname.startsWith(`${itemPath}/`);

  if (!pathMatches) {
    return false;
  }

  const itemAuthorId = new URLSearchParams(itemSearch).get("authorId");
  const locationAuthorId = new URLSearchParams(search).get("authorId");
  return itemAuthorId
    ? itemAuthorId === locationAuthorId
    : locationAuthorId === null;
}
