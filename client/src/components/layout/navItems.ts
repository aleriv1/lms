import type { UserRole } from "@lms/shared";

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

export function getNavItems(role: UserRole): NavItem[] {
  return NAV_ITEMS[role];
}
