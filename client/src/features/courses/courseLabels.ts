import type { CourseAudience, CourseStatus } from "@lms/shared";

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  draft: "Черновик",
  published: "Опубликован",
  archived: "В архиве",
};

export const COURSE_AUDIENCE_LABELS: Record<CourseAudience, string> = {
  drivers: "Водители",
  technical_staff: "Технический персонал",
  dispatchers: "Диспетчеры",
  management: "Руководство",
  general: "Общий",
};
