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
  type UserStatus,
  changePassword as authChangePassword,
  ensureSeedUsers,
  listUsers,
  login as authLogin,
  logout as authLogout,
  resolveSessionUser,
  setUserStatus as authSetStatus,
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
  /** Returns the created user; pending signups stay logged out. */
  signup: (phone: string, password: string) => Promise<LocalUser>;
  logout: () => void;
  refreshUsers: () => Promise<LocalUser[]>;
  setUserStatus: (userId: string, status: UserStatus) => Promise<LocalUser[]>;
  setUserEnabled: (userId: string, enabled: boolean) => Promise<LocalUser[]>;
  changePassword: (
    currentPassword: string,
    nextPassword: string,
  ) => Promise<void>;
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
        await ensureSeedUsers();
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
    // Pending accounts are not auto-logged-in.
    return u;
  }, []);

  const logout = useCallback(() => {
    authLogout();
    writeAdminPinSession(false);
    setAdminUnlocked(false);
    setUser(null);
  }, []);

  const refreshUsers = useCallback(() => listUsers(), []);

  const setUserStatus = useCallback(
    async (userId: string, status: UserStatus) => {
      const users = await authSetStatus(userId, status);
      setUser((prev) => {
        if (!prev) return prev;
        const updated = users.find((u) => u.id === prev.id);
        if (updated && updated.status !== "enabled") {
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

  const setUserEnabled = useCallback(
    async (userId: string, enabled: boolean) => {
      return setUserStatus(userId, enabled ? "enabled" : "disabled");
    },
    [setUserStatus],
  );

  const changePassword = useCallback(
    async (currentPassword: string, nextPassword: string) => {
      if (!user) throw new Error("請先登入。");
      await authChangePassword(user.id, currentPassword, nextPassword);
    },
    [user],
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
      setUserStatus,
      setUserEnabled,
      changePassword,
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
      setUserStatus,
      setUserEnabled,
      changePassword,
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
