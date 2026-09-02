import type { Types } from "mongoose";

import {
  courseNotAssignedError,
  courseNotStudiableError,
  isAssignmentEffective,
  isCourseReadable,
  isCourseStudiable,
} from "./accessRules.js";
import { AppError } from "../errors/AppError.js";
import {
  Course,
  COURSE_AUTHOR_FIELDS,
  type CourseDocumentWithAuthor,
} from "../models/Course.js";
import {
  CourseAssignment,
  type CourseAssignmentDocument,
} from "../models/CourseAssignment.js";

/**
 * Loads a course the learner was assigned. The counterpart of
 * `courses/courseAccess.ts`, which answers a different question: that one asks
 * who owns the course, this one asks who was given it.
 *
 * The assignment is checked before the course is read, so a course nobody
 * assigned answers the same way whether or not it exists — an identifier
 * guessed by hand tells the learner nothing.
 */

export type AssignedCourse = {
  course: CourseDocumentWithAuthor;
  assignment: CourseAssignmentDocument;
};

async function loadAssignedCourse(
  courseId: string | Types.ObjectId,
  userId: string,
): Promise<AssignedCourse> {
  const assignment = await CourseAssignment.findOne({
    userId,
    courseId,
    status: { $in: ["active", "completed"] },
  });

  if (!assignment || !isAssignmentEffective(assignment.status)) {
    throw courseNotAssignedError();
  }

  const course = await Course.findById(courseId).populate<{
    authorId: { _id: Types.ObjectId; name: string };
  }>("authorId", COURSE_AUTHOR_FIELDS);

  if (!course) {
    throw new AppError(404, "not_found", "Курс не найден");
  }

  return { course, assignment };
}

/** Opening the course or one of its lessons: published or archived (7.4). */
export async function loadReadableAssignedCourse(
  courseId: string | Types.ObjectId,
  userId: string,
): Promise<AssignedCourse> {
  const assigned = await loadAssignedCourse(courseId, userId);

  if (!isCourseReadable(assigned.course.status)) {
    throw courseNotAssignedError();
  }

  return assigned;
}

/** Starting or completing a lesson: the course has to be published (4.2). */
export async function loadStudiableAssignedCourse(
  courseId: string | Types.ObjectId,
  userId: string,
): Promise<AssignedCourse> {
  const assigned = await loadAssignedCourse(courseId, userId);

  if (!isCourseStudiable(assigned.course.status)) {
    throw courseNotStudiableError(assigned.course.status);
  }

  return assigned;
}
