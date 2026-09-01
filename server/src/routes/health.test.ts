import { apiErrorSchema } from "@lms/shared";
import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";

let app: Express;

beforeAll(async () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("PORT", "4000");
  vi.stubEnv(
    "MONGODB_URI",
    "mongodb://localhost:27017/corporate-learning-test",
  );
  vi.stubEnv("CLIENT_ORIGIN", "http://localhost:5173");
  ({ app } = await import("../app.js"));
});

describe("health route", () => {
  it("returns the service and database status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: "disconnected" });
  });

  it("returns a contract-shaped error for an unknown API route", async () => {
    const response = await request(app).get("/api/unknown");

    expect(response.status).toBe(404);
    expect(apiErrorSchema.parse(response.body)).toMatchObject({
      code: "not_found",
    });
  });
});
