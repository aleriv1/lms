import {
  changePasswordBodySchema,
  sessionResponseSchema,
  updateProfileBodySchema,
} from "@lms/shared";
import type { ChangePasswordBody, UpdateProfileBody } from "@lms/shared";
import { Router } from "express";

import { hashPassword, verifyPassword } from "../auth/password.js";
import { AppError } from "../errors/AppError.js";
import {
  getAuthenticatedUser,
  requireAuth,
} from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { toPublicUser, User } from "../models/User.js";

export const usersRouter = Router();

const EMAIL_TAKEN_FIELDS = [{ field: "email", message: "Email уже занят" }];

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

usersRouter.patch(
  "/me",
  requireAuth,
  validate(updateProfileBodySchema),
  async (request, response, next) => {
    try {
      const authenticatedUser = getAuthenticatedUser(request);
      const body = request.body as UpdateProfileBody;

      if (body.email !== authenticatedUser.email) {
        const existingUser = await User.exists({
          email: body.email,
          _id: { $ne: authenticatedUser.id },
        });
        if (existingUser) {
          next(
            new AppError(
              409,
              "email_taken",
              "Email уже занят",
              EMAIL_TAKEN_FIELDS,
            ),
          );
          return;
        }
      }

      const user = await User.findById(authenticatedUser.id);
      if (!user) {
        next(new AppError(401, "unauthorized", "Требуется авторизация"));
        return;
      }

      user.name = body.name;
      user.email = body.email;
      await user.save();

      response.json(sessionResponseSchema.parse({ user: toPublicUser(user) }));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        next(
          new AppError(
            409,
            "email_taken",
            "Email уже занят",
            EMAIL_TAKEN_FIELDS,
          ),
        );
        return;
      }

      next(error);
    }
  },
);

usersRouter.patch(
  "/me/password",
  requireAuth,
  validate(changePasswordBodySchema),
  async (request, response, next) => {
    try {
      const authenticatedUser = getAuthenticatedUser(request);
      const body = request.body as ChangePasswordBody;
      const user = await User.findById(authenticatedUser.id).select(
        "+passwordHash",
      );

      if (!user) {
        next(new AppError(401, "unauthorized", "Требуется авторизация"));
        return;
      }

      const passwordMatches = await verifyPassword(
        body.currentPassword,
        user.passwordHash,
      );
      if (!passwordMatches) {
        next(
          new AppError(
            422,
            "invalid_current_password",
            "Неверный текущий пароль",
          ),
        );
        return;
      }

      user.passwordHash = await hashPassword(body.newPassword);
      await user.save();
      response.sendStatus(204);
    } catch (error) {
      next(error);
    }
  },
);
