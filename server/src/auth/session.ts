import type { CookieOptions, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.nodeEnv === "production",
  path: "/",
};

/** The payload carries the user id and nothing else. */
export function signSessionToken(userId: string): string {
  return jwt.sign({}, env.jwtSecret, {
    subject: userId,
    expiresIn: "7d",
  });
}

/** Returns the user id, or null for a missing, malformed, expired or forged token. */
export function verifySessionToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    return typeof payload === "object" && typeof payload.sub === "string"
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}

export function setSessionCookie(response: Response, token: string): void {
  response.cookie(SESSION_COOKIE_NAME, token, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE_MS,
  });
}

export function clearSessionCookie(response: Response): void {
  response.clearCookie(SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS);
}
