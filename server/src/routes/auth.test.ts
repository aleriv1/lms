import { apiErrorSchema, sessionResponseSchema } from "@lms/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { User } from "../models/User.js";
import { verifyPassword } from "../auth/password.js";
import {
  api,
  clearDatabase,
  connectTestDatabase,
  createUser,
  disconnectTestDatabase,
  TEST_PASSWORD,
} from "../testing/apiClient.js";

beforeAll(connectTestDatabase, 120_000);
afterAll(disconnectTestDatabase);
beforeEach(clearDatabase);

describe("authentication over HTTP", () => {
  it("limits the sixth wrong password using the normalised email", async () => {
    const user = await createUser();
    const agent = api();
    for (let index = 0; index < 5; index += 1) {
      const response = await agent
        .post("/api/auth/login")
        .send({
          email: index % 2 ? ` ${user.email.toUpperCase()} ` : user.email,
          password: "WrongPassword1",
        })
        .expect(401);
      expect(apiErrorSchema.parse(response.body).code).toBe(
        "invalid_credentials",
      );
    }
    const refused = await agent
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: "WrongPassword1",
      })
      .expect(429);
    expect(apiErrorSchema.parse(refused.body).code).toBe("rate_limited");
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("clears failures after a correct password", async () => {
    const user = await createUser();
    const agent = api();
    for (let round = 0; round < 2; round += 1) {
      for (let index = 0; index < 4; index += 1) {
        await agent
          .post("/api/auth/login")
          .send({
            email: user.email,
            password: "WrongPassword1",
          })
          .expect(401);
      }
      await agent
        .post("/api/auth/login")
        .send({
          email: user.email,
          password: TEST_PASSWORD,
        })
        .expect(200);
    }
  });

  it("signs in with an httpOnly cookie, reads the public user and logs out", async () => {
    const user = await createUser();
    const agent = api();
    const anonymous = await agent.get("/api/auth/me").expect(401);
    expect(apiErrorSchema.parse(anonymous.body).code).toBe("unauthorized");
    const login = await agent
      .post("/api/auth/login")
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(200);
    const session = sessionResponseSchema.parse(login.body);
    expect(session.user).toMatchObject({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: "student",
      status: "active",
    });
    expect(login.headers["set-cookie"]).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^session=.+;.*HttpOnly/i),
      ]),
    );
    const me = await agent.get("/api/auth/me").expect(200);
    expect(sessionResponseSchema.parse(me.body)).toEqual(session);
    const logout = await agent.post("/api/auth/logout").expect(204);
    const afterLogout = await agent.get("/api/auth/me").expect(401);
    expect(apiErrorSchema.parse(afterLogout.body).code).toBe("unauthorized");
    for (const response of [anonymous, login, me, logout, afterLogout]) {
      expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    }
  });

  it("refuses an unknown email exactly like a wrong password", async () => {
    const user = await createUser();
    const wrong = await api()
      .post("/api/auth/login")
      .send({ email: user.email, password: "WrongPassword1" })
      .expect(401);
    const unknown = await api()
      .post("/api/auth/login")
      .send({ email: "missing@example.test", password: TEST_PASSWORD });
    expect(apiErrorSchema.parse(wrong.body).code).toBe("invalid_credentials");
    expect(unknown.status).toBe(wrong.status);
    expect(apiErrorSchema.parse(unknown.body).code).toBe(
      apiErrorSchema.parse(wrong.body).code,
    );
    for (const response of [wrong, unknown])
      expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it.each([
    ["blocked", 403, "account_blocked"],
    ["archived", 401, "invalid_credentials"],
  ] as const)("refuses a %s account", async (status, httpStatus, code) => {
    const user = await createUser({ status });
    const response = await api()
      .post("/api/auth/login")
      .send({ email: user.email, password: TEST_PASSWORD })
      .expect(httpStatus);
    expect(apiErrorSchema.parse(response.body).code).toBe(code);
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("registers a student and stores a hash without exposing it", async () => {
    const agent = api();
    const response = await agent
      .post("/api/auth/register")
      .send({
        name: "Новый ученик",
        email: "registered@example.test",
        password: TEST_PASSWORD,
        passwordConfirm: TEST_PASSWORD,
      })
      .expect(201);
    const { user } = sessionResponseSchema.parse(response.body);
    expect(user).toMatchObject({
      email: "registered@example.test",
      role: "student",
      status: "active",
    });
    const stored = await User.findById(user.id).select("+passwordHash");
    expect(stored?.passwordHash).toBeTruthy();
    expect(stored?.passwordHash).not.toBe(TEST_PASSWORD);
    expect(
      await verifyPassword(TEST_PASSWORD, stored?.passwordHash ?? ""),
    ).toBe(true);
    const me = await agent.get("/api/auth/me").expect(200);
    expect(sessionResponseSchema.parse(me.body).user.id).toBe(user.id);
    for (const item of [response, me])
      expect(JSON.stringify(item.body)).not.toContain("passwordHash");
  });
});
