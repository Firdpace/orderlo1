/** Per-user shop profiles (name + delivery address) in localStorage. */

export const SHOPS_STORAGE_KEY = "orderlo.shops.v1";

export type Shop = {
  id: string;
  name: string;
  deliveryAddress: string;
};

type ShopsRegistry = {
  byUserId: Record<string, Shop[]>;
};

function uid(): string {
  return `shop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function readRegistry(): ShopsRegistry {
  try {
    const raw = localStorage.getItem(SHOPS_STORAGE_KEY);
    if (!raw) return { byUserId: {} };
    const parsed = JSON.parse(raw) as ShopsRegistry;
    return {
      byUserId:
        parsed && typeof parsed.byUserId === "object" && parsed.byUserId
          ? parsed.byUserId
          : {},
    };
  } catch {
    return { byUserId: {} };
  }
}

function writeRegistry(registry: ShopsRegistry): void {
  try {
    localStorage.setItem(SHOPS_STORAGE_KEY, JSON.stringify(registry));
  } catch {
    // ignore
  }
}

export function listShopsForUser(userId: string): Shop[] {
  const registry = readRegistry();
  const list = registry.byUserId[userId];
  return Array.isArray(list) ? list : [];
}

export function saveShopsForUser(userId: string, shops: Shop[]): Shop[] {
  const registry = readRegistry();
  registry.byUserId[userId] = shops;
  writeRegistry(registry);
  return shops;
}

export function addShop(
  userId: string,
  input: { name: string; deliveryAddress: string },
): Shop[] {
  const name = input.name.trim();
  const deliveryAddress = input.deliveryAddress.trim();
  if (!name) throw new Error("請輸入店舖名稱。");
  if (!deliveryAddress) throw new Error("請輸入送貨地址。");
  const shops = listShopsForUser(userId);
  shops.push({ id: uid(), name, deliveryAddress });
  return saveShopsForUser(userId, shops);
}

export function updateShop(
  userId: string,
  shopId: string,
  input: { name: string; deliveryAddress: string },
): Shop[] {
  const name = input.name.trim();
  const deliveryAddress = input.deliveryAddress.trim();
  if (!name) throw new Error("請輸入店舖名稱。");
  if (!deliveryAddress) throw new Error("請輸入送貨地址。");
  const shops = listShopsForUser(userId).map((s) =>
    s.id === shopId ? { ...s, name, deliveryAddress } : s,
  );
  return saveShopsForUser(userId, shops);
}

export function removeShop(userId: string, shopId: string): Shop[] {
  const shops = listShopsForUser(userId).filter((s) => s.id !== shopId);
  return saveShopsForUser(userId, shops);
}
