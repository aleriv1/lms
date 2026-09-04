import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../errors/AppError.js";
import {
  clearFailedLogins,
  LOGIN_RATE_LIMIT_MAX_KEYS,
  LOGIN_RATE_LIMIT_MAX_PER_IP,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  loginRateLimit,
  recordFailedLogin,
  resetLoginRateLimit,
} from "./loginRateLimit.js";

beforeEach(resetLoginRateLimit);
afterEach(() => vi.useRealTimers());

function request(email = "student@example.test", ip = "127.0.0.1"): Request {
  return { body: { email }, ip } as Request;
}

function gate(input: Request) {
  const next = vi.fn();
  const setHeader = vi.fn();
  loginRateLimit(input, { setHeader } as unknown as Response, next);
  return { next, setHeader };
}

describe("login rate limit", () => {
  it("allows five failures and refuses the sixth request", () => {
    const input = request();
    for (let index = 0; index < 5; index += 1) {
      expect(gate(input).next).toHaveBeenCalledWith();
      recordFailedLogin(input);
    }
    expect(gate(input).next).toHaveBeenCalledWith(
      expect.objectContaining({ status: 429, code: "rate_limited" }),
    );
    expect(gate(request("other@example.test")).next).toHaveBeenCalledWith();
  });

  it("does not count passing gates and clears both counters after verification", () => {
    const input = request();
    for (let index = 0; index < 30; index += 1) {
      expect(gate(input).next).toHaveBeenCalledWith();
    }
    for (let index = 0; index < 4; index += 1) recordFailedLogin(input);
    clearFailedLogins(input);
    for (let index = 0; index < 4; index += 1) {
      expect(gate(input).next).toHaveBeenCalledWith();
      recordFailedLogin(input);
    }
    expect(gate(input).next).toHaveBeenCalledWith();
    for (let index = 0; index < 15; index += 1) {
      recordFailedLogin(request(`other${index}@example.test`));
    }
    expect(gate(request("fresh@example.test")).next).toHaveBeenCalledWith();
  });

  it("limits guesses across different emails from one IP", () => {
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

  it("keeps a fixed window despite later failures and refusals", () => {
    vi.useFakeTimers();
    const input = request();
    recordFailedLogin(input);
    vi.advanceTimersByTime(60_000);
    for (let index = 0; index < 4; index += 1) recordFailedLogin(input);
    const refused = gate(input);
    expect(refused.setHeader).toHaveBeenCalledWith("Retry-After", "840");
    expect(refused.next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Слишком много попыток входа. Повторите через 14 мин.",
      }),
    );
    vi.advanceTimersByTime(LOGIN_RATE_LIMIT_WINDOW_MS - 60_000);
    expect(gate(input).next).toHaveBeenCalledWith();
  });

  it("uses the later expiry when both counters are full", () => {
    vi.useFakeTimers();
    for (let index = 0; index < 5; index += 1) {
      recordFailedLogin(request("target@example.test", "127.0.0.2"));
    }
    vi.advanceTimersByTime(60_000);
    for (let index = 0; index < LOGIN_RATE_LIMIT_MAX_PER_IP; index += 1) {
      recordFailedLogin(request(`other${index}@example.test`));
    }
    const refused = gate(request("target@example.test"));
    expect(refused.setHeader).toHaveBeenCalledWith("Retry-After", "900");
  });

  it("fails open when the store exceeds its key bound", () => {
    const input = request();
    for (let index = 0; index < 5; index += 1) recordFailedLogin(input);
    for (let index = 0; index < LOGIN_RATE_LIMIT_MAX_KEYS; index += 1) {
      recordFailedLogin(request(`other${index}@example.test`));
    }
    expect(gate(input).next).toHaveBeenCalledWith();
  });
});
