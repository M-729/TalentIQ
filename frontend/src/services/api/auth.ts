import { apiClient } from "@/services/api/client";
import type { AuthUser, LoginResponse } from "@/types/auth";

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>("/auth/login", { email, password });
}

// Uses the httpOnly refresh cookie to silently re-establish a session
// (e.g. on page load). Expected to fail (reject) when there is no valid
// session yet — callers should treat that as "not logged in", not an error.
export function refresh(): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>("/auth/refresh");
}

export function logout(): Promise<void> {
  return apiClient.post<void>("/auth/logout");
}

export function me(): Promise<{ user: AuthUser }> {
  return apiClient.get<{ user: AuthUser }>("/auth/me");
}
