import {
  COURSE_AUDIENCES,
  COURSE_STATUSES,
  type Course as CourseResponse,
  type CourseAudience,
  type CourseListItem,
  type CourseStatus,
} from "@lms/shared";
import { type HydratedDocument, model, Schema, type Types } from "mongoose";

export type CourseAttributes = {
  title: string;
  category: string;
  audience: CourseAudience;
  shortDescription: string;
  description: string;
  coverUrl: string | null;
  authorId: Types.ObjectId;
  status: CourseStatus;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CourseDocument = HydratedDocument<CourseAttributes>;

type PopulatedAuthor = { _id: Types.ObjectId; name: string };

type CourseAttributesWithAuthor = Omit<CourseAttributes, "authorId"> & {
  authorId: PopulatedAuthor;
};

/** A course whose author was populated with the two fields `userRefSchema` needs. */
export type CourseWithAuthor = CourseAttributesWithAuthor & {
  _id: Types.ObjectId;
};

export type CourseDocumentWithAuthor =
  HydratedDocument<CourseAttributesWithAuthor>;

export const COURSE_AUTHOR_FIELDS = "name";

const courseSchema = new Schema<CourseAttributes>(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    audience: {
      type: String,
      required: true,
      enum: COURSE_AUDIENCES,
    },
    shortDescription: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    coverUrl: { type: String, default: null },
    authorId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    status: {
      type: String,
      enum: COURSE_STATUSES,
      default: "draft",
    },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

courseSchema.index({ authorId: 1, updatedAt: -1 });
courseSchema.index({ status: 1, updatedAt: -1 });
courseSchema.index({ category: 1 });

export const Course = model<CourseAttributes>("Course", courseSchema);

export function toCourse(
  course: CourseWithAuthor,
  lessonsCount: number,
): CourseResponse {
  return {
    id: course._id.toString(),
    title: course.title,
    category: course.category,
    audience: course.audience,
    shortDescription: course.shortDescription,
    description: course.description,
    coverUrl: course.coverUrl,
    author: {
      id: course.authorId._id.toString(),
      name: course.authorId.name,
    },
    status: course.status,
    publishedAt: course.publishedAt?.toISOString() ?? null,
    lessonsCount,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
  };
}

export function toCourseListItem(
  course: CourseWithAuthor,
  lessonsCount: number,
): CourseListItem {
  const mappedCourse = toCourse(course, lessonsCount);
  return {
    id: mappedCourse.id,
    title: mappedCourse.title,
    category: mappedCourse.category,
    audience: mappedCourse.audience,
    shortDescription: mappedCourse.shortDescription,
    coverUrl: mappedCourse.coverUrl,
    author: mappedCourse.author,
    status: mappedCourse.status,
    publishedAt: mappedCourse.publishedAt,
    lessonsCount: mappedCourse.lessonsCount,
    createdAt: mappedCourse.createdAt,
    updatedAt: mappedCourse.updatedAt,
  };
}
