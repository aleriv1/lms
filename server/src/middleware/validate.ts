import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { AppError } from "../errors/AppError.js";

export type ValidationTarget = "body" | "query" | "params";

/**
 * Validates one part of the request against a schema from `@lms/shared` and
 * replaces it with the parsed value, so handlers receive normalised data.
 * On failure: 422, code "validation_error", one entry in `fields` per issue.
 */
export function validate(
  schema: ZodType,
  target: ValidationTarget = "body",
): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request[target]);

    if (!result.success) {
      next(
        new AppError(
          422,
          "validation_error",
          "Проверьте правильность заполнения полей",
          result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        ),
      );
      return;
    }

    Object.defineProperty(request, target, {
      configurable: true,
      enumerable: true,
      value: result.data,
      writable: true,
    });
    next();
  };
}
