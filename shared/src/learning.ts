import { z } from "zod";

import { activityEventSchema, activityWeekSchema } from "./activity.js";
import {
  isoDateTimeSchema,
  objectIdSchema,
  percentSchema,
  userRefSchema,
} from "./common.js";
import {
  assignmentStatusSchema,
  courseAudienceSchema,
  courseStatusSchema,
  lessonAccessStateSchema,
  lessonProgressStatusSchema,
} from "./enums.js";
import { resourceLinkSchema } from "./lessons.js";
import { testAttemptSummarySchema } from "./tests.js";

/** Карточка курса в «Моём обучении» (ТЗ, 7.4). */
export const learningCourseCardSchema = z.object({
  courseId: objectIdSchema,
  title: z.string(),
  shortDescription: z.string(),
  coverUrl: z.string().nullable(),
  courseStatus: courseStatusSchema,
  assignmentStatus: assignmentStatusSchema,
  progressPercent: percentSchema,
  completedLessonsCount: z.number().int().min(0),
  requiredLessonsCount: z.number().int().min(0),
  lastActivityAt: isoDateTimeSchema.nullable(),
});
export type LearningCourseCard = z.infer<typeof learningCourseCardSchema>;

/**
 * GET /learning/me. Все показатели считает сервер: суммарное время — сумма
 * длительностей завершённых уроков, общий прогресс — среднее по назначениям,
 * которые не отозваны, то есть по тем же карточкам `courses` (ТЗ, 7.4).
 * `assignedCoursesCount` — число курсов, а не строк назначений: курс,
 * назначенный повторно после завершения, показывается один раз.
 */
export const learningOverviewSchema = z.object({
  assignedCoursesCount: z.number().int().min(0),
  totalLearningMinutes: z.number().int().min(0),
  overallProgressPercent: percentSchema,
  courses: z.array(learningCourseCardSchema),
});
export type LearningOverview = z.infer<typeof learningOverviewSchema>;

/** Строка оглавления назначенного курса (ТЗ, 7.5). */
export const learningLessonItemSchema = z.object({
  id: objectIdSchema,
  title: z.string(),
  order: z.number().int(),
  durationMinutes: z.number().int(),
  isRequired: z.boolean(),
  state: lessonAccessStateSchema,
  hasTest: z.boolean(),
});
export type LearningLessonItem = z.infer<typeof learningLessonItemSchema>;

export const learningTestRefSchema = z.object({
  id: objectIdSchema,
  title: z.string(),
  passingScore: percentSchema,
  passed: z.boolean(),
  bestScore: percentSchema.nullable(),
  attemptsCount: z.number().int().min(0),
});
export type LearningTestRef = z.infer<typeof learningTestRefSchema>;

/**
 * GET /learning/courses/:courseId. Отдаётся только назначенный курс;
 * назначение `active` или `completed` даёт доступ, отозванное — нет, и тогда
 * сервер отвечает `course_not_assigned` (ТЗ, 7.4, 7.5).
 */
export const learningCourseSchema = z.object({
  id: objectIdSchema,
  title: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  category: z.string(),
  audience: courseAudienceSchema,
  coverUrl: z.string().nullable(),
  author: userRefSchema,
  courseStatus: courseStatusSchema,
  assignmentStatus: assignmentStatusSchema,
  progressPercent: percentSchema,
  lessons: z.array(learningLessonItemSchema),
  finalTest: learningTestRefSchema.nullable(),
  /** Первый доступный незавершённый урок для кнопки «Продолжить обучение». */
  nextLessonId: objectIdSchema.nullable(),
});
export type LearningCourse = z.infer<typeof learningCourseSchema>;

/**
 * GET /learning/courses/:courseId/lessons/:lessonId. Заблокированный урок
 * не отдаётся: сервер отвечает `lesson_locked` (ТЗ, 7.5).
 */
export const learningLessonSchema = z.object({
  id: objectIdSchema,
  courseId: objectIdSchema,
  title: z.string(),
  order: z.number().int(),
  durationMinutes: z.number().int(),
  isRequired: z.boolean(),
  /** Санитизированная сервером разметка учебного материала (ТЗ, 10.3). */
  content: z.string(),
  videoUrl: z.string().nullable(),
  resourceLinks: z.array(resourceLinkSchema),
  progressStatus: lessonProgressStatusSchema,
  /** Обязательный тест урока: пока он не пройден, урок не завершается (ТЗ, 4.2). */
  requiredTest: learningTestRefSchema.nullable(),
  previousLessonId: objectIdSchema.nullable(),
  nextLessonId: objectIdSchema.nullable(),
  courseProgressPercent: percentSchema,
});
export type LearningLesson = z.infer<typeof learningLessonSchema>;

/**
 * Ответ на POST /learning/lessons/:lessonId/start и /complete: обновлённый
 * прогресс, чтобы клиент не пересчитывал его сам (ТЗ, 4.3).
 */
export const lessonProgressResponseSchema = z.object({
  lessonId: objectIdSchema,
  courseId: objectIdSchema,
  status: lessonProgressStatusSchema,
  courseProgressPercent: percentSchema,
  courseCompleted: z.boolean(),
  nextLessonId: objectIdSchema.nullable(),
});
export type LessonProgressResponse = z.infer<typeof lessonProgressResponseSchema>;

/** Курс в статистике обучающегося (ТЗ, 7.8, 7.16). */
export const learnerCourseStatSchema = z.object({
  courseId: objectIdSchema,
  title: z.string(),
  assignmentStatus: assignmentStatusSchema,
  progressPercent: percentSchema,
  completedAt: isoDateTimeSchema.nullable(),
});
export type LearnerCourseStat = z.infer<typeof learnerCourseStatSchema>;

/**
 * GET /learning/me/statistics (ТЗ, 7.8). `activityWeeks` и `recentActivity`
 * наполняются событиями `ActivityEvent` на Этапе 2; на Этапе 1 это пустые
 * массивы (ТЗ, 18).
 */
export const learnerStatisticsSchema = z.object({
  totalLearningMinutes: z.number().int().min(0),
  completedLessonsCount: z.number().int().min(0),
  completedCoursesCount: z.number().int().min(0),
  overallProgressPercent: percentSchema,
  courses: z.array(learnerCourseStatSchema),
  testResults: z.array(testAttemptSummarySchema),
  activityWeeks: z.array(activityWeekSchema),
  recentActivity: z.array(activityEventSchema),
});
export type LearnerStatistics = z.infer<typeof learnerStatisticsSchema>;
