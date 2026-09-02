import type {
  CourseDetail,
  CreateLessonBody,
  Lesson,
  ReorderLessonsBody,
  UpdateLessonBody,
} from "@lms/shared";

import { apiRequest } from "../../api/client";

export function requestLesson(lessonId: string): Promise<Lesson> {
  return apiRequest(`/lessons/${lessonId}`);
}

export function requestLessonCreate(
  courseId: string,
  body: CreateLessonBody,
): Promise<Lesson> {
  return apiRequest(`/courses/${courseId}/lessons`, { method: "POST", body });
}

export function requestLessonUpdate(
  courseId: string,
  lessonId: string,
  body: UpdateLessonBody,
): Promise<Lesson> {
  return apiRequest(`/courses/${courseId}/lessons/${lessonId}`, {
    method: "PATCH",
    body,
  });
}

export function requestLessonDelete(
  courseId: string,
  lessonId: string,
): Promise<void> {
  return apiRequest(`/courses/${courseId}/lessons/${lessonId}`, {
    method: "DELETE",
  });
}

export function requestLessonPublish(
  courseId: string,
  lessonId: string,
): Promise<Lesson> {
  return apiRequest(`/courses/${courseId}/lessons/${lessonId}/publish`, {
    method: "POST",
  });
}

export function requestLessonUnpublish(
  courseId: string,
  lessonId: string,
): Promise<Lesson> {
  return apiRequest(`/courses/${courseId}/lessons/${lessonId}/unpublish`, {
    method: "POST",
  });
}

export function requestLessonsReorder(
  courseId: string,
  body: ReorderLessonsBody,
): Promise<CourseDetail> {
  return apiRequest(`/courses/${courseId}/lessons/reorder`, {
    method: "POST",
    body,
  });
}
