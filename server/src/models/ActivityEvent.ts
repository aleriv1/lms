import { ACTIVITY_EVENT_TYPES, type ActivityEventType } from "@lms/shared";
import { type HydratedDocument, model, Schema, type Types } from "mongoose";

export type ActivityEventAttributes = {
  userId: Types.ObjectId;
  courseId: Types.ObjectId | null;
  lessonId: Types.ObjectId | null;
  type: ActivityEventType;
  metadata: { courseTitle: string | null; lessonTitle: string | null };
  createdAt: Date;
};

export type ActivityEventDocument = HydratedDocument<ActivityEventAttributes>;

const metadataSchema = new Schema<ActivityEventAttributes["metadata"]>(
  {
    courseTitle: { type: String, default: null },
    lessonTitle: { type: String, default: null },
  },
  { _id: false },
);

const activityEventSchema = new Schema<ActivityEventAttributes>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    courseId: { type: Schema.Types.ObjectId, default: null, ref: "Course" },
    lessonId: { type: Schema.Types.ObjectId, default: null, ref: "Lesson" },
    type: { type: String, enum: ACTIVITY_EVENT_TYPES, required: true },
    metadata: { type: metadataSchema, required: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

// Serves the learner's recent feed and the four-week activity aggregation.
activityEventSchema.index({ userId: 1, createdAt: -1 });

export const ActivityEvent = model<ActivityEventAttributes>(
  "ActivityEvent",
  activityEventSchema,
);
