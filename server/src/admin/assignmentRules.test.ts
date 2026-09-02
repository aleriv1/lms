import {
  ASSIGNMENT_STATUSES,
  COURSE_STATUSES,
  USER_STATUSES,
} from "@lms/shared";
import { describe, expect, it } from "vitest";

import {
  assignmentNotActiveError,
  courseNotAssignableError,
  isAssignmentRevocable,
  isCourseAssignable,
  isUserAssignable,
  userNotAssignableError,
} from "./assignmentRules.js";

describe("assignment rules", () => {
  it("assigns a published course only", () => {
    expect(COURSE_STATUSES.filter(isCourseAssignable)).toEqual(["published"]);
  });

  it("assigns to an active user only", () => {
    expect(USER_STATUSES.filter(isUserAssignable)).toEqual(["active"]);
  });

  it("revokes an active assignment only", () => {
    expect(ASSIGNMENT_STATUSES.filter(isAssignmentRevocable)).toEqual([
      "active",
    ]);
  });

  it("refuses an unassignable course with 422 on the courseId field", () => {
    for (const status of ["draft", "archived"] as const) {
      const error = courseNotAssignableError(status);
      expect(error.status).toBe(422);
      expect(error.code).toBe("unprocessable");
      expect(error.fields?.map((field) => field.field)).toEqual(["courseId"]);
    }
  });

  it("refuses an unassignable user with 422 on the userId field", () => {
    for (const status of ["blocked", "archived"] as const) {
      const error = userNotAssignableError(status);
      expect(error.status).toBe(422);
      expect(error.code).toBe("unprocessable");
      expect(error.fields?.map((field) => field.field)).toEqual(["userId"]);
    }
  });

  it("refuses revoking twice with 409 assignment_not_active", () => {
    for (const status of ["revoked", "completed"] as const) {
      const error = assignmentNotActiveError(status);
      expect(error.status).toBe(409);
      expect(error.code).toBe("assignment_not_active");
      expect(error.fields).toBeUndefined();
    }
  });
});
