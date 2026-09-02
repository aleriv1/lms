import {
  assignmentSchema,
  createAssignmentBodySchema,
  objectIdSchema,
  type CreateAssignmentBody,
} from "@lms/shared";
import { Router } from "express";
import { z } from "zod";

import {
  assignmentExistsError,
  assignmentNotActiveError,
  courseNotAssignableError,
  isAssignmentRevocable,
  isCourseAssignable,
  isUserAssignable,
  userNotAssignableError,
} from "../admin/assignmentRules.js";
import { isDuplicateKeyError } from "../db/duplicateKey.js";
import { AppError } from "../errors/AppError.js";
import { getAuthenticatedUser } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { Course } from "../models/Course.js";
import {
  ASSIGNMENT_ASSIGNER_FIELDS,
  ASSIGNMENT_COURSE_FIELDS,
  CourseAssignment,
  toAssignment,
  type CourseAssignmentDocument,
  type PopulatedCourseAssignment,
} from "../models/CourseAssignment.js";
import { User } from "../models/User.js";

/** Mounted under `/admin/users/:userId/assignments`, so `userId` comes from the parent. */
export const userAssignmentsRouter = Router({ mergeParams: true });

// As in the lessons and tests routers: `validate(..., "params")` replaces
// `request.params` with the parsed object and Zod drops unknown keys, so a
// child schema has to name `userId` too or the merged parameter never reaches
// the handler.
const userParamsSchema = z.object({ userId: objectIdSchema });
const assignmentParamsSchema = z.object({
  userId: objectIdSchema,
  assignmentId: objectIdSchema,
});

/** Reloads an assignment with the two references `assignmentSchema` needs. */
async function populateAssignment(
  assignment: CourseAssignmentDocument,
): Promise<PopulatedCourseAssignment> {
  // Both paths in one call: chaining `populate` on a document loses the type of
  // the first path, and re-reading the row would be a second round trip.
  return assignment.populate<{
    courseId: PopulatedCourseAssignment["courseId"];
    assignedBy: PopulatedCourseAssignment["assignedBy"];
  }>([
    { path: "courseId", select: ASSIGNMENT_COURSE_FIELDS },
    { path: "assignedBy", select: ASSIGNMENT_ASSIGNER_FIELDS },
  ]);
}

/**
 * Specification 4.3. The order of the checks is fixed: 404 for what does not
 * exist, then 422 for the state of what was submitted, then 409 for the clash
 * with what is already stored. A 409 carries no `fields`, so answering it first
 * would hide the form errors the body also has.
 */
userAssignmentsRouter.post(
  "/",
  validate(userParamsSchema, "params"),
  validate(createAssignmentBodySchema),
  async (request, response) => {
    const userId = request.params.userId as string;
    const actor = getAuthenticatedUser(request);
    const body = request.body as CreateAssignmentBody;

    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(404, "not_found", "Пользователь не найден");
    }

    const course = await Course.findById(body.courseId);
    if (!course) {
      throw new AppError(404, "not_found", "Курс не найден");
    }

    if (!isCourseAssignable(course.status)) {
      throw courseNotAssignableError(course.status);
    }

    if (!isUserAssignable(user.status)) {
      throw userNotAssignableError(user.status);
    }

    const activeAssignment = await CourseAssignment.exists({
      userId: user._id,
      courseId: course._id,
      status: "active",
    });
    if (activeAssignment) {
      throw assignmentExistsError();
    }

    try {
      const assignment = await CourseAssignment.create({
        userId: user._id,
        courseId: course._id,
        assignedBy: actor.id,
        status: "active",
        assignedAt: new Date(),
      });

      response
        .status(201)
        .json(
          assignmentSchema.parse(
            toAssignment(await populateAssignment(assignment)),
          ),
        );
    } catch (error) {
      // The check above leaves a window open; the partial unique index closes it.
      if (isDuplicateKeyError(error)) {
        throw assignmentExistsError();
      }

      throw error;
    }
  },
);

/**
 * Revoking is not deleting: the row stays with a status and a `revokedAt` the
 * server sets, and the stored progress is untouched (specification 4.3). That
 * is why the answer carries the updated assignment instead of the `204` the
 * three real deletions in this project use — the client must not invent a
 * server-set timestamp.
 */
userAssignmentsRouter.delete(
  "/:assignmentId",
  validate(assignmentParamsSchema, "params"),
  async (request, response) => {
    const userId = request.params.userId as string;
    const assignmentId = request.params.assignmentId as string;

    // Somebody else's assignment reached by a direct link must look exactly
    // like a missing one, so the owner is part of the query, not a later check.
    const assignment = await CourseAssignment.findOne({
      _id: assignmentId,
      userId,
    });
    if (!assignment) {
      throw new AppError(404, "not_found", "Назначение не найдено");
    }

    if (!isAssignmentRevocable(assignment.status)) {
      throw assignmentNotActiveError(assignment.status);
    }

    assignment.status = "revoked";
    assignment.revokedAt = new Date();
    await assignment.save();

    response.json(
      assignmentSchema.parse(toAssignment(await populateAssignment(assignment))),
    );
  },
);
