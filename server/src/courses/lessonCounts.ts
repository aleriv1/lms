import type { Types } from "mongoose";

import { Lesson } from "../models/Lesson.js";

/**
 * How many lessons each of these courses has, in one aggregation over the
 * courses it was asked about rather than one query per course. `lessonsCount`
 * of `courseListItemSchema` counts lessons of any status: the catalogue shows
 * the composition of the course to its author, not what a learner would see.
 *
 * Two callers since slice 09 — the catalogue and the administrator's dashboard.
 */
export async function countLessonsPerCourse(
  courseIds: Types.ObjectId[],
): Promise<Map<string, number>> {
  if (courseIds.length === 0) {
    return new Map();
  }

  const counts = await Lesson.aggregate<{ _id: Types.ObjectId; count: number }>(
    [
      { $match: { courseId: { $in: courseIds } } },
      { $group: { _id: "$courseId", count: { $sum: 1 } } },
    ],
  );

  return new Map(counts.map((entry) => [entry._id.toString(), entry.count]));
}
