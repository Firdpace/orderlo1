import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const rawAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
)?.trim();

/** Fetch Authorization headers require ISO-8859-1; we require ASCII-only. */
function isAsciiOnly(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 0x7f) return false;
  }
  return true;
}

function isValidSupabaseUrl(value: string | undefined): value is string {
  if (!value || !isAsciiOnly(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Anon / publishable keys must be ASCII-only and look like a real key.
 * JWT anon keys start with `eyJ`; newer publishable keys start with `sb_`.
 * Reject placeholders with ellipsis / CJK — those crash `fetch` via headers.
 */
function isValidAnonKey(value: string | undefined): value is string {
  if (!value || !isAsciiOnly(value)) return false;
  return value.startsWith("eyJ") || value.startsWith("sb_");
}

let warnedInvalidConfig = false;

function warnInvalidConfigOnce(reason: string): void {
  if (warnedInvalidConfig) return;
  warnedInvalidConfig = true;
  console.warn(
    `[orderlo] Cloud auth disabled — ${reason}. Falling back to local auth.`,
  );
}

/**
 * True when Vite env has a usable Supabase URL and anon key.
 * Missing or placeholder/non-ASCII values count as not configured.
 */
export function isCloudAuthConfigured(): boolean {
  const hasAnyEnv = Boolean(rawUrl || rawAnonKey);
  if (!isValidSupabaseUrl(rawUrl)) {
    if (hasAnyEnv) {
      warnInvalidConfigOnce(
        "VITE_SUPABASE_URL is missing or invalid (need an http(s) ASCII URL)",
      );
    }
    return false;
  }
  if (!isValidAnonKey(rawAnonKey)) {
    if (hasAnyEnv) {
      warnInvalidConfigOnce(
        "VITE_SUPABASE_ANON_KEY is missing or invalid (ASCII only; must start with eyJ or sb_)",
      );
    }
    return false;
  }
  return true;
}

const url = isValidSupabaseUrl(rawUrl) ? rawUrl : undefined;
const anonKey = isValidAnonKey(rawAnonKey) ? rawAnonKey : undefined;

let client: SupabaseClient | null = null;

/** Lazily create the browser client. Returns null if env is missing/invalid. */
export function getSupabase(): SupabaseClient | null {
  if (!isCloudAuthConfigured() || !url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "orderlo.supabase.auth",
      },
    });
  }
  return client;
}
