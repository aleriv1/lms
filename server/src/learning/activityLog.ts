import type { ActivityEventType } from "@lms/shared";
import type { Types } from "mongoose";

import { ActivityEvent } from "../models/ActivityEvent.js";

export type ActivityTarget = { id: Types.ObjectId; title: string } | null;

export async function recordActivity(input: {
  userId: Types.ObjectId;
  type: ActivityEventType;
  course: ActivityTarget;
  lesson: ActivityTarget;
  createdAt?: Date;
}): Promise<void> {
  // The action already succeeded; a failed log must not fail its response.
  try {
    await ActivityEvent.create({
      userId: input.userId,
      type: input.type,
      courseId: input.course?.id ?? null,
      lessonId: input.lesson?.id ?? null,
      metadata: {
        courseTitle: input.course?.title ?? null,
        lessonTitle: input.lesson?.title ?? null,
      },
      createdAt: input.createdAt,
    });
  } catch (error) {
    console.error("activity event not recorded:", error);
  }
}
