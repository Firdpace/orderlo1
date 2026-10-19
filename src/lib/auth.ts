/** Local-first user registry (Phase 0). Vite / localStorage. */

export const USERS_STORAGE_KEY = "orderlo.users.v1";
/** Tab session for logged-in user id. */
export const AUTH_SESSION_KEY = "orderlo.auth.session.v1";

/** Sole admin phone (E.164). */
export const ADMIN_PHONE_E164 = "+85266169905";
/** Seeded non-admin phone (E.164). */
export const SEED_USER_PHONE_E164 = "+85292209785";
/** Default password only used when seeding a fresh admin account. */
export const ADMIN_SEED_PASSWORD = "orderlo";
/** Shared password for seeded non-admin accounts (user-provided). */
export const SEED_USER_PASSWORD = "0000";

/** Extra approved non-admin seed phones (8 HK digits → +852…). */
export const SEED_USER_PHONES_E164: readonly string[] = [
  SEED_USER_PHONE_E164,
  "+85264630346",
  "+85290307995",
  "+85263349863",
  "+85253770765",
  "+85264035685",
  "+85262799780",
  "+85266791504",
  "+85298842619",
  "+85290158244",
];

export type UserStatus = "pending" | "enabled" | "disabled";

export type LocalUser = {
  id: string;
  /** E.164, e.g. +85291234567 */
  phoneE164: string;
  /** Salted hash — never store plaintext. */
  passwordHash: string;
  salt: string;
  /** pending = awaiting admin approval; enabled = can use app; disabled = blocked. */
  status: UserStatus;
  /** Only +85266169905 may be admin. */
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

export function isUserActive(user: LocalUser): boolean {
  return user.status === "enabled";
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

type LegacyUser = Partial<LocalUser> & {
  enabled?: boolean;
};

function migrateUser(raw: LegacyUser): LocalUser | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.phoneE164 !== "string") {
    return null;
  }
  let status: UserStatus = "enabled";
  if (raw.status === "pending" || raw.status === "enabled" || raw.status === "disabled") {
    status = raw.status;
  } else if (typeof raw.enabled === "boolean") {
    status = raw.enabled ? "enabled" : "disabled";
  }
  const isAdminPhone = raw.phoneE164 === ADMIN_PHONE_E164;
  return {
    id: raw.id,
    phoneE164: raw.phoneE164,
    passwordHash: typeof raw.passwordHash === "string" ? raw.passwordHash : "",
    salt: typeof raw.salt === "string" ? raw.salt : makeSalt(),
    status: isAdminPhone && status === "pending" ? "enabled" : status,
    isAdmin: isAdminPhone,
    createdAt:
      typeof raw.createdAt === "string" ? raw.createdAt : new Date().toISOString(),
  };
}

async function createUserRecord(args: {
  phoneE164: string;
  password: string;
  status: UserStatus;
  isAdmin: boolean;
}): Promise<LocalUser> {
  const salt = makeSalt();
  const passwordHash = await hashPassword(args.password, salt);
  return {
    id: uid("u"),
    phoneE164: args.phoneE164,
    passwordHash,
    salt,
    status: args.status,
    isAdmin: args.isAdmin,
    createdAt: new Date().toISOString(),
  };
}

async function saveUsers(registry: UsersRegistry): Promise<void> {
  writeStorage(USERS_STORAGE_KEY, JSON.stringify(registry), "local");
}

/**
 * Migrate legacy registry, enforce sole admin, seed admin + second account.
 * Returns whether a fresh admin password was set (caller may document it).
 */
export async function ensureSeedUsers(): Promise<{
  users: LocalUser[];
  adminCreatedFresh: boolean;
}> {
  const raw = readStorage(USERS_STORAGE_KEY, "local");
  let users: LocalUser[] = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { users?: LegacyUser[] };
      users = (Array.isArray(parsed.users) ? parsed.users : [])
        .map(migrateUser)
        .filter((u): u is LocalUser => u !== null);
    } catch {
      users = [];
    }
  }

  // Enforce sole admin flag by phone.
  users = users.map((u) => ({
    ...u,
    isAdmin: u.phoneE164 === ADMIN_PHONE_E164,
    status:
      u.phoneE164 === ADMIN_PHONE_E164 && u.status === "pending"
        ? "enabled"
        : u.status,
  }));

  let adminCreatedFresh = false;
  let admin = users.find((u) => u.phoneE164 === ADMIN_PHONE_E164);
  if (!admin) {
    admin = await createUserRecord({
      phoneE164: ADMIN_PHONE_E164,
      password: ADMIN_SEED_PASSWORD,
      status: "enabled",
      isAdmin: true,
    });
    users.push(admin);
    adminCreatedFresh = true;
  } else if (!admin.isAdmin || admin.status !== "enabled") {
    admin = { ...admin, isAdmin: true, status: "enabled" };
    users = users.map((u) => (u.id === admin!.id ? admin! : u));
  }

  for (const phoneE164 of SEED_USER_PHONES_E164) {
    if (phoneE164 === ADMIN_PHONE_E164) continue;
    const existing = users.find((u) => u.phoneE164 === phoneE164);
    if (!existing) {
      users.push(
        await createUserRecord({
          phoneE164,
          password: SEED_USER_PASSWORD,
          status: "enabled",
          isAdmin: false,
        }),
      );
    } else {
      // Keep existing password; ensure approved + non-admin.
      users = users.map((u) =>
        u.phoneE164 === phoneE164
          ? { ...u, status: "enabled" as const, isAdmin: false }
          : u,
      );
    }
  }

  await saveUsers({ users });
  return { users, adminCreatedFresh };
}

