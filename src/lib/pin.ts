/**
 * Site admin PIN (protects Admin tools). Default `1234`.
 * App unlock is account login (HK phone + password) — see lib/auth.ts.
 */

export const PIN_STORAGE_KEY = "orderlo.pin.v1";
/** Session flag after admin PIN verified this tab. */
export const ADMIN_PIN_SESSION_KEY = "orderlo.admin.pin.session";

export const DEFAULT_PIN = "1234";

export type PinRecord = { pin: string };

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function removeSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function isValidPin(value: string): boolean {
  return /^\d{4}$/.test(value);
}

export async function loadPin(): Promise<string> {
  const raw = readLocal(PIN_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PinRecord;
      if (isValidPin(parsed.pin)) return parsed.pin;
    } catch {
      // fall through
    }
  }
  await savePin(DEFAULT_PIN);
  return DEFAULT_PIN;
}

export async function savePin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error("PIN 必須為 4 位數字");
  writeLocal(PIN_STORAGE_KEY, JSON.stringify({ pin } satisfies PinRecord));
}

export function readAdminPinSession(): boolean {
  return readSession(ADMIN_PIN_SESSION_KEY) === "1";
}

export function writeAdminPinSession(ok: boolean): void {
  if (ok) writeSession(ADMIN_PIN_SESSION_KEY, "1");
  else removeSession(ADMIN_PIN_SESSION_KEY);
}

export async function verifyAdminPin(draft: string): Promise<boolean> {
  if (!isValidPin(draft)) return false;
  const expected = await loadPin();
  if (draft !== expected) return false;
  writeAdminPinSession(true);
  return true;
}

export async function changeAdminPin(
  current: string,
  next: string,
): Promise<boolean> {
  if (!isValidPin(current) || !isValidPin(next)) return false;
  const expected = await loadPin();
  if (current !== expected) return false;
  await savePin(next);
  return true;
}
