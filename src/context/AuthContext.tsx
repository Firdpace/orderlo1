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
  changePassword as localChangePassword,
  ensureSeedUsers,
  listUsers as localListUsers,
  login as localLogin,
  logout as localLogout,
  resolveSessionUser as localResolveSession,
  setUserStatus as localSetStatus,
  signup as localSignup,
} from "../lib/auth";
import {
  cloudChangePassword,
  cloudLogin,
  cloudLogout,
  cloudSignup,
  listCloudUsers,
  resolveCloudSessionUser,
  setCloudUserStatus,
} from "../lib/cloudAuth";
import {
  heartbeatDeviceSession,
  readDeviceSessionId,
} from "../lib/cloudSessions";
import {
  changeAdminPin,
  readAdminPinSession,
  verifyAdminPin,
  writeAdminPinSession,
} from "../lib/pin";
import { isCloudAuthConfigured } from "../lib/supabase";

type AuthContextValue = {
  ready: boolean;
  user: LocalUser | null;
  /** True when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY look valid. */
  cloudAuthConfigured: boolean;
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
  const cloudAuthConfigured = isCloudAuthConfigured();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<LocalUser | null>(null);
  const [adminUnlocked, setAdminUnlocked] = useState(
    () => readAdminPinSession(),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Always ensure local seed registry (bridge + offline fallback).
        await ensureSeedUsers();
        if (cloudAuthConfigured) {
          const u = await resolveCloudSessionUser();
          if (!cancelled) setUser(u);
        } else {
          const u = await localResolveSession();
          if (!cancelled) setUser(u);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cloudAuthConfigured]);

  // Heartbeat last_seen on load + periodic while cloud session is active.
  useEffect(() => {
    if (!cloudAuthConfigured || !user) return;
    const tick = () => {
      const id = readDeviceSessionId();
      if (!id) return;
      void heartbeatDeviceSession(id).then((ok) => {
        if (!ok) {
          void cloudLogout().then(() => {
            writeAdminPinSession(false);
            setAdminUnlocked(false);
            setUser(null);
          });
        }
      });
    };
    tick();
    const handle = window.setInterval(tick, 60_000);
    return () => window.clearInterval(handle);
  }, [cloudAuthConfigured, user]);

  const login = useCallback(
    async (phone: string, password: string) => {
      if (cloudAuthConfigured) {
        const u = await cloudLogin(phone, password);
        setUser(u);
        return;
      }
      const u = await localLogin(phone, password);
      setUser(u);
    },
    [cloudAuthConfigured],
  );

  const signup = useCallback(
    async (phone: string, password: string) => {
      if (cloudAuthConfigured) {
        const u = await cloudSignup(phone, password);
        // Mirror into local registry for offline bridge later.
        try {
          await localSignup(phone, password);
        } catch {
          // already exists locally — fine
        }
        return u;
      }
      return localSignup(phone, password);
    },
    [cloudAuthConfigured],
  );

  const logout = useCallback(() => {
    if (cloudAuthConfigured) {
      void cloudLogout();
    } else {
      localLogout();
    }
    writeAdminPinSession(false);
    setAdminUnlocked(false);
    setUser(null);
  }, [cloudAuthConfigured]);

  const refreshUsers = useCallback(async () => {
    if (cloudAuthConfigured) return listCloudUsers();
    return localListUsers();
  }, [cloudAuthConfigured]);

  const setUserStatus = useCallback(
    async (userId: string, status: UserStatus) => {
      const users = cloudAuthConfigured
        ? await setCloudUserStatus(userId, status)
        : await localSetStatus(userId, status);

      // Keep local mirror when cloud is on (best effort).
      if (cloudAuthConfigured) {
        try {
          await localSetStatus(userId, status);
        } catch {
          // local ids may differ — ignore
        }
      }

      setUser((prev) => {
        if (!prev) return prev;
        const updated = users.find((u) => u.id === prev.id);
        if (updated && updated.status !== "enabled") {
          if (cloudAuthConfigured) void cloudLogout();
          else localLogout();
          writeAdminPinSession(false);
          setAdminUnlocked(false);
          return null;
        }
        return updated ?? prev;
      });
      return users;
    },
    [cloudAuthConfigured],
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
      if (cloudAuthConfigured) {
        await cloudChangePassword(currentPassword, nextPassword);
        return;
      }
      await localChangePassword(user.id, currentPassword, nextPassword);
    },
    [user, cloudAuthConfigured],
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
      cloudAuthConfigured,
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
      cloudAuthConfigured,
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
