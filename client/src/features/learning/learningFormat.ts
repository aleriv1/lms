import type { LessonAccessState, LessonProgressStatus } from "@lms/shared";

export const LESSON_ACCESS_STATE_LABELS: Record<LessonAccessState, string> = {
  completed: "Завершён",
  available: "Доступен",
  locked: "Заблокирован",
};

export const LESSON_PROGRESS_STATUS_LABELS: Record<
  LessonProgressStatus,
  string
> = {
  not_started: "Не начат",
  in_progress: "В процессе",
  completed: "Завершён",
};

export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} мин`;
  return minutes === 0 ? `${hours} ч` : `${hours} ч ${minutes} мин`;
}
