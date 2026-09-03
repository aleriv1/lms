import type { Types } from "mongoose";

import { isDuplicateKeyError } from "../db/duplicateKey.js";
import type { LessonDocument } from "../models/Lesson.js";
import { LessonProgress } from "../models/LessonProgress.js";

/**
 * Completes a lesson whether or not it was started first. Two callers since
 * slice 08: the learner's own "finish the lesson" action, and a passing attempt
 * on the lesson's test — specification 7.7 has a passing result unlock what
 * follows, and a lesson closed by a test is closed by passing it.
 */
export async function completeLesson(
  userId: Types.ObjectId,
  lesson: LessonDocument,
): Promise<void> {
  const completedAt = new Date();
  const progress = await LessonProgress.findOne({
    userId,
    lessonId: lesson._id,
  });

  if (progress) {
    progress.status = "completed";
    progress.completedAt = completedAt;
    await progress.save();
    return;
  }

  try {
    await LessonProgress.create({
      userId,
      courseId: lesson.courseId,
      lessonId: lesson._id,
      status: "completed",
      startedAt: completedAt,
      completedAt,
    });
  } catch (error) {
    // A `start` that arrived in between created the row; completing it is the
    // same write either way.
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    await LessonProgress.updateOne(
      { userId, lessonId: lesson._id },
      { $set: { status: "completed", completedAt } },
    );
  }
}
