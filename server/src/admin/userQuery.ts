import type { AdminUsersQuery } from "@lms/shared";
import type { FilterQuery, SortOrder, Types } from "mongoose";

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

/**
 * The user filter of the statistics page (specification 7.15). Two of the
 * three filters narrow the table before pagination without any progress being
 * computed: the group is a field of the user, and the course is resolved to
 * the users it is assigned to by one `distinct` over the assignments. The
 * third, `learningStatus`, is derived from progress and cannot be applied this
 * way — it waits for the pagination to move inside one pipeline.
 *
 * `assignedUserIds` is `undefined` when no course was asked for, and an empty
 * array when the course has no assignment at all: an empty `$in` is the right
 * answer there, not "no filter".
 */
export function buildStatisticsUserFilter(query: {
  groupName?: string;
  assignedUserIds?: Types.ObjectId[];
}): FilterQuery<UserAttributes> {
  const filter: FilterQuery<UserAttributes> = {};

  // A substring, exactly as `/admin/users` reads the same free-text field, so
  // the same typed group finds the same people on both administrative pages.
  if (query.groupName) {
    filter.groupName = new RegExp(escapeRegExp(query.groupName), "i");
  }

  if (query.assignedUserIds !== undefined) {
    filter._id = { $in: query.assignedUserIds };
  }

  return filter;
}
