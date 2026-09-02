import type { AdminUsersQuery } from "@lms/shared";
import type { FilterQuery, SortOrder } from "mongoose";

import { escapeRegExp } from "../db/escapeRegExp.js";
import type { UserAttributes } from "../models/User.js";

/** Builds the MongoDB filter for `GET /admin/users` from the validated query. */
export function buildUserFilter(
  query: AdminUsersQuery,
): FilterQuery<UserAttributes> {
  const filter: FilterQuery<UserAttributes> = {};

  if (query.search) {
    const pattern = new RegExp(escapeRegExp(query.search), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  if (query.role) {
    filter.role = query.role;
  }

  if (query.status) {
    filter.status = query.status;
  }

  // A substring, like the course category filter: the group is the same kind of
  // free-text characteristic (specification 4.1) and there is no list of groups
  // to offer in a select.
  if (query.groupName) {
    filter.groupName = new RegExp(escapeRegExp(query.groupName), "i");
  }

  return filter;
}

/** Sort by the requested field, with `_id` as a stable tiebreaker. */
export function buildUserSort(
  query: AdminUsersQuery,
): Record<string, SortOrder> {
  const order = query.sortOrder === "asc" ? 1 : -1;
  return { [query.sortBy]: order, _id: order };
}
