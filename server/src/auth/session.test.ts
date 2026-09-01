import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";

import { signSessionToken, verifySessionToken } from "./session.js";

describe("session tokens", () => {
  it("returns the same user id after signing and verifying", () => {
    const userId = "507f1f77bcf86cd799439011";

    expect(verifySessionToken(signSessionToken(userId))).toBe(userId);
  });

  it("returns null for a tampered token", () => {
    const token = signSessionToken("507f1f77bcf86cd799439011");
    const lastCharacter = token.at(-1);
    const tamperedToken = `${token.slice(0, -1)}${lastCharacter === "a" ? "b" : "a"}`;

    expect(verifySessionToken(tamperedToken)).toBeNull();
  });

  it("returns null for a token signed with a different secret", () => {
    const token = jwt.sign(
      {},
      "different-test-secret-with-at-least-32-characters",
      { subject: "507f1f77bcf86cd799439011", expiresIn: "7d" },
    );

    expect(verifySessionToken(token)).toBeNull();
  });
});