export async function loadUsers(): Promise<UsersRegistry> {
  const { users } = await ensureSeedUsers();
  return { users };
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

  // Admin phone is always seeded; never allow self-signup as admin.
  const user = await createUserRecord({
    phoneE164,
    password,
    status: "pending",
    isAdmin: false,
  });
  registry.users.push(user);
  await saveUsers(registry);
  // Pending accounts stay logged out until approved.
  return user;
}

export async function login(phoneInput: string, password: string): Promise<LocalUser> {
  const phoneE164 = normalizeHkPhone(phoneInput);
  if (!phoneE164) throw new Error("請輸入有效香港手機號碼（8 位數字）。");

  const registry = await loadUsers();
  const user = registry.users.find((u) => u.phoneE164 === phoneE164);
  if (!user) throw new Error("此號碼尚未註冊，請先註冊。");
  if (user.status === "pending") {
    throw new Error("帳戶待審批，請等候管理員批准。");
  }
  if (user.status === "disabled") {
    throw new Error("此帳戶已被停用，請聯絡管理員。");
  }

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) throw new Error("密碼不正確。");

  writeAuthSession({ userId: user.id });
  return user;
}

export function logout(): void {
  writeAuthSession(null);
}

export async function resolveSessionUser(): Promise<LocalUser | null> {
  await ensureSeedUsers();
  const session = readAuthSession();
  if (!session) return null;
  const registry = await loadUsers();
  const user = registry.users.find((u) => u.id === session.userId);
  if (!user || !isUserActive(user)) {
    writeAuthSession(null);
    return null;
  }
  return user;
}

export async function setUserStatus(
  userId: string,
  status: UserStatus,
): Promise<LocalUser[]> {
  const registry = await loadUsers();
  const target = registry.users.find((u) => u.id === userId);
  if (target?.phoneE164 === ADMIN_PHONE_E164 && status !== "enabled") {
    // Never disable the sole admin via UI.
    return registry.users;
  }
  registry.users = registry.users.map((u) => {
    if (u.id !== userId) return u;
    return {
      ...u,
      status,
      isAdmin: u.phoneE164 === ADMIN_PHONE_E164,
    };
  });
  await saveUsers(registry);
  return registry.users;
}

/** @deprecated Prefer setUserStatus. Kept for call-site clarity (enable/disable). */
export async function setUserEnabled(
  userId: string,
  enabled: boolean,
): Promise<LocalUser[]> {
  return setUserStatus(userId, enabled ? "enabled" : "disabled");
}

export async function listUsers(): Promise<LocalUser[]> {
  const registry = await loadUsers();
  return registry.users;
}

/** Change password for the logged-in user (current + new + confirm). */
export async function changePassword(
  userId: string,
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  if (nextPassword.length < 4) throw new Error("新密碼最少 4 個字元。");
  const registry = await loadUsers();
  const user = registry.users.find((u) => u.id === userId);
  if (!user) throw new Error("找不到帳戶。");

  const currentHash = await hashPassword(currentPassword, user.salt);
  if (currentHash !== user.passwordHash) {
    throw new Error("現有密碼不正確。");
  }

  const salt = makeSalt();
  const passwordHash = await hashPassword(nextPassword, salt);
  registry.users = registry.users.map((u) =>
    u.id === userId ? { ...u, salt, passwordHash } : u,
  );
  await saveUsers(registry);
}

export function statusLabel(status: UserStatus): string {
  switch (status) {
    case "pending":
      return "待審批";
    case "enabled":
      return "已啟用";
    case "disabled":
      return "已停用";
  }
}
