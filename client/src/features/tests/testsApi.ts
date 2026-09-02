import type { CreateTestBody, Test, UpdateTestBody } from "@lms/shared";

import { apiRequest } from "../../api/client";

export function requestTest(testId: string): Promise<Test> {
  return apiRequest(`/tests/${testId}`);
}

export function requestTestCreate(
  courseId: string,
  body: CreateTestBody,
): Promise<Test> {
  return apiRequest(`/courses/${courseId}/tests`, { method: "POST", body });
}

export function requestTestUpdate(
  courseId: string,
  testId: string,
  body: UpdateTestBody,
): Promise<Test> {
  return apiRequest(`/courses/${courseId}/tests/${testId}`, {
    method: "PATCH",
    body,
  });
}

export function requestTestDelete(
  courseId: string,
  testId: string,
): Promise<void> {
  return apiRequest(`/courses/${courseId}/tests/${testId}`, {
    method: "DELETE",
  });
}
