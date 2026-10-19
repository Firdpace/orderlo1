import imported from "./importedCatalog.json";
import type { CatalogSnapshot, MoqRule } from "./types";

export const SEED_CATALOG = imported as CatalogSnapshot;

export function formatPrice(amount: number) {
  const cents = Math.round(Number(amount) * 100);
  const whole = Math.trunc(cents / 100);
  const rem = Math.abs(cents % 100);
  const sign = cents < 0 ? "-" : "";
  if (rem === 0) return `${sign}$${Math.abs(whole)}`;
  return `${sign}$${Math.abs(whole)}.${String(rem).padStart(2, "0")}`;
}
export function formatMoq(moq: MoqRule) {
  if (moq.type === "amount") return `MOQ ${formatPrice(moq.value)}`;
  return `MOQ ${moq.value} pcs`;
}

/** Demo admin PIN — change after first login in Admin → Settings. */
export const DEFAULT_ADMIN_PIN = "2468";
