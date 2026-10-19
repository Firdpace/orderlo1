/**
 * Supabase Auth bridge for Orderlo.
 * Identity: HK phone +852XXXXXXXX → email alias 852XXXXXXXX@orderlo.local
 */

import {
  ADMIN_PHONE_E164,
  ADMIN_SEED_PASSWORD,
  SEED_USER_PASSWORD,
  SEED_USER_PHONES_E164,
  type LocalUser,
  type UserStatus,
  ensureSeedUsers,
  hashPassword,
  loadUsers,
  normalizeHkPhone,
} from "./auth";
import {
  createDeviceSession,
  fetchActiveSession,
  heartbeatDeviceSession,
  readDeviceSessionId,
  writeDeviceSessionId,
} from "./cloudSessions";
import { listShopsForUser, saveShopsForUser } from "./shops";
import { getSupabase, isCloudAuthConfigured } from "./supabase";
import { loadWaHistory, WA_HISTORY_KEY } from "./waHistory";

export const EMAIL_ALIAS_DOMAIN = "orderlo.local";

export type CloudProfile = {
  id: string;
  phoneE164: string;
  status: UserStatus;
  isAdmin: boolean;
  createdAt: string;
};

type ProfileRow = {
  id: string;
  phone_e164: string;
  status: UserStatus;
  is_admin: boolean;
  created_at: string;
};

export function phoneToEmailAlias(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  return `${digits}@${EMAIL_ALIAS_DOMAIN}`;
}

export function profileToLocalUser(p: CloudProfile): LocalUser {
  return {
    id: p.id,
    phoneE164: p.phoneE164,
    passwordHash: "",
    salt: "",
    status: p.status,
    isAdmin: p.isAdmin,
    createdAt: p.createdAt,
  };
}

function mapProfile(row: ProfileRow): CloudProfile {
  return {
    id: row.id,
    phoneE164: row.phone_e164,
    status: row.status,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
  };
}

/** Move local shops / WA history when user id changes (local → cloud uuid). */
export function migrateLocalUserData(
  fromUserId: string,
  toUserId: string,
): void {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;

  const shops = listShopsForUser(fromUserId);
  if (shops.length > 0 && listShopsForUser(toUserId).length === 0) {
    saveShopsForUser(toUserId, shops);
  }

  try {
    const store = loadWaHistory();
    if (store[fromUserId] && !store[toUserId]) {
      store[toUserId] = store[fromUserId];
      delete store[fromUserId];
      localStorage.setItem(WA_HISTORY_KEY, JSON.stringify(store));
    }
  } catch {
    // ignore
  }
}

async function fetchProfile(userId: string): Promise<CloudProfile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("profiles")
    .select("id, phone_e164, status, is_admin, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return mapProfile(data as ProfileRow);
}

/** Insert own profile if the auth trigger did not create one. */
async function ensureOwnProfile(
  userId: string,
  phoneE164: string,
  status: UserStatus,
): Promise<CloudProfile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const existing = await fetchProfile(userId);
  if (existing) return existing;

  const row = {
    id: userId,
    phone_e164: phoneE164,
    status: phoneE164 === ADMIN_PHONE_E164 ? "enabled" : status,
    is_admin: phoneE164 === ADMIN_PHONE_E164,
  };
  const { error } = await sb.from("profiles").insert(row);
  if (error && !/duplicate|unique/i.test(error.message)) {
    console.warn("ensureOwnProfile", error.message);
  }
  return fetchProfile(userId);
}

async function verifyLocalPassword(
  phoneE164: string,
  password: string,
): Promise<LocalUser | null> {
  const registry = await loadUsers();
  const user = registry.users.find((u) => u.phoneE164 === phoneE164);
  if (!user) return null;
  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) return null;
  return user;
}

