import { z } from "zod";

import { activityEventSchema } from "./activity.js";
import {
  listMetaSchema,
  objectIdSchema,
  paginationQuerySchema,
  percentSchema,
} from "./common.js";
import { courseListItemSchema } from "./courses.js";
import { GROUP_NAME_MAX_LENGTH } from "./constants.js";
import { learnerCourseStatSchema } from "./learning.js";
import { testAttemptSummarySchema } from "./tests.js";
import { publicUserSchema } from "./users.js";

/** GET /admin/dashboard — показатели считаются агрегатами на сервере (ТЗ, 7.10). */
export const adminDashboardSchema = z.object({
  activeCoursesCount: z.number().int().min(0),
  usersCount: z.number().int().min(0),
  testsCount: z.number().int().min(0),
  activeAssignmentsCount: z.number().int().min(0),
  newUsersLast7DaysCount: z.number().int().min(0),
  completedCoursesCount: z.number().int().min(0),
  averageProgressPercent: percentSchema,
  recentCourses: z.array(courseListItemSchema),
});
export type AdminDashboard = z.infer<typeof adminDashboardSchema>;

/**
 * Фильтр «статус» на странице статистики трактуется как состояние обучения
 * пользователя по выбранному курсу (ТЗ, 7.15).
 */
export const LEARNING_STATUSES = ["not_started", "in_progress", "completed"] as const;
export const learningStatusSchema = z.enum(LEARNING_STATUSES);
export type LearningStatus = z.infer<typeof learningStatusSchema>;

/** GET /admin/statistics. Фильтры целиком относятся к Этапу 2 (ТЗ, 18.2). */
export const adminStatisticsQuerySchema = paginationQuerySchema.extend({
  courseId: objectIdSchema.optional(),
  groupName: z.string().trim().max(GROUP_NAME_MAX_LENGTH).optional(),
  learningStatus: learningStatusSchema.optional(),
});
export type AdminStatisticsQuery = z.infer<typeof adminStatisticsQuerySchema>;

/** Строка таблицы обучающихся (ТЗ, 7.15). */
export const adminStatisticsRowSchema = z.object({
  userId: objectIdSchema,
  name: z.string(),
  groupName: z.string().nullable(),
  activeCoursesCount: z.number().int().min(0),
  completedCoursesCount: z.number().int().min(0),
  averageProgressPercent: percentSchema,
});
export type AdminStatisticsRow = z.infer<typeof adminStatisticsRowSchema>;

export const courseProgressStatSchema = z.object({
  courseId: objectIdSchema,
  title: z.string(),
  assignedUsersCount: z.number().int().min(0),
  averageProgressPercent: percentSchema,
});
export type CourseProgressStat = z.infer<typeof courseProgressStatSchema>;

export const adminStatisticsResponseSchema = z.object({
  summary: z.object({
    usersCount: z.number().int().min(0),
    /** Активен — совершил учебное действие за последние 30 дней (ТЗ, 7.15). */
    activeUsersCount: z.number().int().min(0),
    completedUsersCount: z.number().int().min(0),
    averageProgressPercent: percentSchema,
  }),
  courseProgress: z.array(courseProgressStatSchema),
  items: z.array(adminStatisticsRowSchema),
  meta: listMetaSchema,
});
export type AdminStatisticsResponse = z.infer<typeof adminStatisticsResponseSchema>;

/**
 * GET /admin/statistics/users/:userId (ТЗ, 7.16). `recentActivity` наполняется
 * событиями `ActivityEvent` на Этапе 2; на Этапе 1 это пустой массив.
 */
export const userStatisticsSchema = z.object({
  user: publicUserSchema,
  averageProgressPercent: percentSchema,
  completedCoursesCount: z.number().int().min(0),
  totalLearningMinutes: z.number().int().min(0),
  courses: z.array(learnerCourseStatSchema),
  testResults: z.array(testAttemptSummarySchema),
  recentActivity: z.array(activityEventSchema),
});
export type UserStatistics = z.infer<typeof userStatisticsSchema>;
