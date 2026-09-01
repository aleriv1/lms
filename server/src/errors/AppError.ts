import type { ApiErrorCode, FieldError } from "@lms/shared";

export class AppError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields?: FieldError[];

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    fields?: FieldError[],
  ) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