async function ensureAuthUser(
  phoneE164: string,
  password: string,
  status: UserStatus,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud auth is not configured.");
  const email = phoneToEmailAlias(phoneE164);

  const { error: signUpError } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone_e164: phoneE164,
        status: phoneE164 === ADMIN_PHONE_E164 ? "enabled" : status,
      },
    },
  });

  // "already registered" is fine — caller will sign in
  if (
    signUpError &&
    !/already|registered|exists/i.test(signUpError.message)
  ) {
    throw new Error(signUpError.message);
  }
}

function assertLoginAllowed(profile: CloudProfile): void {
  if (profile.status === "pending") {
    throw new Error("帳戶待審批，請等候管理員批准。");
  }
  if (profile.status === "disabled") {
    throw new Error("此帳戶已被停用，請聯絡管理員。");
  }
}

export async function cloudSignup(
  phoneInput: string,
  password: string,
): Promise<LocalUser> {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud auth is not configured.");

  const phoneE164 = normalizeHkPhone(phoneInput);
  if (!phoneE164) throw new Error("請輸入有效香港手機號碼（8 位數字）。");
  if (password.length < 4) throw new Error("密碼最少 4 個字元。");
  if (phoneE164 === ADMIN_PHONE_E164) {
    throw new Error("此號碼已保留，請直接登入。");
  }

  const email = phoneToEmailAlias(phoneE164);
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: { phone_e164: phoneE164, status: "pending" },
    },
  });

  if (error) {
    if (/already|registered|exists/i.test(error.message)) {
      throw new Error("此號碼已註冊，請直接登入。");
    }
    throw new Error(error.message);
  }

  // Do not keep a session for pending signups.
  await sb.auth.signOut();
  writeDeviceSessionId(null);

  return {
    id: data.user?.id ?? `pending-${phoneE164}`,
    phoneE164,
    passwordHash: "",
    salt: "",
    status: "pending",
    isAdmin: false,
    createdAt: new Date().toISOString(),
  };
}

export async function cloudLogin(
  phoneInput: string,
  password: string,
): Promise<LocalUser> {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud auth is not configured.");

  const phoneE164 = normalizeHkPhone(phoneInput);
  if (!phoneE164) throw new Error("請輸入有效香港手機號碼（8 位數字）。");

  const email = phoneToEmailAlias(phoneE164);
  let signIn = await sb.auth.signInWithPassword({ email, password });

  if (signIn.error) {
    // Bridge: local account exists with this password → create Auth user.
    const localUser = await verifyLocalPassword(phoneE164, password);
    if (!localUser) {
      // Distinguish unknown vs bad password via local registry when possible.
      const registry = await loadUsers();
      const existsLocal = registry.users.some((u) => u.phoneE164 === phoneE164);
      if (existsLocal) throw new Error("密碼不正確。");
      if (/invalid login|invalid credentials/i.test(signIn.error.message)) {
        throw new Error("此號碼尚未註冊，請先註冊。");
      }
      throw new Error(signIn.error.message);
    }

    if (localUser.status === "pending") {
      throw new Error("帳戶待審批，請等候管理員批准。");
    }
    if (localUser.status === "disabled") {
      throw new Error("此帳戶已被停用，請聯絡管理員。");
    }

    await ensureAuthUser(phoneE164, password, localUser.status);
    signIn = await sb.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.user) {
      throw new Error(signIn.error?.message ?? "登入失敗。");
    }
    migrateLocalUserData(localUser.id, signIn.data.user.id);
  }

  const authUser = signIn.data.user;
  if (!authUser) throw new Error("登入失敗。");

  let profile = await fetchProfile(authUser.id);
  if (!profile) {
    profile = await ensureOwnProfile(
      authUser.id,
      phoneE164,
      phoneE164 === ADMIN_PHONE_E164 ? "enabled" : "enabled",
    );
  }
  if (!profile) throw new Error("找不到帳戶資料。");

  assertLoginAllowed(profile);

  // Best-effort: also migrate if local twin exists.
  const registry = await loadUsers();
  const localTwin = registry.users.find((u) => u.phoneE164 === phoneE164);
  if (localTwin) migrateLocalUserData(localTwin.id, profile.id);

  await createDeviceSession(profile.id);
  return profileToLocalUser(profile);
}

