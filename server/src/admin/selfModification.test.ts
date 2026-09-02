import type { AdminUpdateUserBody, PublicUser } from "@lms/shared";
import { describe, expect, it } from "vitest";

import { collectSelfModificationIssues } from "./selfModification.js";

const ADMIN_ID = "0123456789abcdef01234567";
const OTHER_ID = "0123456789abcdef01234568";

const admin: PublicUser = {
  id: ADMIN_ID,
  name: "Администратор Системы",
  email: "admin@lms.local",
  role: "admin",
  groupName: null,
  status: "active",
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const body = (
  overrides: Partial<AdminUpdateUserBody> = {},
): AdminUpdateUserBody => ({
  name: "Администратор Системы",
  role: "admin",
  groupName: null,
  status: "active",
  ...overrides,
});

const fields = (issues: { field: string }[]) =>
  issues.map((issue) => issue.field);

describe("collectSelfModificationIssues", () => {
  it("allows any change to somebody else", () => {
    expect(
      collectSelfModificationIssues(
        admin,
        OTHER_ID,
        body({ role: "student", status: "blocked" }),
      ),
    ).toEqual([]);
  });

  it("allows editing own name and group", () => {
    expect(
      collectSelfModificationIssues(
        admin,
        ADMIN_ID,
        body({ name: "Новое Имя", groupName: "Смена А" }),
      ),
    ).toEqual([]);
  });

  it("refuses demoting oneself", () => {
    expect(
      fields(
        collectSelfModificationIssues(admin, ADMIN_ID, body({ role: "teacher" })),
      ),
    ).toEqual(["role"]);
    expect(
      fields(
        collectSelfModificationIssues(admin, ADMIN_ID, body({ role: "student" })),
      ),
    ).toEqual(["role"]);
  });

  it("refuses blocking and archiving oneself", () => {
    expect(
      fields(
        collectSelfModificationIssues(
          admin,
          ADMIN_ID,
          body({ status: "blocked" }),
        ),
      ),
    ).toEqual(["status"]);
    expect(
      fields(
        collectSelfModificationIssues(
          admin,
          ADMIN_ID,
          body({ status: "archived" }),
        ),
      ),
    ).toEqual(["status"]);
  });

  it("recognises the same account through an upper case identifier", () => {
    expect(
      fields(
        collectSelfModificationIssues(
          admin,
          ADMIN_ID.toUpperCase(),
          body({ role: "student", status: "blocked" }),
        ),
      ),
    ).toEqual(["role", "status"]);
  });

  it("reports both fields when both are wrong", () => {
    expect(
      fields(
        collectSelfModificationIssues(
          admin,
          ADMIN_ID,
          body({ role: "student", status: "blocked" }),
        ),
      ),
    ).toEqual(["role", "status"]);
  });
});
