import { adminUsersQuerySchema, type AdminUsersQuery } from "@lms/shared";

const QUERY_KEYS = [
  "page",
  "pageSize",
  "search",
  "sortBy",
  "sortOrder",
  "role",
  "status",
  "groupName",
] as const;

/** Invalid or hand-typed URL values fall back to the schema defaults. */
export function readAdminUsersQuery(params: URLSearchParams): AdminUsersQuery {
  const input: Record<string, string> = {};

  for (const key of QUERY_KEYS) {
    const value = params.get(key);
    if (value !== null) {
      input[key] = value;
    }
  }

  const result = adminUsersQuerySchema.safeParse(input);
  return result.success ? result.data : adminUsersQuerySchema.parse({});
}

export function toSearchParams(query: AdminUsersQuery): URLSearchParams {
  const params = new URLSearchParams();

  for (const key of QUERY_KEYS) {
    const value = query[key];
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  return params;
}
