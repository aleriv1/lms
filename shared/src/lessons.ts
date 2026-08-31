import { z } from "zod";

import {
  httpUrlSchema,
  isoDateTimeSchema,
  objectIdSchema,
  optionalHttpUrlSchema,
} from "./common.js";
import {
  LESSON_CONTENT_MAX_LENGTH,
  LESSON_DURATION_MAX_MINUTES,
  LESSON_DURATION_MIN_MINUTES,
  LESSON_ORDER_MAX,
  LESSON_ORDER_MIN,
  LESSON_TITLE_MAX_LENGTH,
  LESSON_TITLE_MIN_LENGTH,
  RESOURCE_LINKS_MAX_COUNT,
  RESOURCE_LINK_TITLE_MAX_LENGTH,
} from "./constants.js";
import { lessonStatusSchema } from "./enums.js";

export const resourceLinkSchema = z.object({
  title: z.string().trim().min(1, "Укажите название ссылки").max(RESOURCE_LINK_TITLE_MAX_LENGTH),
  url: httpUrlSchema,
});
export type ResourceLink = z.infer<typeof resourceLinkSchema>;

/** Строка оглавления курса в управляющей части (ТЗ, 7.12). */
export const lessonSummarySchema = z.object({
  id: objectIdSchema,
  title: z.string(),
  order: z.number().int(),
  durationMinutes: z.number().int(),
  isRequired: z.boolean(),
  status: lessonStatusSchema,
  testId: objectIdSchema.nullable(),
});
export type LessonSummary = z.infer<typeof lessonSummarySchema>;

/** Урок целиком (ТЗ, 8.3). */
export const lessonSchema = lessonSummarySchema.extend({
  courseId: objectIdSchema,
  content: z.string(),
  videoUrl: z.string().nullable(),
  resourceLinks: z.array(resourceLinkSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Lesson = z.infer<typeof lessonSchema>;

/**
 * POST /courses/:courseId/lessons. Курс определяется маршрутом и в теле не передаётся.
 * Статус не задаётся: урок создаётся как `draft`, публикация — отдельное действие (ТЗ, 4.2).
 * `testId` указывает тест того же курса; связь хранится в `Test.lessonId`, поле формы
 * лишь задаёт её (ТЗ, 7.13, 8.4).
 */
export const createLessonBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(LESSON_TITLE_MIN_LENGTH, "Название не короче 3 символов")
    .max(LESSON_TITLE_MAX_LENGTH, "Название не длиннее 150 символов"),
  order: z.coerce
    .number()
    .int("Порядковый номер — целое число")
    .min(LESSON_ORDER_MIN)
    .max(LESSON_ORDER_MAX),
  durationMinutes: z.coerce
    .number()
    .int("Длительность — целое число минут")
    .min(LESSON_DURATION_MIN_MINUTES, "Не меньше 1 минуты")
    .max(LESSON_DURATION_MAX_MINUTES, "Не больше 600 минут"),
  content: z
    .string()
    .trim()
    .min(1, "Содержание обязательно")
    .max(LESSON_CONTENT_MAX_LENGTH, "Содержание не длиннее 50 000 символов"),
  videoUrl: optionalHttpUrlSchema,
  resourceLinks: z.array(resourceLinkSchema).max(RESOURCE_LINKS_MAX_COUNT).default([]),
  isRequired: z.boolean().default(true),
  testId: objectIdSchema.nullable().default(null),
});
export type CreateLessonBody = z.infer<typeof createLessonBodySchema>;

/** PATCH /courses/:courseId/lessons/:lessonId. */
export const updateLessonBodySchema = createLessonBodySchema.partial();
export type UpdateLessonBody = z.infer<typeof updateLessonBodySchema>;

/**
 * Изменение порядка уроков одной операцией (ТЗ, 7.12). Передаётся полный список
 * уроков курса: сервер проверяет уникальность номеров активных уроков (ТЗ, 4.2).
 */
export const reorderLessonsBodySchema = z.object({
  lessons: z
    .array(
      z.object({
        lessonId: objectIdSchema,
        order: z.number().int().min(LESSON_ORDER_MIN).max(LESSON_ORDER_MAX),
      }),
    )
    .min(1),
});
export type ReorderLessonsBody = z.infer<typeof reorderLessonsBodySchema>;
