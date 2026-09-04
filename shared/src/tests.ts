import { z } from "zod";

import { isoDateTimeSchema, objectIdSchema, percentSchema } from "./common.js";
import {
  PASSING_SCORE_MAX,
  PASSING_SCORE_MIN,
  QUESTION_OPTIONS_MAX_COUNT,
  QUESTION_OPTIONS_MIN_COUNT,
  QUESTION_OPTION_TEXT_MAX_LENGTH,
  QUESTION_OPTION_TEXT_MIN_LENGTH,
  QUESTION_TEXT_MAX_LENGTH,
  QUESTION_TEXT_MIN_LENGTH,
  TEST_QUESTIONS_MAX_COUNT,
  TEST_QUESTIONS_MIN_COUNT,
  TEST_TITLE_MAX_LENGTH,
  TEST_TITLE_MIN_LENGTH,
} from "./constants.js";
import { questionTypeSchema } from "./enums.js";

/* --- Административное представление: с признаком правильности (ТЗ, 8.4) --- */

export const questionOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  isCorrect: z.boolean(),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;

export const questionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: questionTypeSchema,
  order: z.number().int(),
  options: z.array(questionOptionSchema),
});
export type Question = z.infer<typeof questionSchema>;

export const testSummarySchema = z.object({
  id: objectIdSchema,
  title: z.string(),
  lessonId: objectIdSchema.nullable(),
  passingScore: percentSchema,
  questionsCount: z.number().int().min(0),
  version: z.number().int().min(1),
});
export type TestSummary = z.infer<typeof testSummarySchema>;

export const testSchema = testSummarySchema.extend({
  courseId: objectIdSchema,
  questions: z.array(questionSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Test = z.infer<typeof testSchema>;

/* --- Ввод: создание и редактирование теста (ТЗ, 4.4, 7.17) --- */

export const questionOptionInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(QUESTION_OPTION_TEXT_MIN_LENGTH, "Текст варианта обязателен")
    .max(
      QUESTION_OPTION_TEXT_MAX_LENGTH,
      "Текст варианта не длиннее 300 символов",
    ),
  isCorrect: z.boolean(),
});
export type QuestionOptionInput = z.infer<typeof questionOptionInputSchema>;

/**
 * У вопроса не менее двух вариантов и не менее одного правильного;
 * для типа `single` правильный вариант ровно один (ТЗ, 4.4).
 * Идентификаторы вариантов присваивает сервер.
 */
export const questionInputSchema = z
  .object({
    text: z
      .string()
      .trim()
      .min(QUESTION_TEXT_MIN_LENGTH, "Текст вопроса не короче 3 символов")
      .max(QUESTION_TEXT_MAX_LENGTH, "Текст вопроса не длиннее 500 символов"),
    type: questionTypeSchema,
    order: z.number().int().min(1, "Порядковый номер вопроса не меньше 1"),
    options: z
      .array(questionOptionInputSchema)
      .min(QUESTION_OPTIONS_MIN_COUNT, "Нужно не менее двух вариантов")
      .max(QUESTION_OPTIONS_MAX_COUNT, "Не больше десяти вариантов"),
  })
  .superRefine((question, ctx) => {
    const correctCount = question.options.filter(
      (option) => option.isCorrect,
    ).length;

    if (correctCount === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Отметьте хотя бы один правильный вариант",
      });
      return;
    }

    if (question.type === "single" && correctCount > 1) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message:
          "Для вопроса с одним ответом правильный вариант должен быть один",
      });
    }
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

/**
 * POST /courses/:courseId/tests. Курс определяется маршрутом (ТЗ, 7.17).
 * `lessonId === null` означает итоговый тест курса; урок должен принадлежать
 * тому же курсу — это проверяет сервер.
 */
export const createTestBodySchema = z.object({
  title: z
    .string()
    .trim()
    .min(TEST_TITLE_MIN_LENGTH, "Название не короче 3 символов")
    .max(TEST_TITLE_MAX_LENGTH, "Название не длиннее 150 символов"),
  lessonId: objectIdSchema.nullable().default(null),
  passingScore: z.coerce
    .number()
    .int("Проходной балл — целое число")
    .min(PASSING_SCORE_MIN, "Проходной балл не меньше 1")
    .max(PASSING_SCORE_MAX, "Проходной балл не больше 100")
    .default(70),
  questions: z
    .array(questionInputSchema)
    .min(TEST_QUESTIONS_MIN_COUNT, "Добавьте хотя бы один вопрос")
    .max(TEST_QUESTIONS_MAX_COUNT, "Не больше ста вопросов"),
});
export type CreateTestBody = z.infer<typeof createTestBodySchema>;

