import { apiErrorSchema } from "@lms/shared";
import type { ErrorRequestHandler } from "express";

import { AppError } from "../errors/AppError.js";

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  void _next;

  if (error instanceof AppError) {
    const body = apiErrorSchema.parse({
      code: error.code,
      message: error.message,
      fields: error.fields,
    });
    response.status(error.status).json(body);
    return;
  }

  console.error(error);
  const body = apiErrorSchema.parse({
    code: "internal_error",
    message: "Произошла внутренняя ошибка",
  });
  response.status(500).json(body);
};
