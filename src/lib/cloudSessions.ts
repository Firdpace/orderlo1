import { getSupabase, isCloudAuthConfigured } from "./supabase";
import { currentUserAgent, labelFromUserAgent } from "./deviceLabel";

/** Persisted device-session id (survives tab close; one per browser profile). */
export const DEVICE_SESSION_KEY = "orderlo.device.session.v1";

export type CloudSession = {
  id: string;
  userId: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string | null;
  label: string | null;
  revokedAt: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  created_at: string;
  last_seen_at: string;
  user_agent: string | null;
  label: string | null;
  revoked_at: string | null;
};

function mapRow(row: SessionRow): CloudSession {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    userAgent: row.user_agent,
    label: row.label,
    revokedAt: row.revoked_at,
  };
}

export function readDeviceSessionId(): string | null {
  try {
    const raw = localStorage.getItem(DEVICE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string };
    return parsed.id ?? null;
  } catch {
    return null;
  }
}

export function writeDeviceSessionId(id: string | null): void {
  try {
    if (!id) localStorage.removeItem(DEVICE_SESSION_KEY);
    else localStorage.setItem(DEVICE_SESSION_KEY, JSON.stringify({ id }));
  } catch {
    // ignore
  }
}

export async function createDeviceSession(userId: string): Promise<CloudSession> {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud auth is not configured.");

  const ua = currentUserAgent();
  const label = labelFromUserAgent(ua);
  const { data, error } = await sb
    .from("sessions")
    .insert({
      user_id: userId,
      user_agent: ua || null,
      label,
      last_seen_at: new Date().toISOString(),
    })
    .select(
      "id, user_id, created_at, last_seen_at, user_agent, label, revoked_at",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "無法建立登入工作階段。");
  }

  const session = mapRow(data as SessionRow);
  writeDeviceSessionId(session.id);
  return session;
}

export async function heartbeatDeviceSession(
  sessionId: string,
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { data, error } = await sb
    .from("sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", sessionId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) return false;
  return true;
}

/** Returns active (non-revoked) session, or null. */
export async function fetchActiveSession(
  sessionId: string,
): Promise<CloudSession | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data, error } = await sb
    .from("sessions")
    .select(
      "id, user_id, created_at, last_seen_at, user_agent, label, revoked_at",
    )
    .eq("id", sessionId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data) return null;
  return mapRow(data as SessionRow);
}

export async function listSessionsForUser(
  userId: string,
): Promise<CloudSession[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("sessions")
    .select(
      "id, user_id, created_at, last_seen_at, user_agent, label, revoked_at",
    )
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });

  if (error || !data) return [];
  return (data as SessionRow[]).map(mapRow);
}

/** Soft-revoke: sets revoked_at. Client heartbeat will force logout. */
export async function revokeSession(sessionId: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Cloud auth is not configured.");

  const { error } = await sb
    .from("sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", sessionId);

  if (error) throw new Error(error.message);
}

export function cloudSessionsAvailable(): boolean {
  return isCloudAuthConfigured();
}
