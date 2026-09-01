import type {
  Course,
  CourseDetail,
  CourseListItem,
  CoursesQuery,
  CreateCourseBody,
  ListResponse,
  UpdateCourseBody,
} from "@lms/shared";

import { apiRequest } from "../../api/client";
import { toSearchParams } from "./coursesQueryParams";

export function requestCourses(
  query: CoursesQuery,
): Promise<ListResponse<CourseListItem>> {
  return apiRequest(`/courses?${toSearchParams(query).toString()}`);
}

export function requestCourse(courseId: string): Promise<CourseDetail> {
  return apiRequest(`/courses/${courseId}`);
}

export function requestCourseCreate(body: CreateCourseBody): Promise<Course> {
  return apiRequest("/courses", { method: "POST", body });
}

export function requestCourseUpdate(
  courseId: string,
  body: UpdateCourseBody,
): Promise<Course> {
  return apiRequest(`/courses/${courseId}`, { method: "PATCH", body });
}

export function requestCourseDelete(courseId: string): Promise<void> {
  return apiRequest(`/courses/${courseId}`, { method: "DELETE" });
}

export function requestCoursePublish(courseId: string): Promise<Course> {
  return apiRequest(`/courses/${courseId}/publish`, { method: "POST" });
}

export function requestCourseArchive(courseId: string): Promise<Course> {
  return apiRequest(`/courses/${courseId}/archive`, { method: "POST" });
}
