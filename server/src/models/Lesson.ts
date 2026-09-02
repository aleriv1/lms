import {
  LESSON_STATUSES,
  type Lesson as LessonResponse,
  type LessonStatus,
  type LessonSummary,
  type ResourceLink,
} from "@lms/shared";
import { type HydratedDocument, model, Schema, type Types } from "mongoose";

export type LessonAttributes = {
  courseId: Types.ObjectId;
  title: string;
  order: number;
  content: string;
  durationMinutes: number;
  videoUrl: string | null;
  resourceLinks: ResourceLink[];
  isRequired: boolean;
  status: LessonStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type LessonDocument = HydratedDocument<LessonAttributes>;

/** A lesson as it comes back from a lean read: no document methods, plain `_id`. */
export type LessonRecord = LessonAttributes & { _id: Types.ObjectId };

const resourceLinkSchema = new Schema<ResourceLink>(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const lessonSchema = new Schema<LessonAttributes>(
  {
    courseId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "Course",
    },
    title: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    content: { type: String, required: true },
    durationMinutes: { type: Number, required: true },
    videoUrl: { type: String, default: null },
    resourceLinks: { type: [resourceLinkSchema], default: [] },
    isRequired: { type: Boolean, default: true },
    status: {
      type: String,
      enum: LESSON_STATUSES,
      default: "draft",
    },
  },
  { timestamps: true },
);

// Specification 4.2: the order of a lesson is unique within its course. Held in
// the database and not only in the handler, so a race cannot produce two lessons
// with the same number.
lessonSchema.index({ courseId: 1, order: 1 }, { unique: true });
// Serves the published-required count taken before a course is published.
lessonSchema.index({ courseId: 1, status: 1 });

export const Lesson = model<LessonAttributes>("Lesson", lessonSchema);

/**
 * `testId` is derived, not stored: specification 8.4 keeps the link in
 * `Test.lessonId`, so the caller looks it up and passes it in. The argument has
 * no default on purpose — a lesson silently reported without its test would be
 * a lie, and this way the compiler names every place that has to look.
 */
export function toLesson(
  lesson: LessonRecord,
  testId: string | null,
): LessonResponse {
  return {
    id: lesson._id.toString(),
    courseId: lesson.courseId.toString(),
    title: lesson.title,
    order: lesson.order,
    content: lesson.content,
    durationMinutes: lesson.durationMinutes,
    videoUrl: lesson.videoUrl,
    resourceLinks: lesson.resourceLinks.map((link) => ({
      title: link.title,
      url: link.url,
    })),
    isRequired: lesson.isRequired,
    status: lesson.status,
    testId,
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
  };
}

export function toLessonSummary(
  lesson: LessonRecord,
  testId: string | null,
): LessonSummary {
  return {
    id: lesson._id.toString(),
    title: lesson.title,
    order: lesson.order,
    durationMinutes: lesson.durationMinutes,
    isRequired: lesson.isRequired,
    status: lesson.status,
    testId,
  };
}
