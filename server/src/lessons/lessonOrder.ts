import type { ReorderLessonsBody } from "@lms/shared";
import type { Types } from "mongoose";

import { AppError } from "../errors/AppError.js";
import { Lesson } from "../models/Lesson.js";

export type LessonOrderAssignment = { lessonId: string; order: number };

const ORDER_TAKEN_MESSAGE = "Этот порядковый номер уже занят в курсе";

/**
 * Specification 4.2: no two lessons of a course share a number. Checked before
 * the write for a readable 409; the unique index catches the race that stays.
 */
export async function ensureOrderIsFree(
  courseId: Types.ObjectId,
  order: number,
  exceptLessonId?: Types.ObjectId,
): Promise<void> {
  const taken = await Lesson.exists({
    courseId,
    order,
    ...(exceptLessonId ? { _id: { $ne: exceptLessonId } } : {}),
  });

  if (taken) {
    throw new AppError(409, "conflict", ORDER_TAKEN_MESSAGE);
  }
}

export function orderConflictError(): AppError {
  return new AppError(409, "conflict", ORDER_TAKEN_MESSAGE);
}

/**
 * Turns a reorder request into the final lesson-to-number pairs. The body must
 * list every lesson of the course exactly once: the write happens in two phases
 * (see `applyReorder`), and a partial list would leave the rest behind.
 */
export function planReorder(
  existingLessonIds: string[],
  requested: ReorderLessonsBody["lessons"],
): LessonOrderAssignment[] {
  const requestedIds = new Set(requested.map((entry) => entry.lessonId));

  if (
    requestedIds.size !== requested.length ||
    requestedIds.size !== existingLessonIds.length ||
    existingLessonIds.some((lessonId) => !requestedIds.has(lessonId))
  ) {
    throw new AppError(
      422,
      "unprocessable",
      "Передайте полный список уроков курса, каждый урок ровно один раз",
    );
  }

  const orders = new Set(requested.map((entry) => entry.order));
  if (orders.size !== requested.length) {
    throw new AppError(409, "conflict", "Порядковые номера не должны повторяться");
  }

  return requested.map((entry) => ({
    lessonId: entry.lessonId,
    order: entry.order,
  }));
}

/**
 * Writes the plan in two passes. Swapping two neighbours would hit the unique
 * index halfway through a single pass, so every lesson of the course is first
 * moved into negative numbers (negation is injective, so they stay unique among
 * themselves and cannot meet a positive one) and only then given its final
 * number. Transactions are not available: Mongo runs as a single container.
 */
export async function applyReorder(
  courseId: Types.ObjectId,
  plan: LessonOrderAssignment[],
): Promise<void> {
  await Lesson.bulkWrite([
    {
      updateMany: {
        filter: { courseId },
        update: { $mul: { order: -1 } },
      },
    },
  ]);

  await Lesson.bulkWrite(
    plan.map((assignment) => ({
      updateOne: {
        filter: { _id: assignment.lessonId, courseId },
        update: { $set: { order: assignment.order } },
      },
    })),
  );
}
