import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  type LocalUser,
  listUsers,
  login as authLogin,
  logout as authLogout,
  resolveSessionUser,
  setUserEnabled as authSetEnabled,
  signup as authSignup,
} from "../lib/auth";
import {
  changeAdminPin,
  readAdminPinSession,
  verifyAdminPin,
  writeAdminPinSession,
} from "../lib/pin";

type AuthContextValue = {
  ready: boolean;
  user: LocalUser | null;
  /** Admin PIN unlocked for this browser tab (Admin tools). */
  adminUnlocked: boolean;
  login: (phone: string, password: string) => Promise<void>;
  signup: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUsers: () => Promise<LocalUser[]>;
  setUserEnabled: (userId: string, enabled: boolean) => Promise<LocalUser[]>;
  unlockAdmin: (pin: string) => Promise<boolean>;
  lockAdmin: () => void;
  changePin: (current: string, next: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<LocalUser | null>(null);
  const [adminUnlocked, setAdminUnlocked] = useState(
    () => readAdminPinSession(),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await resolveSessionUser();
        if (!cancelled) setUser(u);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    const u = await authLogin(phone, password);
    setUser(u);
  }, []);

  const signup = useCallback(async (phone: string, password: string) => {
    const u = await authSignup(phone, password);
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    authLogout();
    writeAdminPinSession(false);
    setAdminUnlocked(false);
    setUser(null);
  }, []);

  const refreshUsers = useCallback(() => listUsers(), []);

  const setUserEnabled = useCallback(
    async (userId: string, enabled: boolean) => {
      const users = await authSetEnabled(userId, enabled);
      setUser((prev) => {
        if (!prev) return prev;
        const updated = users.find((u) => u.id === prev.id);
        if (updated && !updated.enabled) {
          authLogout();
          writeAdminPinSession(false);
          setAdminUnlocked(false);
          return null;
        }
        return updated ?? prev;
      });
      return users;
    },
    [],
  );

  const unlockAdmin = useCallback(async (pin: string) => {
    const ok = await verifyAdminPin(pin);
    setAdminUnlocked(ok);
    return ok;
  }, []);

  const lockAdmin = useCallback(() => {
    writeAdminPinSession(false);
    setAdminUnlocked(false);
  }, []);

  const changePin = useCallback(async (current: string, next: string) => {
    return changeAdminPin(current, next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      adminUnlocked,
      login,
      signup,
      logout,
      refreshUsers,
      setUserEnabled,
      unlockAdmin,
      lockAdmin,
      changePin,
    }),
    [
      ready,
      user,
      adminUnlocked,
      login,
      signup,
      logout,
      refreshUsers,
      setUserEnabled,
      unlockAdmin,
      lockAdmin,
      changePin,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
