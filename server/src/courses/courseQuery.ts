import type { CoursesQuery } from "@lms/shared";
import type { FilterQuery, SortOrder } from "mongoose";

import type { CourseAttributes } from "../models/Course.js";

/** Escapes every RegExp metacharacter, so user input is matched literally. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Builds the MongoDB filter for `GET /courses` from the validated query. */
export function buildCourseFilter(
  query: CoursesQuery,
): FilterQuery<CourseAttributes> {
  const filter: FilterQuery<CourseAttributes> = {};

  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = [
      { title: pattern },
      { shortDescription: pattern },
    ];
  }

  if (query.category) {
    filter.category = new RegExp(escapeRegExp(query.category), "i");
  }

  if (query.audience) {
    filter.audience = query.audience;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.authorId) {
    filter.authorId = query.authorId;
  }

  return filter;
}

/** Sort by the requested field, with `_id` as a stable tiebreaker. */
export function buildCourseSort(
  query: CoursesQuery,
): Record<string, SortOrder> {
  const order = query.sortOrder === "asc" ? 1 : -1;
  return { [query.sortBy]: order, _id: order };
}
