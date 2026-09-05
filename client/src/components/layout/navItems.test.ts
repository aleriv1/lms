import type { PublicUser, UserRole } from "@lms/shared";
import { describe, expect, it } from "vitest";

import { getNavItems } from "./navItems";

function user(role: UserRole): PublicUser {
  return {
    id: "64b7f2c1d3e4a5b6c7d8e9f0",
    name: "Пользователь",
    email: "user@example.com",
    role,
    status: "active",
    groupName: null,
  } as PublicUser;
}

describe("getNavItems", () => {
  it.each<UserRole>(["student", "teacher", "admin"])(
    "gives %s a way into their own learning",
    (role) => {
      expect(getNavItems(user(role))).toContainEqual({
        to: "/learning",
        label: "Мое обучение",
      });
    },
  );

  it("keeps the management sections out of the student menu", () => {
    const paths = getNavItems(user("student")).map((item) => item.to);

    expect(paths).toEqual(["/learning", "/profile"]);
  });

  it("adds the author filter for a teacher", () => {
    const teacher = user("teacher");

    expect(getNavItems(teacher).map((item) => item.to)).toEqual([
      "/manage/courses",
      `/manage/courses?authorId=${teacher.id}`,
      "/learning",
      "/profile",
    ]);
  });
});