export async function cloudLogout(): Promise<void> {
  const sessionId = readDeviceSessionId();
  const sb = getSupabase();
  if (sb && sessionId) {
    // Soft-revoke this device session (best effort).
    try {
      await sb
        .from("sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("user_id", (await sb.auth.getUser()).data.user?.id ?? "");
    } catch {
      // ignore
    }
  }
  writeDeviceSessionId(null);
  if (sb) await sb.auth.signOut();
}

export async function resolveCloudSessionUser(): Promise<LocalUser | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data } = await sb.auth.getSession();
  const authUser = data.session?.user;
  if (!authUser) {
    writeDeviceSessionId(null);
    return null;
  }

  const deviceId = readDeviceSessionId();
  if (!deviceId) {
    // Auth token present but no device session → create one (upgrade path).
    await createDeviceSession(authUser.id);
  } else {
    const active = await fetchActiveSession(deviceId);
    if (!active) {
      writeDeviceSessionId(null);
      await sb.auth.signOut();
      return null;
    }
    await heartbeatDeviceSession(deviceId);
  }

  const profile = await fetchProfile(authUser.id);
  if (!profile || profile.status !== "enabled") {
    writeDeviceSessionId(null);
    await sb.auth.signOut();
    return null;
  }
  return profileToLocalUser(profile);
}

export async function listCloudUsers(): Promise<LocalUser[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("profiles")
    .select("id, phone_e164, status, is_admin, created_at")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as ProfileRow[]).map((row) =>
    profileToLocalUser(mapProfile(row)),
  );
}

export async function setCloudUserStatus(
  userId: string,
  status: UserStatus,
): Promise<LocalUser[]> {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud auth is not configured.");

  const profile = await fetchProfile(userId);
  if (profile?.phoneE164 === ADMIN_PHONE_E164 && status !== "enabled") {
    return listCloudUsers();
  }

  const { error } = await sb
    .from("profiles")
    .update({
      status,
      is_admin: profile?.phoneE164 === ADMIN_PHONE_E164,
    })
    .eq("id", userId);

  if (error) throw new Error(error.message);
  return listCloudUsers();
}

export async function cloudChangePassword(
  currentPassword: string,
  nextPassword: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud auth is not configured.");
  if (nextPassword.length < 4) throw new Error("新密碼最少 4 個字元。");

  const { data: userData } = await sb.auth.getUser();
  const email = userData.user?.email;
  if (!email) throw new Error("請先登入。");

  const verify = await sb.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verify.error) throw new Error("現有密碼不正確。");

  const { error } = await sb.auth.updateUser({ password: nextPassword });
  if (error) throw new Error(error.message);
}

/**
 * Best-effort client seed: sign up missing seed phones when cloud is on.
 * Requires "Confirm email" disabled in Supabase Auth settings.
 * Prefer scripts/seed-supabase-users.mjs with the service role key.
 */
export async function ensureCloudSeedUsers(): Promise<void> {
  if (!isCloudAuthConfigured()) return;
  const sb = getSupabase();
  if (!sb) return;

  // Keep local registry in sync for bridge / offline.
  await ensureSeedUsers();

  const seeds: { phone: string; password: string; status: UserStatus }[] = [
    {
      phone: ADMIN_PHONE_E164,
      password: ADMIN_SEED_PASSWORD,
      status: "enabled",
    },
    ...SEED_USER_PHONES_E164.map((phone) => ({
      phone,
      password: SEED_USER_PASSWORD,
      status: "enabled" as const,
    })),
  ];

  for (const seed of seeds) {
    try {
      await ensureAuthUser(seed.phone, seed.password, seed.status);
    } catch {
      // ignore — may already exist or email confirm blocked
    }
  }
  // Clear any session created by signUp probes.
  await sb.auth.signOut();
  writeDeviceSessionId(null);
}
