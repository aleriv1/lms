import * as contracts from "@lms/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  clearDatabase,
  connectTestDatabase,
  disconnectTestDatabase,
} from "../testing/apiClient.js";

beforeAll(connectTestDatabase, 120_000);
afterAll(disconnectTestDatabase);
beforeEach(clearDatabase);

const id = "507f1f77bcf86cd799439011";
const date = "2026-01-01T00:00:00.000Z";
const userRef = { id, name: "Ученик" };
const courseRef = { id, title: "Учебный курс" };
const dates = { createdAt: date, updatedAt: date };
const meta = { page: 1, pageSize: 10, total: 1, totalPages: 1 };
const user = {
  ...userRef,
  ...dates,
  email: "user@example.test",
  role: "student",
  groupName: null,
  status: "active",
  lastLoginAt: null,
};
const courseBody = {
  title: "Учебный курс",
  category: "Обучение",
  audience: "general",
  shortDescription: "Краткое описание учебного курса",
  description: "Материалы курса",
  coverUrl: null,
};
const course = {
  ...courseBody,
  ...dates,
  id,
  author: userRef,
  status: "published",
  publishedAt: date,
  lessonsCount: 1,
};
const resourceLink = {
  title: "Материал",
  url: "https://example.test/material",
};
const lessonBody = {
  title: "Первый урок",
  order: 1,
  durationMinutes: 10,
  content: "Материал урока",
  videoUrl: null,
  resourceLinks: [resourceLink],
  isRequired: true,
  testId: null,
};
const lesson = {
  ...lessonBody,
  ...dates,
  id,
  courseId: id,
  status: "published",
};
const option = { id: "a", text: "Правильный ответ", isCorrect: true };
const questionInput = {
  text: "Какой ответ правильный?",
  type: "single",
  order: 1,
  options: [
    { text: "Первый", isCorrect: true },
    { text: "Второй", isCorrect: false },
  ],
};
const question = {
  id: "q1",
  ...questionInput,
  options: [option, { id: "b", text: "Второй", isCorrect: false }],
};
const testBody = {
  title: "Итоговый тест",
  lessonId: null,
  passingScore: 70,
  questions: [questionInput],
};
const test = {
  ...testBody,
  ...dates,
  id,
  courseId: id,
  version: 1,
  questionsCount: 1,
  questions: [question],
};
const learnerOption = { id: "a", text: "Первый" };
const learnerQuestion = {
  id: "q1",
  text: "Какой ответ правильный?",
  type: "single",
  order: 1,
  options: [learnerOption, { id: "b", text: "Второй" }],
};
const learnerTest = {
  id,
  courseId: id,
  lessonId: null,
  title: "Итоговый тест",
  passingScore: 70,
  questions: [learnerQuestion],
};
const assignment = {
  id,
  userId: id,
  course: { ...courseRef, status: "published" },
  assignedBy: userRef,
  status: "active",
  progressPercent: 50,
  assignedAt: date,
  revokedAt: null,
  completedAt: null,
};
const learningCard = {
  courseId: id,
  title: "Учебный курс",
  shortDescription: "Описание",
  coverUrl: null,
  courseStatus: "published",
  assignmentStatus: "active",
  progressPercent: 50,
  completedLessonsCount: 1,
  requiredLessonsCount: 2,
  lastActivityAt: date,
};
const learningItem = {
  id,
  title: "Первый урок",
  order: 1,
  durationMinutes: 10,
  isRequired: true,
  state: "available",
  hasTest: true,
};
const testRef = {
  id,
  title: "Тест урока",
  passingScore: 70,
  passed: false,
  bestScore: null,
  attemptsCount: 0,
};
const learningCourse = {
  ...courseBody,
  id,
  author: userRef,
  courseStatus: "published",
  assignmentStatus: "active",
  progressPercent: 0,
  lessons: [learningItem],
  finalTest: testRef,
  nextLessonId: id,
};
const learningLesson = {
  ...lessonBody,
  id,
  courseId: id,
  progressStatus: "not_started",
  requiredTest: testRef,
  previousLessonId: null,
  nextLessonId: null,
  courseProgressPercent: 0,
};
const progress = {
  lessonId: id,
  courseId: id,
  status: "completed",
  courseProgressPercent: 100,
  courseCompleted: true,
  nextLessonId: null,
};
const courseStat = {
  courseId: id,
  title: "Учебный курс",
  assignmentStatus: "completed",
  progressPercent: 100,
  completedAt: date,
};
const attempt = {
  review: [],
  id,
  testId: id,
  courseId: id,
  lessonId: null,
  score: 100,
  passingScore: 70,
  passed: true,
  correctCount: 1,
  totalCount: 1,
  attemptNumber: 1,
  submittedAt: date,
};
const attemptSummary = {
  id,
  testId: id,
  testTitle: "Итоговый тест",
  courseId: id,
  courseTitle: "Учебный курс",
  score: 100,
  passed: true,
  attemptNumber: 1,
  submittedAt: date,
  isBest: true,
  isLast: true,
};
const activity = {
  id,
  type: "lesson_completed",
  courseId: id,
  courseTitle: "Учебный курс",
  lessonId: id,
  lessonTitle: "Первый урок",
  createdAt: date,
};
const week = { weekStart: date, count: 1 };
const statistics = {
  totalLearningMinutes: 10,
  completedLessonsCount: 1,
  completedCoursesCount: 1,
  overallProgressPercent: 100,
  courses: [courseStat],
  testResults: [attemptSummary],
  activityWeeks: [week],
  recentActivity: [activity],
};
const dashboard = {
  activeCoursesCount: 1,
  usersCount: 1,
  testsCount: 1,
  activeAssignmentsCount: 1,
  newUsersLast7DaysCount: 1,
  completedCoursesCount: 0,
  averageProgressPercent: 50,
  recentCourses: [course],
};
const statisticsRow = {
  userId: id,
  name: "Ученик",
  groupName: null,
  activeCoursesCount: 1,
  completedCoursesCount: 0,
  averageProgressPercent: 50,
};
const courseProgress = {
  courseId: id,
  title: "Учебный курс",
  assignedUsersCount: 1,
  averageProgressPercent: 50,
};
const adminStatistics = {
  summary: {
    usersCount: 1,
    activeUsersCount: 1,
    completedUsersCount: 0,
    averageProgressPercent: 50,
  },
  courseProgress: [courseProgress],
  items: [statisticsRow],
  meta,
};
const userStatistics = {
  user,
  averageProgressPercent: 100,
  completedCoursesCount: 1,
  totalLearningMinutes: 10,
  courses: [courseStat],
  testResults: [attemptSummary],
  recentActivity: [activity],
};
const register = {
  name: "Ученик",
  email: "user@example.test",
  password: "Password1",
  passwordConfirm: "Password1",
};
const changePassword = {
  currentPassword: "Password1",
  newPassword: "Password2",
  newPasswordConfirm: "Password2",
};
const adminUpdate = {
  name: "Ученик",
  role: "student",
  groupName: null,
  status: "active",
};

