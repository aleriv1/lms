import { coursesQuerySchema } from "@lms/shared";
import { describe, expect, it } from "vitest";

import { buildCourseFilter, buildCourseSort } from "./courseQuery.js";
import { escapeRegExp } from "../db/escapeRegExp.js";

describe("course query helpers", () => {
  it("escapes RegExp metacharacters and matches them literally", () => {
    expect(escapeRegExp(".*+?^${}()|[]\\")).toBe(
      "\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\",
    );
    expect(escapeRegExp("a(")).toBe("a\\(");

    const filter = buildCourseFilter(coursesQuerySchema.parse({ search: "a(" }));
    const expressions = (filter.$or ?? []).map((part) =>
      Object.values(part)[0],
    );

    expect(expressions).toHaveLength(2);
    for (const expression of expressions) {
      expect(expression).toBeInstanceOf(RegExp);
      expect((expression as RegExp).test("prefix a( suffix")).toBe(true);
      expect((expression as RegExp).test("prefix ab suffix")).toBe(false);
    }
  });

  it("returns an empty filter for a query carrying only defaults", () => {
    expect(buildCourseFilter(coursesQuerySchema.parse({}))).toEqual({});
  });

  it("builds search over title and short description", () => {
    const filter = buildCourseFilter(coursesQuerySchema.parse({ search: "курс" }));

    expect(filter).toEqual({
      $or: [
        { title: /курс/i },
        { shortDescription: /курс/i },
      ],
    });
  });

  it.each([
    ["category", "Безопасность", /Безопасность/i],
    ["audience", "drivers", "drivers"],
    ["status", "draft", "draft"],
    ["authorId", "507f1f77bcf86cd799439011", "507f1f77bcf86cd799439011"],
  ] as const)("adds only the %s filter when it is present", (key, value, expected) => {
    const filter = buildCourseFilter(coursesQuerySchema.parse({ [key]: value }));

    expect(Object.keys(filter)).toEqual([key]);
    expect(filter[key]).toEqual(expected);
  });

  it.each([
    ["asc", 1],
    ["desc", -1],
  ] as const)("maps %s sorting and adds a matching _id tiebreaker", (sortOrder, order) => {
    const query = coursesQuerySchema.parse({ sortBy: "title", sortOrder });

    expect(buildCourseSort(query)).toEqual({ title: order, _id: order });
  });
});
