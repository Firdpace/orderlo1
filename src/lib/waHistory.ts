/** WhatsApp order history — per user × per vendor, last 2. */

export const WA_HISTORY_KEY = "orderlo.wa-history.v1";
export const WA_HISTORY_MAX_PER_VENDOR = 2;

export type WaHistoryLine = {
  name: string;
  qty: number;
  subtotal: number;
};

export type WaHistoryEntry = {
  id: string;
  vendorId: string;
  vendorName: string;
  messageText: string;
  lines: WaHistoryLine[];
  total: number;
  createdAt: string;
};

/** userId → vendorId → newest-first entries (max 2). */
export type WaHistoryStore = Record<string, Record<string, WaHistoryEntry[]>>;

function uid(): string {
  return `wa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(WA_HISTORY_KEY);
  } catch {
    return null;
  }
}

function writeStore(store: WaHistoryStore): void {
  try {
    localStorage.setItem(WA_HISTORY_KEY, JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function loadWaHistory(): WaHistoryStore {
  const raw = readRaw();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as WaHistoryStore;
  } catch {
    return {};
  }
}

export function saveWaHistoryEntry(args: {
  userId: string;
  vendorId: string;
  vendorName: string;
  messageText: string;
  lines: WaHistoryLine[];
  total: number;
}): WaHistoryEntry {
  const store = loadWaHistory();
  const byUser = store[args.userId] ?? {};
  const existing = byUser[args.vendorId] ?? [];
  const entry: WaHistoryEntry = {
    id: uid(),
    vendorId: args.vendorId,
    vendorName: args.vendorName,
    messageText: args.messageText,
    lines: args.lines,
    total: args.total,
    createdAt: new Date().toISOString(),
  };
  byUser[args.vendorId] = [entry, ...existing].slice(0, WA_HISTORY_MAX_PER_VENDOR);
  store[args.userId] = byUser;
  writeStore(store);
  return entry;
}

export function listWaHistoryForUser(userId: string): WaHistoryEntry[] {
  const store = loadWaHistory();
  const byUser = store[userId] ?? {};
  const all: WaHistoryEntry[] = [];
  for (const entries of Object.values(byUser)) {
    all.push(...entries);
  }
  return all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function listWaHistoryForVendor(
  userId: string,
  vendorId: string,
): WaHistoryEntry[] {
  const store = loadWaHistory();
  return store[userId]?.[vendorId] ?? [];
}

/** Remove one history entry for this user × vendor. Other vendors untouched. */
export function deleteWaHistoryEntry(args: {
  userId: string;
  vendorId: string;
  entryId: string;
}): boolean {
  const store = loadWaHistory();
  const byUser = store[args.userId];
  if (!byUser) return false;
  const existing = byUser[args.vendorId];
  if (!existing?.length) return false;
  const next = existing.filter((entry) => entry.id !== args.entryId);
  if (next.length === existing.length) return false;
  if (next.length === 0) {
    delete byUser[args.vendorId];
  } else {
    byUser[args.vendorId] = next;
  }
  if (Object.keys(byUser).length === 0) {
    delete store[args.userId];
  } else {
    store[args.userId] = byUser;
  }
  writeStore(store);
  return true;
}
