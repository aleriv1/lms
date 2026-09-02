import { courseDetailSchema, type CourseDetail } from "@lms/shared";

import { toCourse, type CourseDocumentWithAuthor } from "../models/Course.js";
import { Lesson, toLessonSummary } from "../models/Lesson.js";
import { Test, toTestSummary } from "../models/Test.js";

/**
 * The full composition of a course: its lessons in their own order and its
 * tests. Two routes answer with it — reading a course and reordering its
 * lessons — and both need the same three reads, so it lives in one place.
 *
 * The `testId` of a lesson is derived: the link is stored in `Test.lessonId`
 * (specification 8.4), and the tests are already loaded here, so the map costs
 * nothing extra.
 */
export async function buildCourseDetail(
  course: CourseDocumentWithAuthor,
): Promise<CourseDetail> {
  const [lessons, tests] = await Promise.all([
    Lesson.find({ courseId: course._id }).sort({ order: 1 }),
    Test.find({ courseId: course._id }).sort({ createdAt: 1 }),
  ]);

  const testIdByLessonId = new Map<string, string>();
  for (const test of tests) {
    if (test.lessonId) {
      testIdByLessonId.set(test.lessonId.toString(), test._id.toString());
    }
  }

  return courseDetailSchema.parse({
    ...toCourse(course, lessons.length),
    lessons: lessons.map((lesson) =>
      toLessonSummary(
        lesson,
        testIdByLessonId.get(lesson._id.toString()) ?? null,
      ),
    ),
    tests: tests.map((test) => toTestSummary(test)),
  });
}
