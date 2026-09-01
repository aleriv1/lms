import { apiErrorSchema } from "@lms/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../app.js";

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
