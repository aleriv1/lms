import type { ActivityEvent, ActivityWeek } from "@lms/shared";
import type { Types } from "mongoose";

import {
  ActivityEvent as ActivityEventModel,
  type ActivityEventDocument,
} from "../models/ActivityEvent.js";

export const RECENT_ACTIVITY_LIMIT = 10;
export const ACTIVITY_WEEK_COUNT = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function toActivityEvent(
  document: ActivityEventDocument,
): ActivityEvent {
  return {
    id: document._id.toString(),
    type: document.type,
    courseId: document.courseId?.toString() ?? null,
    lessonId: document.lessonId?.toString() ?? null,
    courseTitle: document.metadata.courseTitle,
    lessonTitle: document.metadata.lessonTitle,
    createdAt: document.createdAt.toISOString(),
  };
}

export async function loadRecentActivity(
  userId: Types.ObjectId,
): Promise<ActivityEvent[]> {
  const events = await ActivityEventModel.find({ userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(RECENT_ACTIVITY_LIMIT);
  return events.map(toActivityEvent);
}

export function startOfWeekUtc(date: Date): Date {
  const monday = new Date(date);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday;
}

export function buildActivityWeeks(
  countByWeekStart: Map<string, number>,
  now: Date,
): ActivityWeek[] {
  const currentWeek = startOfWeekUtc(now).getTime();
  return Array.from({ length: ACTIVITY_WEEK_COUNT }, (_, index) => {
    const weekStart = new Date(
      currentWeek - (ACTIVITY_WEEK_COUNT - 1 - index) * WEEK_MS,
    ).toISOString();
    return { weekStart, count: countByWeekStart.get(weekStart) ?? 0 };
  });
}

export async function loadActivityWeeks(
  userId: Types.ObjectId,
  now = new Date(),
): Promise<ActivityWeek[]> {
  const windowStart = new Date(
    startOfWeekUtc(now).getTime() - (ACTIVITY_WEEK_COUNT - 1) * WEEK_MS,
  );
  const rows = await ActivityEventModel.aggregate<{ _id: Date; count: number }>(
    [
      { $match: { userId, createdAt: { $gte: windowStart } } },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: "$createdAt",
              unit: "week",
              startOfWeek: "monday",
              timezone: "UTC",
            },
          },
          count: { $sum: 1 },
        },
      },
    ],
  );
  return buildActivityWeeks(
    new Map(rows.map((row) => [row._id.toISOString(), row.count])),
    now,
  );
}
