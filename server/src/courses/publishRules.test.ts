import { describe, expect, it } from "vitest";

import type { CourseAttributes } from "../models/Course.js";
import { collectPublicationIssues } from "./publishRules.js";

type PublishableCourse = Pick<
  CourseAttributes,
  "title" | "category" | "audience" | "shortDescription"
>;

const READY_COURSE: PublishableCourse = {
  title: "Охрана труда",
  category: "Безопасность",
  audience: "drivers",
  shortDescription: "Базовый курс",
};

function issueFields(
  course: PublishableCourse,
  publishedRequiredLessonsCount: number,
): string[] {
  return collectPublicationIssues(course, publishedRequiredLessonsCount).map(
    (issue) => issue.field,
  );
}

describe("collectPublicationIssues", () => {
  it("asks for a lesson while no published required lesson exists", () => {
    expect(issueFields(READY_COURSE, 0)).toEqual(["lessons"]);
  });

  it("finds nothing to fix once one published required lesson exists", () => {
    expect(issueFields(READY_COURSE, 1)).toEqual([]);
  });

  it("still reports an empty title", () => {
    expect(issueFields({ ...READY_COURSE, title: "   " }, 1)).toEqual(["title"]);
  });
});
