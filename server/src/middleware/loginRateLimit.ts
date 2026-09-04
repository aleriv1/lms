import type { LoginBody } from "@lms/shared";
import type { Request, RequestHandler } from "express";

import { AppError } from "../errors/AppError.js";

// Counters live in one process and disappear on restart. Multiple processes
// would each have their own counters; distributed limiting needs a shared
// store, which this project does not have.
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX_PER_EMAIL = 5;
export const LOGIN_RATE_LIMIT_MAX_PER_IP = 20;
/** Fail-open bound on the in-memory store. */
export const LOGIN_RATE_LIMIT_MAX_KEYS = 10_000;

const failures = new Map<string, { count: number; expiresAt: number }>();

function counters(request: Request): [string, number][] {
  const body = request.body as LoginBody;
  return [
    [`email:${body.email}`, LOGIN_RATE_LIMIT_MAX_PER_EMAIL],
    [`ip:${request.ip ?? "unknown"}`, LOGIN_RATE_LIMIT_MAX_PER_IP],
  ];
}

export const loginRateLimit: RequestHandler = (request, response, next) => {
  const now = Date.now();
  for (const [key, entry] of failures) {
    if (entry.expiresAt <= now) failures.delete(key);
  }
  if (failures.size > LOGIN_RATE_LIMIT_MAX_KEYS) failures.clear();

  let expiresAt = 0;
  for (const [key, maximum] of counters(request)) {
    const entry = failures.get(key);
    if (entry && entry.count >= maximum) {
      expiresAt = Math.max(expiresAt, entry.expiresAt);
    }
  }
  if (expiresAt > now) {
    const minutes = Math.max(1, Math.ceil((expiresAt - now) / 60_000));
    response.setHeader(
      "Retry-After",
      String(Math.max(1, Math.ceil((expiresAt - now) / 1000))),
    );
    next(
      new AppError(
        429,
        "rate_limited",
        `Слишком много попыток входа. Повторите через ${minutes} мин.`,
      ),
    );
    return;
  }
  next();
};

export function recordFailedLogin(request: Request): void {
  const now = Date.now();
  for (const [key] of counters(request)) {
    const entry = failures.get(key);
    if (entry && entry.expiresAt > now) entry.count += 1;
    else
      failures.set(key, {
        count: 1,
        expiresAt: now + LOGIN_RATE_LIMIT_WINDOW_MS,
      });
  }
}

export function clearFailedLogins(request: Request): void {
  for (const [key] of counters(request)) failures.delete(key);
}

/** Tests only: empties process state. */
export function resetLoginRateLimit(): void {
  failures.clear();
}