// Request bodies and response schemas, including their exported nested objects.
// Queries and scalar validators are outside this body/response smoke test.
describe.each([
  [
    "registerBodySchema",
    contracts.registerBodySchema,
    register,
    { ...register, passwordConfirm: "different" },
  ],
  [
    "loginBodySchema",
    contracts.loginBodySchema,
    { email: register.email, password: register.password },
    { email: "invalid", password: "" },
  ],
  [
    "sessionResponseSchema",
    contracts.sessionResponseSchema,
    { user },
    { user: { ...user, role: "owner" } },
  ],
  [
    "publicUserSchema",
    contracts.publicUserSchema,
    user,
    { ...user, status: "deleted" },
  ],
  [
    "updateProfileBodySchema",
    contracts.updateProfileBodySchema,
    { name: register.name, email: register.email },
    { name: "", email: register.email },
  ],
  [
    "changePasswordBodySchema",
    contracts.changePasswordBodySchema,
    changePassword,
    { ...changePassword, newPasswordConfirm: "different" },
  ],
  [
    "adminUpdateUserBodySchema",
    contracts.adminUpdateUserBodySchema,
    adminUpdate,
    { ...adminUpdate, role: "owner" },
  ],
  [
    "adminUserListItemSchema",
    contracts.adminUserListItemSchema,
    { ...user, activeAssignmentsCount: 1 },
    { ...user, activeAssignmentsCount: -1 },
  ],
  [
    "adminUserDetailSchema",
    contracts.adminUserDetailSchema,
    { ...user, assignments: [assignment] },
    { ...user, assignments: null },
  ],
  [
    "createCourseBodySchema",
    contracts.createCourseBodySchema,
    courseBody,
    { ...courseBody, title: "x" },
  ],
  [
    "updateCourseBodySchema",
    contracts.updateCourseBodySchema,
    { title: "Новое название" },
    { title: "x" },
  ],
  [
    "courseSchema",
    contracts.courseSchema,
    course,
    { ...course, status: "deleted" },
  ],
  [
    "courseResponseSchema",
    contracts.courseResponseSchema,
    course,
    { ...course, publishedAt: "yesterday" },
  ],
  [
    "courseListItemSchema",
    contracts.courseListItemSchema,
    course,
    { ...course, lessonsCount: -1 },
  ],
  [
    "courseDetailSchema",
    contracts.courseDetailSchema,
    { ...course, lessons: [lesson], tests: [test] },
    { ...course, lessons: null, tests: [] },
  ],
  [
    "createLessonBodySchema",
    contracts.createLessonBodySchema,
    lessonBody,
    { ...lessonBody, durationMinutes: 0 },
  ],
  [
    "updateLessonBodySchema",
    contracts.updateLessonBodySchema,
    { title: "Новое название" },
    { order: 0 },
  ],
  [
    "reorderLessonsBodySchema",
    contracts.reorderLessonsBodySchema,
    { lessons: [{ lessonId: id, order: 1 }] },
    { lessons: [] },
  ],
  [
    "lessonSchema",
    contracts.lessonSchema,
    lesson,
    { ...lesson, courseId: "invalid" },
  ],
  [
    "lessonSummarySchema",
    contracts.lessonSummarySchema,
    lesson,
    { ...lesson, status: "archived" },
  ],
  [
    "resourceLinkSchema",
    contracts.resourceLinkSchema,
    resourceLink,
    { ...resourceLink, url: "javascript:alert(1)" },
  ],
  [
    "createAssignmentBodySchema",
    contracts.createAssignmentBodySchema,
    { courseId: id },
    { courseId: "invalid" },
  ],
  [
    "assignmentSchema",
    contracts.assignmentSchema,
    assignment,
    { ...assignment, progressPercent: 101 },
  ],
  [
    "questionOptionInputSchema",
    contracts.questionOptionInputSchema,
    questionInput.options[0],
    { text: "", isCorrect: true },
  ],
  [
    "questionInputSchema",
    contracts.questionInputSchema,
    questionInput,
    {
      ...questionInput,
      options: [
        { text: "Да", isCorrect: true },
        { text: "Нет", isCorrect: true },
      ],
    },
  ],
  [
    "questionOptionSchema",
    contracts.questionOptionSchema,
    option,
    { ...option, isCorrect: "true" },
  ],
  [
    "questionSchema",
    contracts.questionSchema,
    question,
    { ...question, type: "text" },
  ],
  [
    "createTestBodySchema",
    contracts.createTestBodySchema,
    testBody,
    { ...testBody, questions: [] },
  ],
  [
    "updateTestBodySchema",
    contracts.updateTestBodySchema,
    testBody,
    { ...testBody, passingScore: 0 },
  ],
  ["testSchema", contracts.testSchema, test, { ...test, version: 0 }],
  [
    "testSummarySchema",
    contracts.testSummarySchema,
    test,
    { ...test, questionsCount: -1 },
  ],
  [
    "learnerQuestionOptionSchema",
    contracts.learnerQuestionOptionSchema,
    learnerOption,
    { ...learnerOption, id: 1 },
  ],
  [
    "learnerQuestionSchema",
    contracts.learnerQuestionSchema,
    learnerQuestion,
    { ...learnerQuestion, options: null },
  ],
  [
    "learnerTestSchema",
    contracts.learnerTestSchema,
    learnerTest,
    { ...learnerTest, passingScore: 101 },
  ],
  [
    "submitAttemptBodySchema",
    contracts.submitAttemptBodySchema,
    { answers: [{ questionId: "q1", optionIds: ["a"] }] },
    { answers: [{ questionId: "q1", optionIds: "a" }] },
  ],
  [
    "attemptResultSchema",
    contracts.attemptResultSchema,
    attempt,
    { ...attempt, attemptNumber: 0 },
  ],
  [
    "testAttemptSummarySchema",
    contracts.testAttemptSummarySchema,
    attemptSummary,
    { ...attemptSummary, isBest: null },
  ],
  [
    "learningCourseCardSchema",
    contracts.learningCourseCardSchema,
    learningCard,
    { ...learningCard, requiredLessonsCount: -1 },
  ],
  [
    "learningOverviewSchema",
    contracts.learningOverviewSchema,
    {
      assignedCoursesCount: 1,
      totalLearningMinutes: 10,
      overallProgressPercent: 50,
      courses: [learningCard],
    },
    {
      assignedCoursesCount: -1,
      totalLearningMinutes: 10,
      overallProgressPercent: 50,
      courses: [],
    },
  ],
  [
    "learningLessonItemSchema",
    contracts.learningLessonItemSchema,
    learningItem,
    { ...learningItem, state: "draft" },
  ],
  [
    "learningTestRefSchema",
    contracts.learningTestRefSchema,
    testRef,
    { ...testRef, attemptsCount: -1 },
  ],
  [
    "learningCourseSchema",
    contracts.learningCourseSchema,
    learningCourse,
    { ...learningCourse, progressPercent: 0.5 },
  ],
  [
    "learningLessonSchema",
    contracts.learningLessonSchema,
    learningLesson,
    { ...learningLesson, progressStatus: "locked" },
  ],
  [
    "lessonProgressResponseSchema",
    contracts.lessonProgressResponseSchema,
    progress,
    { ...progress, courseCompleted: "true" },
  ],
  [
    "learnerCourseStatSchema",
    contracts.learnerCourseStatSchema,
    courseStat,
    { ...courseStat, completedAt: "yesterday" },
  ],
  [
    "learnerStatisticsSchema",
    contracts.learnerStatisticsSchema,
    statistics,
    { ...statistics, totalLearningMinutes: -1 },
  ],
  [
    "activityEventSchema",
    contracts.activityEventSchema,
    activity,
    { ...activity, type: "login" },
  ],
  [
    "activityWeekSchema",
    contracts.activityWeekSchema,
    week,
    { ...week, count: -1 },
  ],
  [
    "adminDashboardSchema",
    contracts.adminDashboardSchema,
    dashboard,
    { ...dashboard, usersCount: -1 },
  ],
  [
    "adminStatisticsRowSchema",
    contracts.adminStatisticsRowSchema,
    statisticsRow,
    { ...statisticsRow, averageProgressPercent: 101 },
  ],
  [
    "courseProgressStatSchema",
    contracts.courseProgressStatSchema,
    courseProgress,
    { ...courseProgress, assignedUsersCount: -1 },
  ],
  [
    "adminStatisticsResponseSchema",
    contracts.adminStatisticsResponseSchema,
    adminStatistics,
    { ...adminStatistics, meta: { ...meta, page: 0 } },
  ],
  [
    "userStatisticsSchema",
    contracts.userStatisticsSchema,
    userStatistics,
    { ...userStatistics, completedCoursesCount: -1 },
  ],
  [
    "userRefSchema",
    contracts.userRefSchema,
    userRef,
    { ...userRef, id: "invalid" },
  ],
  [
    "courseRefSchema",
    contracts.courseRefSchema,
    courseRef,
    { ...courseRef, title: null },
  ],
  ["listMetaSchema", contracts.listMetaSchema, meta, { ...meta, total: -1 }],
  [
    "createListResponseSchema",
    contracts.createListResponseSchema(contracts.courseListItemSchema),
    { items: [course], meta },
    { items: [course], meta: { ...meta, page: 0 } },
  ],
  [
    "fieldErrorSchema",
    contracts.fieldErrorSchema,
    { field: "title", message: "Обязательное поле" },
    { field: 1, message: "Ошибка" },
  ],
  [
    "apiErrorSchema",
    contracts.apiErrorSchema,
    {
      code: "validation_error",
      message: "Ошибка",
      fields: [{ field: "title", message: "Обязательное поле" }],
    },
    { code: "unknown", message: "Ошибка" },
  ],
] as const)("%s", (_name, schema, valid, invalid) => {
  it("parses a valid sample and rejects a broken sample", () => {
    expect(schema.safeParse(valid).success).toBe(true);
    expect(schema.safeParse(invalid).success).toBe(false);
  });
});
