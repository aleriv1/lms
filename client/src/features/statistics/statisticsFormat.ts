import type {
  ActivityEventType,
  AdminStatisticsRow,
  LearningStatus,
} from "@lms/shared";

export const ACTIVITY_EVENT_LABELS: Record<ActivityEventType, string> = {
  lesson_started: "Начат урок",
  lesson_completed: "Завершен урок",
  test_submitted: "Отправлен тест",
  course_completed: "Завершен курс",
};

export const LEARNING_STATUS_LABELS: Record<LearningStatus, string> = {
  not_started: "Не начато",
  in_progress: "В процессе",
  completed: "Завершено",
};

export function formatWeekStart(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function formatStatisticsProgress(row: AdminStatisticsRow): string {
  return row.activeCoursesCount === 0 && row.completedCoursesCount === 0
    ? "—"
    : `${row.averageProgressPercent} %`;
}
