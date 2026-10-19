import imported from "./importedCatalog.json";
import haiBaoUnagiImage from "../assets/hai-bao-unagi.jpg";
import type { CatalogSnapshot, MoqRule } from "./types";

const seed = imported as CatalogSnapshot;

/** Local vendor card photos that should win over remote placeholders in the seed JSON. */
const VENDOR_IMAGE_OVERRIDES: Record<string, string> = {
  "hai-bao": haiBaoUnagiImage,
};

export const SEED_CATALOG: CatalogSnapshot = {
  ...seed,
  vendors: seed.vendors.map((vendor) => {
    const image = VENDOR_IMAGE_OVERRIDES[vendor.id];
    return image ? { ...vendor, image } : vendor;
  }),
};

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

/** Site admin PIN default — change in Admin → Security. */
export const DEFAULT_ADMIN_PIN = "1234";
