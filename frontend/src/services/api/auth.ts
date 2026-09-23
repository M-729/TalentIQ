import { apiClient } from "@/services/api/client";
import type { AuthUser, LoginResponse } from "@/types/auth";

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>("/auth/login", { email, password });
}

export interface CompanySignupInput {
  fullName: string;
  email: string;
  password: string;
  companyName: string;
}

// Same response shape as login() — a successful signup returns the same
// access token + safe user, since the backend auto-authenticates the new
// ADMIN via the exact same mechanism (see auth.service.ts's signupCompany).
export function companySignup(input: CompanySignupInput): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>("/auth/company-signup", {
    full_name: input.fullName,
    email: input.email,
    password: input.password,
    company_name: input.companyName,
  });
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
