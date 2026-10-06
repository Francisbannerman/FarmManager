import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSession, login as apiLogin, logout as apiLogout, register as apiRegister, subscribeSession } from "../api/client";
import type { CurrentUser } from "../api/types";

interface AuthState {
  user: CurrentUser | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, fullName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(() => getSession()?.user ?? null);

  // Follows sign-in/out in this tab, token-refresh failures, and other tabs.
  useEffect(() => subscribeSession(s => setUser(s?.user ?? null)), []);

  const login = useCallback((email: string, password: string) => apiLogin(email, password), []);
  const register = useCallback((email: string, fullName: string, password: string) => apiRegister(email, fullName, password), []);
  const logout = useCallback(() => apiLogout(), []);

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
