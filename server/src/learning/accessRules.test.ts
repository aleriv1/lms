import { ASSIGNMENT_STATUSES, COURSE_STATUSES } from "@lms/shared";
import { describe, expect, it } from "vitest";

import {
  courseNotAssignedError,
  courseNotStudiableError,
  isAssignmentEffective,
  isCourseReadable,
  isCourseStudiable,
  lessonLockedError,
  lessonTestRequiredError,
} from "./accessRules.js";

describe("learning access rules", () => {
  it("gives access on an assignment that was not revoked", () => {
    expect(ASSIGNMENT_STATUSES.filter(isAssignmentEffective)).toEqual([
      "active",
      "completed",
    ]);
  });

  it("opens a published or an archived course for reading", () => {
    expect(COURSE_STATUSES.filter(isCourseReadable)).toEqual([
      "published",
      "archived",
    ]);
  });

  it("allows learning actions on a published course only", () => {
    expect(COURSE_STATUSES.filter(isCourseStudiable)).toEqual(["published"]);
  });

  it("refuses an archived course as forbidden, not as unassigned", () => {
    const archived = courseNotStudiableError("archived");

    expect(archived.status).toBe(403);
    expect(archived.code).toBe("forbidden");
  });

  it("answers for a draft course as it does for one not assigned", () => {
    const draft = courseNotStudiableError("draft");

    expect(draft.status).toBe(403);
    expect(draft.code).toBe("course_not_assigned");
    expect(draft.message).toBe(courseNotAssignedError().message);
  });

  it("carries the codes the client branches on", () => {
    expect(courseNotAssignedError().code).toBe("course_not_assigned");
    expect(lessonLockedError().status).toBe(403);
    expect(lessonLockedError().code).toBe("lesson_locked");
    expect(lessonTestRequiredError().status).toBe(422);
    expect(lessonTestRequiredError().code).toBe("lesson_test_required");
  });
});
