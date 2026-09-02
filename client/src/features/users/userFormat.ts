import { ASSIGNMENT_STATUSES, USER_STATUSES } from "@lms/shared";

export const USER_STATUS_LABELS: Record<
  (typeof USER_STATUSES)[number],
  string
> = {
  active: "Активен",
  blocked: "Заблокирован",
  archived: "В архиве",
};

export const ASSIGNMENT_STATUS_LABELS: Record<
  (typeof ASSIGNMENT_STATUSES)[number],
  string
> = {
  active: "Активно",
  revoked: "Снято",
  completed: "Завершено",
};

export function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU");
}
