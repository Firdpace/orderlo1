import imported from "./importedCatalog.json";
import type { CatalogSnapshot, MoqRule } from "./types";

export const SEED_CATALOG = imported as CatalogSnapshot;

export function formatPrice(amount: number) {
  return new Intl.NumberFormat("zh-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export function formatMoq(moq: MoqRule) {
  if (moq.type === "amount") return `MOQ ${formatPrice(moq.value)}`;
  return `MOQ ${moq.value} pcs`;
}

/** Demo admin PIN — change after first login in Admin → Settings. */
export const DEFAULT_ADMIN_PIN = "2468";
