import {
  ASSIGNMENT_STATUSES,
  type Assignment,
  type AssignmentStatus,
  type CourseStatus,
} from "@lms/shared";
import { type HydratedDocument, model, Schema, type Types } from "mongoose";

export type CourseAssignmentAttributes = {
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  assignedBy: Types.ObjectId;
  status: AssignmentStatus;
  assignedAt: Date;
  revokedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CourseAssignmentDocument =
  HydratedDocument<CourseAssignmentAttributes>;

type PopulatedCourse = {
  _id: Types.ObjectId;
  title: string;
  status: CourseStatus;
};

type PopulatedAssigner = { _id: Types.ObjectId; name: string };

type PopulatedAttributes = Omit<
  CourseAssignmentAttributes,
  "courseId" | "assignedBy"
> & {
  courseId: PopulatedCourse;
  assignedBy: PopulatedAssigner;
};

/** An assignment whose course and assigner carry the fields the contract needs. */
export type PopulatedCourseAssignment = PopulatedAttributes & {
  _id: Types.ObjectId;
};

export type PopulatedCourseAssignmentDocument =
  HydratedDocument<PopulatedAttributes>;

/** Exactly the fields `assignmentSchema` reads — nothing else leaves the server. */
export const ASSIGNMENT_COURSE_FIELDS = "title status";
export const ASSIGNMENT_ASSIGNER_FIELDS = "name";

const courseAssignmentSchema = new Schema<CourseAssignmentAttributes>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    courseId: { type: Schema.Types.ObjectId, required: true, ref: "Course" },
    assignedBy: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    status: {
      type: String,
      enum: ASSIGNMENT_STATUSES,
      default: "active",
    },
    // Specification 8.5 names `assignedAt` as part of the entity, so it is
    // stored explicitly rather than read off the `timestamps` pair.
    assignedAt: { type: Date, default: Date.now },
    revokedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

courseAssignmentSchema.index({ userId: 1, assignedAt: -1 });
courseAssignmentSchema.index({ courseId: 1, status: 1 });

/**
 * Specification 8.5: at most one active assignment per user and course.
 * Revoked and completed rows stay, so the uniqueness is partial. The condition
 * is an equality against a non-empty string, which MongoDB indexes normally —
 * unlike the `lessonId: null` condition that made the same trick unreliable for
 * the final test of a course.
 */
courseAssignmentSchema.index(
  { userId: 1, courseId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);

export const CourseAssignment = model<CourseAssignmentAttributes>(
  "CourseAssignment",
  courseAssignmentSchema,
);

/**
 * `progressPercent` is `0` for every assignment in this slice, and that is the
 * true value rather than a placeholder: `LessonProgress` arrives in slice 07,
 * so no lesson has been completed by anyone yet. Slice 07 replaces the constant
 * with the computation of specification 4.3.
 */
export function toAssignment(
  assignment: PopulatedCourseAssignment,
  progressPercent = 0,
): Assignment {
  return {
    id: assignment._id.toString(),
    userId: assignment.userId.toString(),
    course: {
      id: assignment.courseId._id.toString(),
      title: assignment.courseId.title,
      status: assignment.courseId.status,
    },
    assignedBy: {
      id: assignment.assignedBy._id.toString(),
      name: assignment.assignedBy.name,
    },
    status: assignment.status,
    progressPercent,
    assignedAt: assignment.assignedAt.toISOString(),
    revokedAt: assignment.revokedAt?.toISOString() ?? null,
    completedAt: assignment.completedAt?.toISOString() ?? null,
  };
}
