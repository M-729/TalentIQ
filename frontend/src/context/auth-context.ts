import { createContext } from "react";
import type { AuthUser } from "@/types/auth";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  // True only during the initial silent-refresh attempt on app load.
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
