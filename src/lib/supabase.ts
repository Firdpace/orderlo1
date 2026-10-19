import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
)?.trim();

/** True when Vite env has both Supabase URL and anon key. */
export function isCloudAuthConfigured(): boolean {
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

/** Lazily create the browser client. Returns null if env is missing. */
export function getSupabase(): SupabaseClient | null {
  if (!isCloudAuthConfigured()) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
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
