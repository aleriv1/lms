import { z } from "zod";

import {
  isoDateTimeSchema,
  objectIdSchema,
  optionalHttpUrlSchema,
  paginationQuerySchema,
  searchQuerySchema,
  sortQuerySchema,
  userRefSchema,
} from "./common.js";
import {
  COURSE_CATEGORY_MAX_LENGTH,
  COURSE_CATEGORY_MIN_LENGTH,
  COURSE_DESCRIPTION_MAX_LENGTH,
  COURSE_SHORT_DESCRIPTION_MAX_LENGTH,
  COURSE_SHORT_DESCRIPTION_MIN_LENGTH,
  COURSE_TITLE_MAX_LENGTH,
  COURSE_TITLE_MIN_LENGTH,
} from "./constants.js";
import { courseAudienceSchema, courseStatusSchema } from "./enums.js";
import { lessonSummarySchema } from "./lessons.js";
import { testSummarySchema } from "./tests.js";

export const courseCategorySchema = z
  .string()
  .trim()
  .min(COURSE_CATEGORY_MIN_LENGTH, "Категория не короче 2 символов")
  .max(COURSE_CATEGORY_MAX_LENGTH, "Категория не длиннее 60 символов");

/** Курс в управляющей части приложения (ТЗ, 8.2). */
export const courseSchema = z.object({
  id: objectIdSchema,
  title: z.string(),
  category: z.string(),
  audience: courseAudienceSchema,
  shortDescription: z.string(),
  description: z.string(),
  coverUrl: z.string().nullable(),
  author: userRefSchema,
  status: courseStatusSchema,
  publishedAt: isoDateTimeSchema.nullable(),
  lessonsCount: z.number().int().min(0),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Course = z.infer<typeof courseSchema>;

/** Строка каталога курсов (ТЗ, 7.11). */
export const courseListItemSchema = courseSchema.omit({ description: true });
export type CourseListItem = z.infer<typeof courseListItemSchema>;

/** GET /courses/:courseId — курс с уроками и тестами для редактирования (ТЗ, 7.12). */
export const courseDetailSchema = courseSchema.extend({
  lessons: z.array(lessonSummarySchema),
  tests: z.array(testSummarySchema),
});
export type CourseDetail = z.infer<typeof courseDetailSchema>;

/**
 * POST /courses. Статус здесь не задаётся: новый курс создаётся как `draft`,
 * публикация и архивирование — отдельные операции (ТЗ, 4.2, 7.12).
 */
export const createCourseBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(COURSE_TITLE_MIN_LENGTH, "Название не короче 3 символов")
    .max(COURSE_TITLE_MAX_LENGTH, "Название не длиннее 120 символов"),
  category: courseCategorySchema,
  audience: courseAudienceSchema,
  shortDescription: z
    .string()
    .trim()
    .min(COURSE_SHORT_DESCRIPTION_MIN_LENGTH, "Краткое описание не короче 20 символов")
    .max(COURSE_SHORT_DESCRIPTION_MAX_LENGTH, "Краткое описание не длиннее 300 символов"),
  description: z.string().trim().max(COURSE_DESCRIPTION_MAX_LENGTH).default(""),
  coverUrl: optionalHttpUrlSchema,
});
export type CreateCourseBody = z.infer<typeof createCourseBodySchema>;

/** PATCH /courses/:courseId. */
export const updateCourseBodySchema = createCourseBodySchema.partial();
export type UpdateCourseBody = z.infer<typeof updateCourseBodySchema>;

export const COURSE_SORT_FIELDS = ["title", "createdAt", "updatedAt", "publishedAt"] as const;
export const courseSortFieldSchema = z.enum(COURSE_SORT_FIELDS);

/** GET /courses — каталог с поиском, фильтрами, сортировкой и пагинацией (ТЗ, 7.11). */
export const coursesQuerySchema = paginationQuerySchema
  .extend(searchQuerySchema.shape)
  .extend(sortQuerySchema.shape)
  .extend({
    category: z.string().trim().max(COURSE_CATEGORY_MAX_LENGTH).optional(),
    audience: courseAudienceSchema.optional(),
    status: courseStatusSchema.optional(),
    authorId: objectIdSchema.optional(),
    sortBy: courseSortFieldSchema.default("updatedAt"),
  });
export type CoursesQuery = z.infer<typeof coursesQuerySchema>;

/**
 * POST /courses/:courseId/publish и /archive возвращают обновлённый курс.
 * При невыполненных условиях публикации сервер отвечает ошибкой
 * `course_not_publishable` и перечисляет незаполненные поля в `fields`;
 * отсутствие опубликованного обязательного урока указывается как поле `lessons`
 * (ТЗ, 4.2, 7.12).
 */
export const courseResponseSchema = courseSchema;
