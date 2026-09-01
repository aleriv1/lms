import type { UserRole } from "@lms/shared";
import type { RequestHandler } from "express";

import { AppError } from "../errors/AppError.js";

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) {
      next(new AppError(401, "unauthorized", "Требуется авторизация"));
      return;
    }

    if (!roles.includes(request.user.role)) {
      next(new AppError(403, "forbidden", "Недостаточно прав"));
      return;
    }

    next();
  };
}
