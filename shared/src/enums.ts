import { z } from "zod";

/** Перечисления модели данных (ТЗ, раздел 8) и стабильные коды ошибок API (ТЗ, 9.5). */

export const USER_ROLES = ["student", "teacher", "admin"] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

export const USER_STATUSES = ["active", "blocked", "archived"] as const;
export const userStatusSchema = z.enum(USER_STATUSES);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const COURSE_STATUSES = ["draft", "published", "archived"] as const;
export const courseStatusSchema = z.enum(COURSE_STATUSES);
export type CourseStatus = z.infer<typeof courseStatusSchema>;

/** Аудитория курса — категория персонала (ТЗ, 7.12). */
export const COURSE_AUDIENCES = [
  "drivers",
  "technical_staff",
  "dispatchers",
  "management",
  "general",
] as const;
export const courseAudienceSchema = z.enum(COURSE_AUDIENCES);
export type CourseAudience = z.infer<typeof courseAudienceSchema>;

export const LESSON_STATUSES = ["draft", "published"] as const;
export const lessonStatusSchema = z.enum(LESSON_STATUSES);
export type LessonStatus = z.infer<typeof lessonStatusSchema>;

export const ASSIGNMENT_STATUSES = ["active", "revoked", "completed"] as const;
export const assignmentStatusSchema = z.enum(ASSIGNMENT_STATUSES);
export type AssignmentStatus = z.infer<typeof assignmentStatusSchema>;

export const LESSON_PROGRESS_STATUSES = [
  "not_started",
  "in_progress",
  "completed",
] as const;
export const lessonProgressStatusSchema = z.enum(LESSON_PROGRESS_STATUSES);
export type LessonProgressStatus = z.infer<typeof lessonProgressStatusSchema>;

/** Состояние урока в оглавлении назначенного курса (ТЗ, 7.5). */
export const LESSON_ACCESS_STATES = ["completed", "available", "locked"] as const;
export const lessonAccessStateSchema = z.enum(LESSON_ACCESS_STATES);
export type LessonAccessState = z.infer<typeof lessonAccessStateSchema>;

export const QUESTION_TYPES = ["single", "multiple"] as const;
export const questionTypeSchema = z.enum(QUESTION_TYPES);
export type QuestionType = z.infer<typeof questionTypeSchema>;

/** Минимальный состав событий для ленты активности (ТЗ, 7.16). */
export const ACTIVITY_EVENT_TYPES = [
  "lesson_started",
  "lesson_completed",
  "test_submitted",
  "course_completed",
] as const;
export const activityEventTypeSchema = z.enum(ACTIVITY_EVENT_TYPES);
export type ActivityEventType = z.infer<typeof activityEventTypeSchema>;

export const SORT_ORDERS = ["asc", "desc"] as const;
export const sortOrderSchema = z.enum(SORT_ORDERS);
export type SortOrder = z.infer<typeof sortOrderSchema>;

/**
 * Машинные коды ошибок. Клиент реагирует на код, а не на текст сообщения.
 * Общие коды соответствуют статусам 400/401/403/404/409/422/500, доменные
 * уточняют причину отказа.
 */
export const API_ERROR_CODES = [
  "bad_request",
  "validation_error",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "unprocessable",
  "internal_error",
  "invalid_credentials",
  "account_blocked",
  "email_taken",
  "invalid_current_password",
  "self_modification_forbidden",
  "course_not_publishable",
  "course_delete_forbidden",
  "course_not_assigned",
  "assignment_exists",
  "assignment_not_active",
  "lesson_locked",
  "lesson_test_required",
  "rate_limited",
] as const;
export const apiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
