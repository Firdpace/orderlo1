import type { Product, Vendor } from "../data/types";
import type { WaHistoryLine } from "./waHistory";

export type BuiltWhatsApp = {
  text: string;
  lines: WaHistoryLine[];
  total: number;
};

/**
 * Minimal WhatsApp order text: vendor once, then
 * `name × qty = subtotal` lines, optional grand total.
 * Per-line fields are product name, qty, and subtotal only.
 */
export function buildWhatsAppOrderMessage(args: {
  vendor: Vendor;
  lines: Array<{ product: Product; quantity: number; lineTotal: number }>;
  subtotal?: number;
}): BuiltWhatsApp {
  const { vendor, lines } = args;
  const header = vendor.name;
  let total = 0;
  const historyLines: WaHistoryLine[] = [];
  const body = lines
    .map((line) => {
      const name = line.product.name || "Item";
      const qty = line.quantity;
      const subtotal = line.lineTotal;
      total += subtotal;
      historyLines.push({ name, qty, subtotal });
      return `${name} × ${qty} = HKD ${subtotal.toFixed(2)}`;
    })
    .join("\n");
  const footer = lines.length ? `\nTotal: HKD ${total.toFixed(2)}` : "";
  return {
    text: `${header}\n${body}${footer}`,
    lines: historyLines,
    total,
  };
}

/** Digits-only phone for wa.me (no +). */
export function waMePhone(e164: string): string {
  return e164.replace(/\D/g, "");
}

export function whatsappOrderUrl(phone: string, message: string) {
  const digits = waMePhone(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
