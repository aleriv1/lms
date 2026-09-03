import {
  adminStatisticsQuerySchema,
  type AdminStatisticsQuery,
} from "@lms/shared";

const QUERY_KEYS = [
  "page",
  "pageSize",
  "courseId",
  "groupName",
  "learningStatus",
] as const;

/** Hand-typed invalid values fall back to the shared schema defaults. */
export function readStatisticsQuery(
  params: URLSearchParams,
): AdminStatisticsQuery {
  const input: Record<string, string> = {};
  for (const key of QUERY_KEYS) {
    const value = params.get(key);
    if (value !== null) input[key] = value;
  }
  const result = adminStatisticsQuerySchema.safeParse(input);
  return result.success ? result.data : adminStatisticsQuerySchema.parse({});
}

export function toSearchParams(query: AdminStatisticsQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of QUERY_KEYS) {
    const value = query[key];
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params;
}
