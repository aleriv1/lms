import { adminUsersQuerySchema } from "@lms/shared";
import { describe, expect, it } from "vitest";

import { buildUserFilter, buildUserSort } from "./userQuery.js";

const parse = (query: Record<string, unknown>) =>
  adminUsersQuerySchema.parse(query);

describe("admin user query helpers", () => {
  it("searches name and email and escapes RegExp metacharacters", () => {
    const filter = buildUserFilter(parse({ search: "a(" }));
    const expressions = (filter.$or ?? []).map(
      (part) => Object.values(part)[0] as RegExp,
    );

    expect((filter.$or ?? []).map((part) => Object.keys(part)[0])).toEqual([
      "name",
      "email",
    ]);
    expect(expressions).toHaveLength(2);
    expect(expressions.every((pattern) => pattern.source === "a\\(")).toBe(true);
    expect(expressions.every((pattern) => pattern.test("Иванов a( "))).toBe(
      true,
    );
    expect(expressions.some((pattern) => pattern.test("Иванов ab"))).toBe(false);
  });

  it("builds no filter from an empty query", () => {
    expect(buildUserFilter(parse({}))).toEqual({});
  });

  it("ignores an empty search and an empty group", () => {
    // Zod keeps `""` for the two string fields; only the enums reject it.
    expect(buildUserFilter(parse({ search: "", groupName: "" }))).toEqual({});
  });

  it("matches role and status exactly and the group as a substring", () => {
    const filter = buildUserFilter(
      parse({ role: "teacher", status: "blocked", groupName: "Смена" }),
    );

    expect(filter.role).toBe("teacher");
    expect(filter.status).toBe("blocked");
    expect(filter.groupName).toBeInstanceOf(RegExp);
    expect((filter.groupName as RegExp).test("Смена А")).toBe(true);
    expect((filter.groupName as RegExp).test("смена Б")).toBe(true);
    expect((filter.groupName as RegExp).test("Бригада")).toBe(false);
  });

  it("sorts by the requested field with _id as a tiebreaker", () => {
    expect(buildUserSort(parse({}))).toEqual({ createdAt: -1, _id: -1 });

    for (const sortBy of ["name", "email", "createdAt", "lastLoginAt"]) {
      expect(buildUserSort(parse({ sortBy, sortOrder: "asc" }))).toEqual({
        [sortBy]: 1,
        _id: 1,
      });
      expect(buildUserSort(parse({ sortBy, sortOrder: "desc" }))).toEqual({
        [sortBy]: -1,
        _id: -1,
      });
    }
  });
});
