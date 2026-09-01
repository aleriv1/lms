import type { PublicUser } from "@lms/shared";
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { AppError } from "../errors/AppError.js";
import { requireRole } from "./requireRole.js";

const publicUser: PublicUser = {
  id: "507f1f77bcf86cd799439011",
  name: "Преподаватель Иванов",
  email: "teacher@lms.local",
  role: "teacher",
  groupName: null,
  status: "active",
  lastLoginAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function runMiddleware(
  request: Partial<Request>,
  next: ReturnType<typeof vi.fn>,
): void {
  requireRole("teacher")(
    request as Request,
    {} as Response,
    next as NextFunction,
  );
}

describe("requireRole", () => {
  it("calls next without an error for a listed role", () => {
    const next = vi.fn();

    runMiddleware({ user: publicUser }, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("returns forbidden for an unlisted role", () => {
    const next = vi.fn();

    runMiddleware({ user: { ...publicUser, role: "student" } }, next);

    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 403, code: "forbidden" });
  });

  it("returns unauthorized when request.user is absent", () => {
    const next = vi.fn();

    runMiddleware({}, next);

    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 401, code: "unauthorized" });
  });
});
