import type { PublicUser } from "@lms/shared";

import { AppError } from "../errors/AppError.js";
import {
  Course,
  COURSE_AUTHOR_FIELDS,
  type CourseDocumentWithAuthor,
} from "../models/Course.js";
import type { Types } from "mongoose";

/**
 * Loads a course for an operation on that specific course and enforces
 * specification 3.2: the author or an administrator, nobody else.
 * Throws 404 `not_found` when it does not exist, 403 `forbidden` when the
 * caller is a teacher who does not own it.
 */
export async function loadOwnedCourse(
  courseId: string,
  user: PublicUser,
): Promise<CourseDocumentWithAuthor> {
  const course = await Course.findById(courseId).populate<{
    authorId: { _id: Types.ObjectId; name: string };
  }>("authorId", COURSE_AUTHOR_FIELDS);

  if (!course) {
    throw new AppError(404, "not_found", "Курс не найден");
  }

  if (user.role !== "admin" && course.authorId._id.toString() !== user.id) {
    throw new AppError(403, "forbidden", "Недостаточно прав");
  }

  return course;
}
