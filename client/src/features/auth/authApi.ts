import type {
  ChangePasswordBody,
  LoginBody,
  RegisterBody,
  SessionResponse,
  UpdateProfileBody,
} from "@lms/shared";

import { apiRequest } from "../../api/client";

export function requestSession(): Promise<SessionResponse> {
  return apiRequest<SessionResponse>("/auth/me");
}

export function requestLogin(body: LoginBody): Promise<SessionResponse> {
  return apiRequest<SessionResponse>("/auth/login", { method: "POST", body });
}

export function requestRegister(body: RegisterBody): Promise<SessionResponse> {
  return apiRequest<SessionResponse>("/auth/register", {
    method: "POST",
    body,
  });
}

export function requestLogout(): Promise<void> {
  return apiRequest<void>("/auth/logout", { method: "POST" });
}

export function requestProfileUpdate(
  body: UpdateProfileBody,
): Promise<SessionResponse> {
  return apiRequest<SessionResponse>("/users/me", { method: "PATCH", body });
}

export function requestPasswordChange(body: ChangePasswordBody): Promise<void> {
  return apiRequest<void>("/users/me/password", { method: "PATCH", body });
}
