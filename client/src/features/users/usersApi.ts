import type {
  AdminUpdateUserBody,
  AdminUserDetail,
  AdminUserListItem,
  AdminUsersQuery,
  Assignment,
  CreateAssignmentBody,
  ListResponse,
} from "@lms/shared";

import { apiRequest } from "../../api/client";
import { toSearchParams } from "./adminUsersQueryParams";

export function requestAdminUsers(
  query: AdminUsersQuery,
): Promise<ListResponse<AdminUserListItem>> {
  return apiRequest(`/admin/users?${toSearchParams(query).toString()}`);
}

export function requestAdminUser(userId: string): Promise<AdminUserDetail> {
  return apiRequest(`/admin/users/${userId}`);
}

export function requestAdminUserUpdate(
  userId: string,
  body: AdminUpdateUserBody,
): Promise<AdminUserDetail> {
  return apiRequest(`/admin/users/${userId}`, { method: "PATCH", body });
}

export function requestAssignmentCreate(
  userId: string,
  body: CreateAssignmentBody,
): Promise<Assignment> {
  return apiRequest(`/admin/users/${userId}/assignments`, {
    method: "POST",
    body,
  });
}

export function requestAssignmentRevoke(
  userId: string,
  assignmentId: string,
): Promise<Assignment> {
  return apiRequest(`/admin/users/${userId}/assignments/${assignmentId}`, {
    method: "DELETE",
  });
}
