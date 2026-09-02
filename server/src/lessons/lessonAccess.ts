import type { PublicUser } from "@lms/shared";

import { loadOwnedCourse } from "../courses/courseAccess.js";
import { AppError } from "../errors/AppError.js";
import { Lesson, type LessonDocument } from "../models/Lesson.js";
import type { CourseDocumentWithAuthor } from "../models/Course.js";

type CourseLesson = {
  course: CourseDocumentWithAuthor;
  lesson: LessonDocument;
};

/**
 * Loads a lesson addressed through its course. Rights are the course's own
 * (specification 3.2), so `loadOwnedCourse` answers first: a foreign course is
 * already 403 there, and 404 is left for a lesson missing from an owned course.
 */
export async function loadCourseLesson(
  courseId: string,
  lessonId: string,
  user: PublicUser,
): Promise<CourseLesson> {
  const course = await loadOwnedCourse(courseId, user);
  const lesson = await Lesson.findOne({ _id: lessonId, courseId: course._id });

  if (!lesson) {
    throw new AppError(404, "not_found", "Урок не найден");
  }

  return { course, lesson };
}

/**
 * Loads a lesson by its own identifier: the editing screen is routed as
 * `/manage/lessons/:lessonId/edit` (specification 6) and has no course in the
 * URL. The lesson is found first, then its course decides the rights — so a
 * teacher learns about somebody else's lesson exactly as about the course.
 */
export async function loadLessonById(
  lessonId: string,
  user: PublicUser,
): Promise<CourseLesson> {
  const lesson = await Lesson.findById(lessonId);

  if (!lesson) {
    throw new AppError(404, "not_found", "Урок не найден");
  }

  const course = await loadOwnedCourse(lesson.courseId.toString(), user);

  return { course, lesson };
}
