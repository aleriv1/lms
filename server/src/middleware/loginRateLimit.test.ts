import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../errors/AppError.js";
import {
  clearFailedLogins,
  LOGIN_RATE_LIMIT_MAX_KEYS,
  LOGIN_RATE_LIMIT_MAX_PER_IP,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  loginRateLimit,
  loginRateLimitedByEmail,
  recordFailedLogin,
  resetLoginRateLimit,
} from "./loginRateLimit.js";

beforeEach(resetLoginRateLimit);
afterEach(() => vi.useRealTimers());

function request(email = "student@example.test", ip = "127.0.0.1"): Request {
  return { body: { email }, ip } as Request;
}

function recorder() {
  const setHeader = vi.fn();
  return { setHeader, output: { setHeader } as unknown as Response };
}

/** The address gate, as the router runs it: before any password check. */
function gate(input: Request) {
  const next = vi.fn();
  const { setHeader, output } = recorder();
  loginRateLimit(input, output, next);
  return { next, setHeader };
}

/** The account counter, as the handler asks it: after a wrong password. */
function byEmail(input: Request) {
  const { setHeader, output } = recorder();
  return { refused: loginRateLimitedByEmail(input, output), setHeader };
}

describe("login rate limit", () => {
  it("answers five wrong passwords with the ordinary failure and refuses the sixth", () => {
    const input = request();
    for (let index = 0; index < 5; index += 1) {
      expect(byEmail(input).refused).toBeUndefined();
      recordFailedLogin(input);
    }
    const sixth = byEmail(input);
    expect(sixth.refused).toMatchObject({ status: 429, code: "rate_limited" });
    expect(Number(sixth.setHeader.mock.calls[0]?.[1])).toBeGreaterThan(0);
    expect(byEmail(request("other@example.test")).refused).toBeUndefined();
  });

  it("lets the right password through a full account counter and clears it", () => {
    const input = request();
    for (let index = 0; index < 6; index += 1) recordFailedLogin(input);
    // Six failures is under the address bound, so the owner reaches the
    // password check: the account counter never stands in their way.
    expect(gate(input).next).toHaveBeenCalledWith();
    clearFailedLogins(input);
    expect(byEmail(input).refused).toBeUndefined();
  });

  it("keeps the address counter when one account signs in", () => {
    for (let index = 0; index < LOGIN_RATE_LIMIT_MAX_PER_IP; index += 1) {
      recordFailedLogin(request(`student${index}@example.test`));
    }
    // A successful sign-in must not hand the next guess from that address a
    // fresh allowance of twenty.
    clearFailedLogins(request("student0@example.test"));
    expect(gate(request("fresh@example.test")).next).toHaveBeenCalledWith(
      expect.any(AppError),
    );
  });

  it("limits guesses across different emails from one address", () => {
    for (let index = 0; index < LOGIN_RATE_LIMIT_MAX_PER_IP; index += 1) {
      const input = request(`student${index}@example.test`);
      expect(gate(input).next).toHaveBeenCalledWith();
      recordFailedLogin(input);
    }
    expect(gate(request("fresh@example.test")).next).toHaveBeenCalledWith(
      expect.any(AppError),
    );
    expect(
      gate(request("fresh@example.test", "127.0.0.2")).next,
    ).toHaveBeenCalledWith();
  });

  it("does not count a request the address gate refuses", () => {
    for (let index = 0; index < LOGIN_RATE_LIMIT_MAX_PER_IP; index += 1) {
      recordFailedLogin(request(`student${index}@example.test`));
    }
    const target = request("target@example.test");
    for (let index = 0; index < 10; index += 1) {
      expect(gate(target).next).toHaveBeenCalledWith(expect.any(AppError));
    }
    expect(byEmail(target).refused).toBeUndefined();
  });

  it("keeps a fixed window despite later failures and refusals", () => {
    vi.useFakeTimers();
    const input = request();
    recordFailedLogin(input);
    vi.advanceTimersByTime(60_000);
    for (let index = 0; index < 5; index += 1) recordFailedLogin(input);
    const refused = byEmail(input);
    expect(refused.setHeader).toHaveBeenCalledWith("Retry-After", "840");
    expect(refused.refused).toMatchObject({
      message: "Слишком много попыток входа. Повторите через 14 мин.",
    });
    vi.advanceTimersByTime(LOGIN_RATE_LIMIT_WINDOW_MS - 60_000);
    expect(byEmail(input).refused).toBeUndefined();
  });

  it("fails open when the store exceeds its key bound", () => {
    const input = request();
    for (let index = 0; index < 5; index += 1) recordFailedLogin(input);
    for (let index = 0; index < LOGIN_RATE_LIMIT_MAX_KEYS; index += 1) {
      recordFailedLogin(
        request(`other${index}@example.test`, `10.0.0.${index}`),
      );
    }
    // The sweep runs inside the gate, so it is the gate that empties the store.
    expect(gate(input).next).toHaveBeenCalledWith();
    expect(byEmail(input).refused).toBeUndefined();
  });
});
