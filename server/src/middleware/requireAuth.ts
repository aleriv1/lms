import type { PublicUser } from "@lms/shared";
import type { Request, RequestHandler } from "express";

import {
  clearSessionCookie,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "../auth/session.js";
import { AppError } from "../errors/AppError.js";
import { toPublicUser, User } from "../models/User.js";

export const requireAuth: RequestHandler = async (request, response, next) => {
  try {
    const token: unknown = request.cookies[SESSION_COOKIE_NAME];

    if (typeof token !== "string") {
      next(new AppError(401, "unauthorized", "Требуется авторизация"));
      return;
    }

    const userId = verifySessionToken(token);
    if (!userId) {
      clearSessionCookie(response);
      next(new AppError(401, "unauthorized", "Требуется авторизация"));
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      clearSessionCookie(response);
      next(new AppError(401, "unauthorized", "Требуется авторизация"));
      return;
    }

    if (user.status !== "active") {
      clearSessionCookie(response);
      next(
        new AppError(401, "account_blocked", "Учетная запись заблокирована"),
      );
      return;
    }

    request.user = toPublicUser(user);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Reads the user `requireAuth` attached. Throws 401 instead of a non-null
 * assertion, so a handler mounted without `requireAuth` fails loudly.
 */
export function getAuthenticatedUser(request: Request): PublicUser {
  if (!request.user) {
    throw new AppError(401, "unauthorized", "Требуется авторизация");
  }

  return request.user;
}
