import { z } from "zod";

import { isoDateTimeSchema, objectIdSchema } from "./common.js";
import { activityEventTypeSchema } from "./enums.js";

/**
 * Событие ленты активности (ТЗ, 8.8). В ответе нет `metadata`: наружу отдаются
 * только безопасные поля, достаточные для строки ленты.
 * Лента и агрегаты по событиям относятся к Этапу 2 (ТЗ, 18.2).
 */
export const activityEventSchema = z.object({
  id: objectIdSchema,
  type: activityEventTypeSchema,
  courseId: objectIdSchema.nullable(),
  courseTitle: z.string().nullable(),
  lessonId: objectIdSchema.nullable(),
  lessonTitle: z.string().nullable(),
  createdAt: isoDateTimeSchema,
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;

/** Столбец графика активности: начало недели и число учебных действий (ТЗ, 7.8). */
export const activityWeekSchema = z.object({
  weekStart: isoDateTimeSchema,
  count: z.number().int().min(0),
});
export type ActivityWeek = z.infer<typeof activityWeekSchema>;
