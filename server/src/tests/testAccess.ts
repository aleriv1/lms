import type { PublicUser } from "@lms/shared";

import { loadOwnedCourse } from "../courses/courseAccess.js";
import { AppError } from "../errors/AppError.js";
import { Test, type TestDocument } from "../models/Test.js";
import type { CourseDocumentWithAuthor } from "../models/Course.js";

type CourseTest = {
  course: CourseDocumentWithAuthor;
  test: TestDocument;
};

/**
 * Loads a test addressed through its course. Rights are the course's own
 * (specification 3.2), so `loadOwnedCourse` answers first: a foreign course is
 * already 403 there, and 404 is left for a test missing from an owned course.
 */
export async function loadCourseTest(
  courseId: string,
  testId: string,
  user: PublicUser,
): Promise<CourseTest> {
  const course = await loadOwnedCourse(courseId, user);
  const test = await Test.findOne({ _id: testId, courseId: course._id });

  if (!test) {
    throw new AppError(404, "not_found", "Тест не найден");
  }

  return { course, test };
}

/**
 * Loads a test by its own identifier: the editing screen is routed as
 * `/manage/tests/:testId/edit` (specification 6) and has no course in the URL.
 * The test is found first, then its course decides the rights — the same order
 * `loadLessonById` uses.
 */
export async function loadTestById(
  testId: string,
  user: PublicUser,
): Promise<CourseTest> {
  const test = await Test.findById(testId);

  if (!test) {
    throw new AppError(404, "not_found", "Тест не найден");
  }

  const course = await loadOwnedCourse(test.courseId.toString(), user);

  return { course, test };
}
