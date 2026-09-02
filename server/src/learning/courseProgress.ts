import type { LessonProgressStatus } from "@lms/shared";
import type { Types } from "mongoose";

import {
  computeLessonStates,
  computeProgressPercent,
  countRequiredLessons,
  findNextLessonId,
  type LearnerLessonState,
  type RequiredLessonCount,
} from "./lessonStates.js";
import { Lesson, type LessonRecord } from "../models/Lesson.js";
import { LessonProgress } from "../models/LessonProgress.js";

/**
 * The database side of the progress computation. Every read here is bounded by
 * the courses it was asked about and never grows with them: no screen may issue
 * a query per course or per lesson (specification 11.2).
 *
 * Progress is keyed by the pair `userId + courseId` and not by the assignment,
 * because specification 8.6 gives `LessonProgress` no assignment. That is what
 * makes "progress is restored on a repeated assignment" (4.3) free: it was
 * never lost.
 */

/** Counts of required published lessons per course, for one learner. */
export async function computeCourseProgress(
  userId: Types.ObjectId,
  courseIds: Types.ObjectId[],
): Promise<Map<string, RequiredLessonCount>> {
  const counts = new Map<string, RequiredLessonCount>(
    courseIds.map((courseId) => [
      courseId.toString(),
      { completed: 0, total: 0 },
    ]),
  );

  if (courseIds.length === 0) {
    return counts;
  }

  const lessons = await Lesson.find({
    courseId: { $in: courseIds },
    status: "published",
    isRequired: true,
  }).select("courseId");

  for (const lesson of lessons) {
    const count = counts.get(lesson.courseId.toString());
    if (count) {
      count.total += 1;
    }
  }

  const completed = await LessonProgress.find({
    userId,
    lessonId: { $in: lessons.map((lesson) => lesson._id) },
    status: "completed",
  }).select("courseId");

  for (const progress of completed) {
    const count = counts.get(progress.courseId.toString());
    if (count) {
      count.completed += 1;
    }
  }

  return counts;
}

/** The last time the learner touched anything in each of these courses. */
export async function findLastActivityByCourse(
  userId: Types.ObjectId,
  courseIds: Types.ObjectId[],
): Promise<Map<string, Date>> {
  if (courseIds.length === 0) {
    return new Map();
  }

  const rows = await LessonProgress.aggregate<{
    _id: Types.ObjectId;
    lastActivityAt: Date;
  }>([
    { $match: { userId, courseId: { $in: courseIds } } },
    { $group: { _id: "$courseId", lastActivityAt: { $max: "$updatedAt" } } },
  ]);

  return new Map(rows.map((row) => [row._id.toString(), row.lastActivityAt]));
}

/**
 * Specification 7.4: the total learning time is the sum of the durations of the
 * completed lessons. Without a qualifier — a revoked assignment does not undo
 * the time that was spent, so the figure covers everything the learner has
 * finished.
 */
export async function sumCompletedLessonMinutes(
  userId: Types.ObjectId,
): Promise<number> {
  const rows = await LessonProgress.aggregate<{ total: number }>([
    { $match: { userId, status: "completed" } },
    {
      $lookup: {
        from: Lesson.collection.name,
        localField: "lessonId",
        foreignField: "_id",
        as: "lesson",
      },
    },
    { $unwind: "$lesson" },
    { $group: { _id: null, total: { $sum: "$lesson.durationMinutes" } } },
  ]);

  return rows[0]?.total ?? 0;
}

export type CourseLearningState = {
  /** Published lessons of the course, in their own order. */
  lessons: LessonRecord[];
  states: LearnerLessonState[];
  stateByLessonId: Map<string, LearnerLessonState>;
  required: RequiredLessonCount;
  progressPercent: number;
  nextLessonId: string | null;
};

/**
 * Everything the three learning screens need about one course: the published
 * lessons, the state of each of them and the progress they add up to. Two
 * queries, whatever the size of the course.
 */
export async function loadCourseLearningState(
  userId: Types.ObjectId,
  courseId: Types.ObjectId,
): Promise<CourseLearningState> {
  const [lessons, progress] = await Promise.all([
    Lesson.find({ courseId, status: "published" }).sort({ order: 1 }),
    LessonProgress.find({ userId, courseId }).select("lessonId status"),
  ]);

  const statusByLessonId = new Map<string, LessonProgressStatus>(
    progress.map((row) => [row.lessonId.toString(), row.status]),
  );

  const learnerLessons = lessons.map((lesson) => ({
    id: lesson._id.toString(),
    order: lesson.order,
    isRequired: lesson.isRequired,
    progressStatus:
      statusByLessonId.get(lesson._id.toString()) ?? "not_started",
  }));

  const states = computeLessonStates(learnerLessons);
  const required = countRequiredLessons(learnerLessons);

  return {
    lessons,
    states,
    stateByLessonId: new Map(states.map((state) => [state.id, state])),
    required,
    progressPercent: computeProgressPercent(required),
    nextLessonId: findNextLessonId(states),
  };
}
