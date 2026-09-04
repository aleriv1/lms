import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

export const PASSWORD_SALT_ROUNDS = 10;

let unknownPasswordHash: Promise<string> | undefined;

/**
 * Compare unknown accounts against a hash of a random value nobody holds.
 * Memoising the promise keeps the same bcrypt cost factor across requests.
 */
export function unknownAccountPasswordHash(): Promise<string> {
  unknownPasswordHash ??= hashPassword(randomBytes(32).toString("hex"));
  return unknownPasswordHash;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export function verifyPassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}
