import type { LoginBody } from "@lms/shared";
import type { Request, RequestHandler, Response } from "express";

import { AppError } from "../errors/AppError.js";

// Counters live in one process and disappear on restart. Multiple processes
// would each have their own counters; distributed limiting needs a shared
// store, which this project does not have.
//
// The two counters guard different things and therefore stand in different
// places. The address counter is a gate in front of the handler: it is what
// caps the bcrypt work one client can demand, so it has to refuse before the
// password is checked. The account counter is not a gate at all — it is
// consulted only once a password has already turned out to be wrong, so the
// owner of the account gets in with the right password no matter how many
// failures someone else has piled onto their email. A gate in front of the
// password check would have handed anyone a way to lock any known address out
// of the system for fifteen minutes.
//
// `request.ip` is the socket address: the deployment must not put this server
// behind a proxy without configuring `trust proxy`, or every client collapses
// into one address counter.
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX_PER_EMAIL = 5;
export const LOGIN_RATE_LIMIT_MAX_PER_IP = 20;
/** Fail-open bound on the in-memory store. */
export const LOGIN_RATE_LIMIT_MAX_KEYS = 10_000;

const failures = new Map<string, { count: number; expiresAt: number }>();

function emailKey(request: Request): string {
  return `email:${(request.body as LoginBody).email}`;
}

function ipKey(request: Request): string {
  return `ip:${request.ip ?? "unknown"}`;
}

function sweep(now: number): void {
  for (const [key, entry] of failures) {
    if (entry.expiresAt <= now) failures.delete(key);
  }
  if (failures.size > LOGIN_RATE_LIMIT_MAX_KEYS) failures.clear();
}

/**
 * The refusal for a full counter, or `undefined` while it has room. Setting
 * `Retry-After` here keeps the header and the message reading the same clock.
 */
function refusal(
  key: string,
  maximum: number,
  response: Response,
  now: number,
): AppError | undefined {
  const entry = failures.get(key);
  if (!entry || entry.count < maximum || entry.expiresAt <= now) {
    return undefined;
  }

  const remainingMs = entry.expiresAt - now;
  response.setHeader(
    "Retry-After",
    String(Math.max(1, Math.ceil(remainingMs / 1000))),
  );

  return new AppError(
    429,
    "rate_limited",
    `Слишком много попыток входа. Повторите через ${Math.max(
      1,
      Math.ceil(remainingMs / 60_000),
    )} мин.`,
  );
}

/** Refuses one address before the handler spends a bcrypt comparison on it. */
export const loginRateLimit: RequestHandler = (request, response, next) => {
  const now = Date.now();
  sweep(now);

  const refused = refusal(
    ipKey(request),
    LOGIN_RATE_LIMIT_MAX_PER_IP,
    response,
    now,
  );
  if (refused) {
    next(refused);
    return;
  }

  next();
};

/**
 * The account counter, asked after a password has already failed. Call it
 * before recording the current failure: the fifth wrong password is still an
 * ordinary 401, and only the sixth request meets a full counter.
 */
export function loginRateLimitedByEmail(
  request: Request,
  response: Response,
): AppError | undefined {
  return refusal(
    emailKey(request),
    LOGIN_RATE_LIMIT_MAX_PER_EMAIL,
    response,
    Date.now(),
  );
}

/**
 * Both counters grow on every wrong password, the ones already answered with a
 * 429 included: a refused guess is still a guess, and the window is fixed at
 * the first failure, so counting cannot push the release further away.
 */
export function recordFailedLogin(request: Request): void {
  const now = Date.now();
  for (const key of [emailKey(request), ipKey(request)]) {
    const entry = failures.get(key);
    if (entry && entry.expiresAt > now) entry.count += 1;
    else
      failures.set(key, {
        count: 1,
        expiresAt: now + LOGIN_RATE_LIMIT_WINDOW_MS,
      });
  }
}

/**
 * A correct password clears the account counter only. The address counter is
 * shared by everyone behind that address, so letting one successful sign-in
 * empty it would hand anyone holding a single valid account an unlimited
 * supply of guesses against every other address.
 */
export function clearFailedLogins(request: Request): void {
  failures.delete(emailKey(request));
}

/** Tests only: empties process state. */
export function resetLoginRateLimit(): void {
  failures.clear();
}