/** PATCH /courses/:courseId/tests/:testId — тест сохраняется целиком, вопросы заменяются. */
export const updateTestBodySchema = createTestBodySchema;
export type UpdateTestBody = z.infer<typeof updateTestBodySchema>;

/* --- Представление для обучающегося: без правильных ответов (ТЗ, 4.4, 10.3) --- */

export const learnerQuestionOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const learnerQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  type: questionTypeSchema,
  order: z.number().int(),
  options: z.array(learnerQuestionOptionSchema),
});
export type LearnerQuestion = z.infer<typeof learnerQuestionSchema>;

/** GET /learning/tests/:testId. */
export const learnerTestSchema = z.object({
  id: objectIdSchema,
  courseId: objectIdSchema,
  lessonId: objectIdSchema.nullable(),
  title: z.string(),
  passingScore: percentSchema,
  questions: z.array(learnerQuestionSchema),
});
export type LearnerTest = z.infer<typeof learnerTestSchema>;

/**
 * POST /learning/tests/:testId/attempts. Клиент передаёт только выбранные варианты;
 * правильность и балл считает сервер (ТЗ, 4.3, 4.4). Пустой `optionIds` —
 * вопрос без ответа.
 */
export const submitAttemptBodySchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string(),
      optionIds: z.array(z.string()).max(QUESTION_OPTIONS_MAX_COUNT),
    }),
  ),
});
export type SubmitAttemptBody = z.infer<typeof submitAttemptBodySchema>;

/**
 * Разбор одного вопроса после отправки попытки (ТЗ, 18.2). Строится из снимка
 * вопросов попытки (8.7): правильность известна серверу и раскрывается только
 * после отправки (10.3), в ответе на саму попытку.
 */
export const attemptReviewOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  isCorrect: z.boolean(),
  isSelected: z.boolean(),
});
export type AttemptReviewOption = z.infer<typeof attemptReviewOptionSchema>;

export const attemptReviewQuestionSchema = z.object({
  questionId: z.string(),
  text: z.string(),
  type: questionTypeSchema,
  order: z.number().int(),
  isCorrect: z.boolean(),
  options: z.array(attemptReviewOptionSchema),
});
export type AttemptReviewQuestion = z.infer<typeof attemptReviewQuestionSchema>;

/** Результат попытки с подробным разбором ответов (ТЗ, 18.2). */
export const attemptResultSchema = z.object({
  review: z.array(attemptReviewQuestionSchema),
  id: objectIdSchema,
  testId: objectIdSchema,
  courseId: objectIdSchema,
  lessonId: objectIdSchema.nullable(),
  score: percentSchema,
  passingScore: percentSchema,
  passed: z.boolean(),
  correctCount: z.number().int().min(0),
  totalCount: z.number().int().min(0),
  attemptNumber: z.number().int().min(1),
  submittedAt: isoDateTimeSchema,
});
export type AttemptResult = z.infer<typeof attemptResultSchema>;

/** Строка истории попыток в статистике (ТЗ, 7.16). */
export const testAttemptSummarySchema = z.object({
  id: objectIdSchema,
  testId: objectIdSchema,
  testTitle: z.string(),
  courseId: objectIdSchema,
  courseTitle: z.string(),
  score: percentSchema,
  passed: z.boolean(),
  attemptNumber: z.number().int().min(1),
  submittedAt: isoDateTimeSchema,
  /**
   * ТЗ 4.4 требует показывать «последнюю и лучшую попытки». Обе метки живут на
   * строке, а не в двух отдельных массивах: когда лучшая попытка и есть
   * последняя, это одна строка с обоими признаками, и клиенту не приходится
   * искать её в двух списках, чтобы не нарисовать дважды.
   */
  isBest: z.boolean(),
  isLast: z.boolean(),
});
export type TestAttemptSummary = z.infer<typeof testAttemptSummarySchema>;
