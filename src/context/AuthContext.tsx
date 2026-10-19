import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEFAULT_ADMIN_PIN } from "../data/seed";

const PIN_KEY = "orderlo-admin-pin";
const SESSION_KEY = "orderlo-admin-session";

type AuthContextValue = {
  isAdmin: boolean;
  login: (pin: string) => boolean;
  logout: () => void;
  changePin: (current: string, next: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadPin() {
  return localStorage.getItem(PIN_KEY) || DEFAULT_ADMIN_PIN;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(
    () => sessionStorage.getItem(SESSION_KEY) === "1",
  );

  const value = useMemo<AuthContextValue>(() => {
    const login = (pin: string) => {
      if (pin.trim() === loadPin()) {
        sessionStorage.setItem(SESSION_KEY, "1");
        setIsAdmin(true);
        return true;
      }
      return false;
    };

    const logout = () => {
      sessionStorage.removeItem(SESSION_KEY);
      setIsAdmin(false);
    };

    const changePin = (current: string, next: string) => {
      if (current !== loadPin() || next.trim().length < 4) return false;
      localStorage.setItem(PIN_KEY, next.trim());
      return true;
    };

    return { isAdmin, login, logout, changePin };
  }, [isAdmin]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
