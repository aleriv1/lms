import type { Types } from "mongoose";

import { hasPassedTest } from "./attemptStats.js";
import { isCourseCompleted, type RequiredLessonCount } from "./lessonStates.js";
import type { CourseAssignmentDocument } from "../models/CourseAssignment.js";
import { Test } from "../models/Test.js";

/**
 * When a course counts as finished (specification 4.3) and what that does to
 * the assignment. Two handlers reach this since slice 08: completing a lesson,
 * and submitting a passing attempt — the last thing a course needs may be
 * either the final test or a lesson closed by a test of its own.
 */

/**
 * The state of the course's final test for this learner. `null` means the
 * course has no final test, and then 4.3's condition is the lessons alone.
 * Slice 07 returned a constant `false` here, truthfully: no attempt existed.
 */
export async function findFinalTestState(
  userId: Types.ObjectId,
  courseId: Types.ObjectId,
): Promise<{ passed: boolean } | null> {
  const finalTest = await Test.findOne({ courseId, lessonId: null }).select(
    "_id",
  );

  if (!finalTest) {
    return null;
  }

  return { passed: await hasPassedTest(userId, finalTest._id) };
}

/**
 * Recomputes whether the course is finished and, if it is, closes the
 * assignment. The transition runs one way and once: the date says when the
 * training was finished, and a lesson published later lowers the percentage
 * without taking that fact back (specification 4.2 keeps stored progress).
 */
export async function settleCourseCompletion(
  userId: Types.ObjectId,
  courseId: Types.ObjectId,
  assignment: CourseAssignmentDocument,
  required: RequiredLessonCount,
): Promise<boolean> {
  const courseCompleted = isCourseCompleted(
    required,
    await findFinalTestState(userId, courseId),
  );

  if (courseCompleted && assignment.status !== "completed") {
    assignment.status = "completed";
    assignment.completedAt = new Date();
    await assignment.save();
  }

  return courseCompleted;
}
