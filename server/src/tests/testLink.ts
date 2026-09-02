import type { FilterQuery, Types } from "mongoose";

import { AppError } from "../errors/AppError.js";
import { Lesson } from "../models/Lesson.js";
import { Test, type TestAttributes } from "../models/Test.js";

/**
 * The link between a lesson and a test is stored in `Test.lessonId` and nowhere
 * else (specification 8.4; 8.3 gives the lesson no such field). Both screens
 * write it — the test picks a lesson (7.17), the lesson picks a test (7.13) —
 * under two rules: a lesson has at most one test, and a course has at most one
 * final test. Nothing here resolves a conflict by moving somebody else's link:
 * reattaching a test is a decision of the author, not a side effect of saving
 * the form next door.
 */

const LESSON_TAKEN_MESSAGE = "У урока уже есть тест";
const TEST_TAKEN_MESSAGE = "Тест уже привязан к другому уроку";

export function lessonTestConflictError(): AppError {
  return new AppError(409, "conflict", LESSON_TAKEN_MESSAGE);
}

/** The test side: is the link this test asks for free? */
export async function ensureTestLinkIsFree(
  courseId: Types.ObjectId,
  lessonId: string | null,
  exceptTestId?: Types.ObjectId,
): Promise<void> {
  const filter: FilterQuery<TestAttributes> = { lessonId };

  if (lessonId === null) {
    // Specification 4.2 counts a course as finished when "the final test, if
    // there is one, is passed" — with two of them the condition has no meaning.
    filter.courseId = courseId;
  } else {
    const lesson = await Lesson.exists({ _id: lessonId, courseId });

    if (!lesson) {
      throw new AppError(404, "not_found", "Урок не найден");
    }
  }

  if (exceptTestId) {
    filter._id = { $ne: exceptTestId };
  }

  if (await Test.exists(filter)) {
    throw lessonId === null
      ? new AppError(409, "conflict", "У курса уже есть итоговый тест")
      : lessonTestConflictError();
  }
}

/**
 * The lesson side, used when a lesson is created: the test has to exist in this
 * course and be free before the lesson it will be attached to is written.
 */
export async function ensureTestCanBeAttached(
  courseId: Types.ObjectId,
  testId: string,
): Promise<void> {
  const test = await Test.findOne({ _id: testId, courseId }).select("lessonId");

  if (!test) {
    throw new AppError(404, "not_found", "Тест не найден");
  }

  if (test.lessonId) {
    throw new AppError(409, "conflict", TEST_TAKEN_MESSAGE);
  }
}

/** The lesson side: attach a test of this course to this lesson. */
export async function attachTestToLesson(
  courseId: Types.ObjectId,
  testId: string,
  lessonId: Types.ObjectId,
): Promise<void> {
  const test = await Test.findOne({ _id: testId, courseId });

  if (!test) {
    throw new AppError(404, "not_found", "Тест не найден");
  }

  if (test.lessonId?.toString() === lessonId.toString()) {
    return;
  }

  if (test.lessonId) {
    throw new AppError(409, "conflict", TEST_TAKEN_MESSAGE);
  }

  if (await Test.exists({ lessonId, _id: { $ne: test._id } })) {
    throw lessonTestConflictError();
  }

  test.lessonId = lessonId;
  await test.save();
}

/** The `testId` a lesson reports is derived from the test that points at it. */
export async function findLinkedTestId(
  lessonId: Types.ObjectId,
): Promise<string | null> {
  const test = await Test.findOne({ lessonId }).select("_id");

  return test ? test._id.toString() : null;
}

/**
 * Deleting a lesson with a test is refused rather than resolved: deleting the
 * test along with it would cost the author work without warning, and turning it
 * into the final test of the course would change when the course counts as
 * finished. Both would decide something the author did not.
 */
export async function assertLessonHasNoTest(
  lessonId: Types.ObjectId,
): Promise<void> {
  if (await Test.exists({ lessonId })) {
    throw new AppError(
      409,
      "conflict",
      "Сначала удалите или отвяжите тест урока",
    );
  }
}
