import type { PublicUser, UserRole } from "@lms/shared";

export type NavItem = { to: string; label: string };

const NAV_ITEMS: Record<UserRole, NavItem[]> = {
  student: [
    { to: "/learning", label: "Мое обучение" },
    { to: "/profile", label: "Личный кабинет" },
  ],
  teacher: [
    { to: "/manage/courses", label: "Каталог курсов" },
    { to: "/profile", label: "Личный кабинет" },
  ],
  admin: [
    { to: "/admin", label: "Главная" },
    { to: "/manage/courses", label: "Каталог курсов" },
    { to: "/admin/users", label: "Пользователи" },
    { to: "/profile", label: "Личный кабинет" },
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
      ? [item, { to: `/manage/courses?authorId=${user.id}`, label: "Мои курсы" }]
      : [item],
  );
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
