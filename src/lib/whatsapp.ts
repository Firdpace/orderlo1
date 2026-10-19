import type { Product, Vendor } from "../data/types";
import type { WaHistoryLine } from "./waHistory";

export type BuiltWhatsApp = {
  text: string;
  lines: WaHistoryLine[];
  total: number;
};

/**
 * WhatsApp order text: shop greeting header, then
 * `name × qty = subtotal` lines, optional grand total.
 * Vendor name is intentionally omitted.
 */
export function buildWhatsAppOrderMessage(args: {
  vendor: Vendor;
  shopName: string;
  lines: Array<{ product: Product; quantity: number; lineTotal: number }>;
  subtotal?: number;
}): BuiltWhatsApp {
  const { shopName, lines } = args;
  const header = `你好 ${shopName.trim()} 想叫貨 最快送`;
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
