/**
 * A unique index rejected the write. Used wherever a check before the write
 * leaves a race window open: the check gives a readable message, the index
 * closes the window, and both answer 409.
 */
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}
