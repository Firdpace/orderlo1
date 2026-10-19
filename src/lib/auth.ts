/** Local-first user registry (Phase 0). Vite / localStorage. */

export const USERS_STORAGE_KEY = "orderlo.users.v1";
/** Tab session for logged-in user id. */
export const AUTH_SESSION_KEY = "orderlo.auth.session.v1";

export type LocalUser = {
  id: string;
  /** E.164, e.g. +85291234567 */
  phoneE164: string;
  /** Salted hash — never store plaintext. */
  passwordHash: string;
  salt: string;
  enabled: boolean;
  /** First registered user is admin. */
  isAdmin: boolean;
  createdAt: string;
};

export type UsersRegistry = {
  users: LocalUser[];
};

export type AuthSession = {
  userId: string;
};

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function readStorage(key: string, store: "local" | "session"): string | null {
  try {
    const storage = store === "session" ? sessionStorage : localStorage;
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string, store: "local" | "session"): void {
  try {
    const storage = store === "session" ? sessionStorage : localStorage;
    storage.setItem(key, value);
  } catch {
    // ignore quota / private mode
  }
}

function removeStorage(key: string, store: "local" | "session"): void {
  try {
    const storage = store === "session" ? sessionStorage : localStorage;
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Accept 8 HK digits, optional +852 / 852 prefix → +852XXXXXXXX */
export function normalizeHkPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  let eight = digits;
  if (digits.length === 11 && digits.startsWith("852")) eight = digits.slice(3);
  else if (digits.length === 8) eight = digits;
  else return null;
  if (!/^\d{8}$/.test(eight)) return null;
  return `+852${eight}`;
}

export function displayPhone(phoneE164: string): string {
  return phoneE164.replace(/^\+852/, "+852 ");
}

/** Light hash (SHA-256 when available, else iterative fallback). Not backend-grade. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const payload = `${salt}:${password}:orderlo`;
  if (typeof crypto !== "undefined" && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(payload),
      );
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {
      // fall through
    }
  }
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = (h >>> 0).toString(16);
  for (let round = 0; round < 64; round++) {
    h = Math.imul(h ^ round, 16777619) >>> 0;
    out += h.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

function makeSalt(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function loadUsers(): Promise<UsersRegistry> {
  const raw = readStorage(USERS_STORAGE_KEY, "local");
  if (!raw) return { users: [] };
  try {
    const parsed = JSON.parse(raw) as UsersRegistry;
    return { users: Array.isArray(parsed.users) ? parsed.users : [] };
  } catch {
    return { users: [] };
  }
}

async function saveUsers(registry: UsersRegistry): Promise<void> {
  writeStorage(USERS_STORAGE_KEY, JSON.stringify(registry), "local");
}

export function readAuthSession(): AuthSession | null {
  const raw = readStorage(AUTH_SESSION_KEY, "session");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed.userId ? parsed : null;
  } catch {
    return null;
  }
}

export function writeAuthSession(session: AuthSession | null): void {
  if (!session) removeStorage(AUTH_SESSION_KEY, "session");
  else writeStorage(AUTH_SESSION_KEY, JSON.stringify(session), "session");
}

export async function signup(phoneInput: string, password: string): Promise<LocalUser> {
  const phoneE164 = normalizeHkPhone(phoneInput);
  if (!phoneE164) throw new Error("請輸入有效香港手機號碼（8 位數字）。");
  if (password.length < 4) throw new Error("密碼最少 4 個字元。");

  const registry = await loadUsers();
  if (registry.users.some((u) => u.phoneE164 === phoneE164)) {
    throw new Error("此號碼已註冊，請直接登入。");
  }

  const salt = makeSalt();
  const passwordHash = await hashPassword(password, salt);
  const user: LocalUser = {
    id: uid("u"),
    phoneE164,
    passwordHash,
    salt,
    enabled: true,
    isAdmin: registry.users.length === 0,
    createdAt: new Date().toISOString(),
  };
  registry.users.push(user);
  await saveUsers(registry);
  writeAuthSession({ userId: user.id });
  return user;
}

export async function login(phoneInput: string, password: string): Promise<LocalUser> {
  const phoneE164 = normalizeHkPhone(phoneInput);
  if (!phoneE164) throw new Error("請輸入有效香港手機號碼（8 位數字）。");

  const registry = await loadUsers();
  const user = registry.users.find((u) => u.phoneE164 === phoneE164);
  if (!user) throw new Error("此號碼尚未註冊，請先註冊。");
  if (!user.enabled) throw new Error("此帳戶已被停用，請聯絡管理員。");

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) throw new Error("密碼不正確。");

  writeAuthSession({ userId: user.id });
  return user;
}

export function logout(): void {
  writeAuthSession(null);
}

export async function resolveSessionUser(): Promise<LocalUser | null> {
  const session = readAuthSession();
  if (!session) return null;
  const registry = await loadUsers();
  const user = registry.users.find((u) => u.id === session.userId);
  if (!user || !user.enabled) {
    writeAuthSession(null);
    return null;
  }
  return user;
}

export async function setUserEnabled(
  userId: string,
  enabled: boolean,
): Promise<LocalUser[]> {
  const registry = await loadUsers();
  registry.users = registry.users.map((u) =>
    u.id === userId ? { ...u, enabled } : u,
  );
  await saveUsers(registry);
  return registry.users;
}

export async function listUsers(): Promise<LocalUser[]> {
  const registry = await loadUsers();
  return registry.users;
}
