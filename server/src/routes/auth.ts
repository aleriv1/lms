import {
  loginBodySchema,
  registerBodySchema,
  sessionResponseSchema,
} from "@lms/shared";
import type { LoginBody, RegisterBody } from "@lms/shared";
import { Router } from "express";

import {
  hashPassword,
  unknownAccountPasswordHash,
  verifyPassword,
} from "../auth/password.js";
import {
  clearSessionCookie,
  setSessionCookie,
  signSessionToken,
} from "../auth/session.js";
import { AppError } from "../errors/AppError.js";
import {
  getAuthenticatedUser,
  requireAuth,
} from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import {
  clearFailedLogins,
  loginRateLimit,
  recordFailedLogin,
} from "../middleware/loginRateLimit.js";
import { toPublicUser, User } from "../models/User.js";

export const authRouter = Router();

const EMAIL_TAKEN_FIELDS = [{ field: "email", message: "Email уже занят" }];

function invalidCredentials(): AppError {
  return new AppError(401, "invalid_credentials", "Неверный email или пароль");
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

authRouter.post(
  "/register",
  validate(registerBodySchema),
  async (request, response, next) => {
    try {
      const body = request.body as RegisterBody;
      const existingUser = await User.exists({ email: body.email });
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

      const user = await User.create({
        name: body.name,
        email: body.email,
        passwordHash: await hashPassword(body.password),
        role: "student",
        status: "active",
      });
      const publicUser = toPublicUser(user);

      setSessionCookie(response, signSessionToken(publicUser.id));
      response
        .status(201)
        .json(sessionResponseSchema.parse({ user: publicUser }));
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

authRouter.post(
  "/login",
  validate(loginBodySchema),
  loginRateLimit,
  async (request, response, next) => {
    try {
      const body = request.body as LoginBody;
      const user = await User.findOne({ email: body.email }).select(
        "+passwordHash",
      );

      const passwordHash =
        user?.passwordHash ?? (await unknownAccountPasswordHash());
      const isPasswordValid = await verifyPassword(body.password, passwordHash);

      if (!user || !isPasswordValid) {
        recordFailedLogin(request);
        next(invalidCredentials());
        return;
      }

      clearFailedLogins(request);

      if (user.status === "blocked") {
        next(
          new AppError(403, "account_blocked", "Учетная запись заблокирована"),
        );
        return;
      }

      if (user.status === "archived") {
        recordFailedLogin(request);
        next(invalidCredentials());
        return;
      }

      user.lastLoginAt = new Date();
      await user.save();

      const publicUser = toPublicUser(user);
      setSessionCookie(response, signSessionToken(publicUser.id));
      response.json(sessionResponseSchema.parse({ user: publicUser }));
    } catch (error) {
      next(error);
    }
  },
);

authRouter.post("/logout", (_request, response) => {
  clearSessionCookie(response);
  response.sendStatus(204);
});

authRouter.get("/me", requireAuth, (request, response) => {
  const user = getAuthenticatedUser(request);
  response.json(sessionResponseSchema.parse({ user }));
});
