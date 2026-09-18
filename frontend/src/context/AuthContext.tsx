import { useEffect, useState, type ReactNode } from "react";
import * as authApi from "@/services/api/auth";
import { setAccessToken } from "@/services/api/client";
import type { AuthUser } from "@/types/auth";
import { AuthContext, type AuthContextValue } from "@/context/auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On load there is no access token yet (it's kept in memory only, so a
  // page refresh loses it). Try once to silently re-establish a session
  // from the httpOnly refresh cookie; a failure here just means "logged
  // out", not an error to surface to the user.
  useEffect(() => {
    let cancelled = false;

    authApi
      .refresh()
      .then(({ accessToken, user: refreshedUser }) => {
        if (cancelled) return;
        setAccessToken(accessToken);
        setUser(refreshedUser);
      })
      .catch(() => {
        if (cancelled) return;
        setAccessToken(null);
        setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const { accessToken, user: loggedInUser } = await authApi.login(email, password);
    setAccessToken(accessToken);
    setUser(loggedInUser);
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      // Always clear local state, even if the network call failed — the
      // user should never be stuck "looking" logged in on this device.
      setAccessToken(null);
      setUser(null);
    }
  };

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
