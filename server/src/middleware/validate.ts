import type { RequestHandler } from "express";
import type { ZodType } from "zod";

import { AppError } from "../errors/AppError.js";

export type ValidationTarget = "body" | "query" | "params";

/**
 * Validates one part of the request against a schema from `@lms/shared` and
 * replaces it with the parsed value, so handlers receive normalised data.
 *
 * A body or a query is something the caller filled in, so a failure there is
 * 422 with the offending fields. A path parameter is not a filled-in field: an
 * identifier that cannot be an identifier addresses nothing, and answering it
 * with "check the fields you filled in" puts a form complaint on a page that
 * has no form. Those fail as 404, the same answer a well-formed identifier for
 * a missing entity gets.
 */
export function validate(
  schema: ZodType,
  target: ValidationTarget = "body",
): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request[target]);

    if (!result.success) {
      next(
        target === "params"
          ? new AppError(404, "not_found", "Страница не найдена")
          : new AppError(
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
