import { coursesQuerySchema, type CoursesQuery } from "@lms/shared";

const QUERY_KEYS = [
  "page",
  "pageSize",
  "search",
  "sortOrder",
  "category",
  "audience",
  "status",
  "authorId",
  "sortBy",
] as const;

/** Parses the URL. Invalid or hand-typed values fall back to the schema defaults. */
export function readCoursesQuery(params: URLSearchParams): CoursesQuery {
  const input: Record<string, string> = {};

  for (const key of QUERY_KEYS) {
    const value = params.get(key);
    if (value !== null) {
      input[key] = value;
    }
  }

  const result = coursesQuerySchema.safeParse(input);
  return result.success ? result.data : coursesQuerySchema.parse({});
}

/** Serialises a query for the URL and for the API, omitting empty values. */
export function toSearchParams(query: CoursesQuery): URLSearchParams {
  const params = new URLSearchParams();

  for (const key of QUERY_KEYS) {
    const value = query[key];
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  return params;
}
