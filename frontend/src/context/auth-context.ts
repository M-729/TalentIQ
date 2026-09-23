import { createContext } from "react";
import type { AuthUser } from "@/types/auth";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  // True only during the initial silent-refresh attempt on app load.
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  // Creates a brand-new Company + its first (ADMIN) User, then
  // authenticates exactly like login() — same in-memory access token /
  // httpOnly refresh cookie mechanism, no second auth system.
  signup: (input: { fullName: string; email: string; password: string; companyName: string }) => Promise<void>;
  // Establishes a session from an access token + user the caller already
  // obtained from a successful backend response (currently: a successful
  // Accept Invitation) — no second network round trip, no second auth
  // mechanism, just the same in-memory-token/context-state assignment
  // login()/signup() already do internally.
  hydrateSession: (accessToken: string, user: AuthUser) => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
