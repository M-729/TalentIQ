// Mirrors backend SafeUser (backend/src/modules/auth/auth.service.ts) and
// User.model.ts's role enum. Keep in sync if the backend shape changes.
export type UserRole = "HR" | "ADMIN";
export type UserStatus = "active" | "invited" | "disabled";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  companyId: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}
