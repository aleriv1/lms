import { apiErrorSchema } from "@lms/shared";

import { ApiError } from "./ApiError";

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

const baseUrl = import.meta.env.VITE_API_URL || "/api";

/**
 * Sends a request to the API and returns the parsed JSON body.
 * Always sends cookies. On a non-2xx response, parses the body with
 * `apiErrorSchema` and throws `ApiError`; if the body is not a valid API error,
 * throws `ApiError` with code "internal_error".
 */
export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers:
      options.body === undefined
        ? undefined
        : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => undefined);
    const parsedError = apiErrorSchema.safeParse(payload);

    if (parsedError.success) {
      // Slice 02 adds central session-expiry handling at this boundary.
      throw new ApiError(
        response.status,
        parsedError.data.code,
        parsedError.data.message,
        parsedError.data.fields,
      );
    }

    throw new ApiError(
      response.status,
      "internal_error",
      "Произошла внутренняя ошибка",
    );
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
