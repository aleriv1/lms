import {
  LESSON_PROGRESS_STATUSES,
  type LessonProgressStatus,
} from "@lms/shared";
import { type HydratedDocument, model, Schema, type Types } from "mongoose";

export type LessonProgressAttributes = {
  userId: Types.ObjectId;
  courseId: Types.ObjectId;
  lessonId: Types.ObjectId;
  status: LessonProgressStatus;
  startedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type LessonProgressDocument = HydratedDocument<LessonProgressAttributes>;

const lessonProgressSchema = new Schema<LessonProgressAttributes>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    // Specification 8.6 names the course in the entity. It repeats
    // `lesson.courseId` on purpose: progress is counted per course on every
    // learning screen, and without it each count would need a join. A lesson
    // never moves between courses — no route in any slice moves one.
    courseId: { type: Schema.Types.ObjectId, required: true, ref: "Course" },
    lessonId: { type: Schema.Types.ObjectId, required: true, ref: "Lesson" },
    status: { type: String, enum: LESSON_PROGRESS_STATUSES, required: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

/**
 * One row per lesson and learner. This index is the only thing standing between
 * two simultaneous `start` requests and two rows for the same lesson, so the
 * handler catches its duplicate-key error rather than trusting its own check.
 */
lessonProgressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });
// Serves the progress of one course and the last activity on its card.
lessonProgressSchema.index({ userId: 1, courseId: 1 });

export const LessonProgress = model<LessonProgressAttributes>(
  "LessonProgress",
  lessonProgressSchema,
);

/**
 * The collection stores only `in_progress` and `completed`. The third value of
 * the enum, `not_started`, is the absence of a row: it is what a lesson reports
 * before the learner has touched it. Writing it would make "no row" and "a row
 * saying nothing happened" two ways to say the same thing, and every count
 * would then have to be written twice.
 */
export type StoredLessonProgressStatus = Exclude<
  LessonProgressStatus,
  "not_started"
>;
