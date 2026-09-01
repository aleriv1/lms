import type { ApiErrorCode, FieldError } from "@lms/shared";

export class ApiError extends Error {
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
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
