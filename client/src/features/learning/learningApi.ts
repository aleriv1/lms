import {
  attemptResultSchema,
  learnerTestSchema,
  learningCourseSchema,
  learningLessonSchema,
  learningOverviewSchema,
  lessonProgressResponseSchema,
  type AttemptResult,
  type LearnerTest,
  type LearningCourse,
  type LearningLesson,
  type LearningOverview,
  type LessonProgressResponse,
  type SubmitAttemptBody,
} from "@lms/shared";

import { apiRequest } from "../../api/client";

export async function requestLearnerTest(testId: string): Promise<LearnerTest> {
  return learnerTestSchema.parse(await apiRequest(`/learning/tests/${testId}`));
}

export async function requestAttemptSubmit(
  testId: string,
  body: SubmitAttemptBody,
): Promise<AttemptResult> {
  return attemptResultSchema.parse(
    await apiRequest(`/learning/tests/${testId}/attempts`, {
      method: "POST",
      body,
    }),
  );
}

export async function requestLearningOverview(): Promise<LearningOverview> {
  return learningOverviewSchema.parse(await apiRequest("/learning/me"));
}

export async function requestLearningCourse(
  courseId: string,
): Promise<LearningCourse> {
  return learningCourseSchema.parse(
    await apiRequest(`/learning/courses/${courseId}`),
  );
}

export async function requestLearningLesson(
  courseId: string,
  lessonId: string,
): Promise<LearningLesson> {
  return learningLessonSchema.parse(
    await apiRequest(`/learning/courses/${courseId}/lessons/${lessonId}`),
  );
}

export async function requestLessonStart(
  lessonId: string,
): Promise<LessonProgressResponse> {
  return lessonProgressResponseSchema.parse(
    await apiRequest(`/learning/lessons/${lessonId}/start`, { method: "POST" }),
  );
}

export async function requestLessonComplete(
  lessonId: string,
): Promise<LessonProgressResponse> {
  return lessonProgressResponseSchema.parse(
    await apiRequest(`/learning/lessons/${lessonId}/complete`, {
      method: "POST",
    }),
  );
}
