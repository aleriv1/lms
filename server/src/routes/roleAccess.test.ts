import { apiErrorSchema } from "@lms/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  api,
  clearDatabase,
  connectTestDatabase,
  createUser,
  disconnectTestDatabase,
  signIn,
  TEST_PASSWORD,
} from "../testing/apiClient.js";

beforeAll(connectTestDatabase, 120_000);
afterAll(disconnectTestDatabase);
beforeEach(clearDatabase);

describe("role access over HTTP", () => {
  it("refuses the course catalogue without a session", async () => {
    const response = await api().get("/api/courses").expect(401);
    expect(apiErrorSchema.parse(response.body).code).toBe("unauthorized");
  });

  it.each(["student", "teacher", "admin"] as const)(
    "checks catalogue and administration access for %s",
    async (role) => {
      const user = await createUser({ role });
      const agent = await signIn(user.email, TEST_PASSWORD);
      const courses = await agent
        .get("/api/courses")
        .expect(role === "student" ? 403 : 200);
      if (role === "student")
        expect(apiErrorSchema.parse(courses.body).code).toBe("forbidden");
      const users = await agent
        .get("/api/admin/users")
        .expect(role === "admin" ? 200 : 403);
      if (role !== "admin")
        expect(apiErrorSchema.parse(users.body).code).toBe("forbidden");
    },
  );
});
