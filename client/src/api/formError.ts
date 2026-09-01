import type { ApiErrorCode, FieldError } from "@lms/shared";

import { ApiError } from "./ApiError";

export type FormError = {
  code: ApiErrorCode;
  message: string;
  fields?: FieldError[];
};

export function toFormError(error: unknown): FormError {
  if (error instanceof ApiError) {
    return {
      code: error.code,
      message: error.message,
      fields: error.fields,
    };
  }

  return {
    code: "internal_error",
    message: "Произошла внутренняя ошибка",
  };
}
