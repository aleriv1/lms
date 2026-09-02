import {
  adminUserDetailSchema,
  adminUserListItemSchema,
  adminUpdateUserBodySchema,
  adminUsersQuerySchema,
  createListResponseSchema,
  objectIdSchema,
  type AdminUpdateUserBody,
  type AdminUserDetail,
  type AdminUsersQuery,
} from "@lms/shared";
import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";

import { userAssignmentsRouter } from "./userAssignments.js";
import { collectSelfModificationIssues } from "../admin/selfModification.js";
import { buildUserFilter, buildUserSort } from "../admin/userQuery.js";
import { AppError } from "../errors/AppError.js";
import { computeCourseProgress } from "../learning/courseProgress.js";
import { computeProgressPercent } from "../learning/lessonStates.js";
import {
  getAuthenticatedUser,
  requireAuth,
} from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { validate } from "../middleware/validate.js";
import {
  ASSIGNMENT_ASSIGNER_FIELDS,
  ASSIGNMENT_COURSE_FIELDS,
  CourseAssignment,
  toAssignment,
  type PopulatedCourseAssignment,
} from "../models/CourseAssignment.js";
import { toPublicUser, User, type UserDocument } from "../models/User.js";

export const adminUsersRouter = Router();

const userParamsSchema = z.object({ userId: objectIdSchema });

adminUsersRouter.use(requireAuth, requireRole("admin"));

// Mounted after the role check so the assignment routes inherit it.
adminUsersRouter.use("/:userId/assignments", userAssignmentsRouter);

/** One aggregation over the users of the current page, not the collection. */
async function countActiveAssignmentsPerUser(
  userIds: Types.ObjectId[],
): Promise<Map<string, number>> {
  const counts = await CourseAssignment.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    { $match: { userId: { $in: userIds }, status: "active" } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
  ]);

  return new Map(counts.map((entry) => [entry._id.toString(), entry.count]));
}

/**
 * The card of specification 7.14 shows the fields and the assignments together,
 * so both reads and the update answer with the whole card: the client replaces
 * it instead of refetching.
 */
async function buildAdminUserDetail(
  user: UserDocument,
): Promise<AdminUserDetail> {
  const assignments = await CourseAssignment.find({ userId: user._id })
    .sort({ assignedAt: -1, _id: -1 })
    .populate<{ courseId: PopulatedCourseAssignment["courseId"] }>(
      "courseId",
      ASSIGNMENT_COURSE_FIELDS,
    )
    .populate<{ assignedBy: PopulatedCourseAssignment["assignedBy"] }>(
      "assignedBy",
      ASSIGNMENT_ASSIGNER_FIELDS,
    );

  // One pass over the courses of this card, not a query per assignment.
  const progress = await computeCourseProgress(
    user._id,
    assignments.map((assignment) => assignment.courseId._id),
  );

  return adminUserDetailSchema.parse({
    ...toPublicUser(user),
    assignments: assignments.map((assignment) =>
      toAssignment(
        assignment,
        computeProgressPercent(
          progress.get(assignment.courseId._id.toString()) ?? {
            completed: 0,
            total: 0,
          },
        ),
      ),
    ),
  });
}

async function loadUser(userId: string): Promise<UserDocument> {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(404, "not_found", "Пользователь не найден");
  }

  return user;
}

adminUsersRouter.get(
  "/",
  validate(adminUsersQuerySchema, "query"),
  async (request, response) => {
    const query = request.query as unknown as AdminUsersQuery;
    const filter = buildUserFilter(query);

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort(buildUserSort(query))
        .skip((query.page - 1) * query.pageSize)
        .limit(query.pageSize),
      User.countDocuments(filter),
    ]);
    const assignmentsCounts = await countActiveAssignmentsPerUser(
      users.map((user) => user._id),
    );

    response.json(
      createListResponseSchema(adminUserListItemSchema).parse({
        items: users.map((user) => ({
          ...toPublicUser(user),
          activeAssignmentsCount:
            assignmentsCounts.get(user._id.toString()) ?? 0,
        })),
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        },
      }),
    );
  },
);

adminUsersRouter.get(
  "/:userId",
  validate(userParamsSchema, "params"),
  async (request, response) => {
    const userId = request.params.userId as string;

    response.json(await buildAdminUserDetail(await loadUser(userId)));
  },
);

/**
 * Specification 7.14 lets an administrator change the name, the role, the group
 * and the status. The schema has no `email`, so a submitted one is dropped by
 * the parser and never reaches the handler: changing somebody else's login is
 * not part of the MVP.
 */
adminUsersRouter.patch(
  "/:userId",
  validate(userParamsSchema, "params"),
  validate(adminUpdateUserBodySchema),
  async (request, response) => {
    const userId = request.params.userId as string;
    const actor = getAuthenticatedUser(request);
    const body = request.body as AdminUpdateUserBody;

    const issues = collectSelfModificationIssues(actor, userId, body);
    if (issues.length > 0) {
      throw new AppError(
        422,
        "self_modification_forbidden",
        "Нельзя изменить собственные роль или статус",
        issues,
      );
    }

    const user = await loadUser(userId);
    user.name = body.name;
    user.role = body.role;
    user.groupName = body.groupName;
    user.status = body.status;
    await user.save();

    response.json(await buildAdminUserDetail(user));
  },
);
