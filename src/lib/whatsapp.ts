import type { Product, Vendor } from "../data/types";
import type { WaHistoryLine } from "./waHistory";

export type BuiltWhatsApp = {
  text: string;
  lines: WaHistoryLine[];
  total: number;
};

/** List price present — price ≤ 0 means 查報價 / ask quote. */
export function isPricedProduct(product: Pick<Product, "price">): boolean {
  return product.price > 0;
}

const UNPRICED_SEPARATOR = "另外想問問以下報價同貨期";

/**
 * WhatsApp order text: shop greeting header, then priced lines
 * (`name × qty = HKD subtotal` + Total), then optional unpriced block
 * after separator `另外想問問以下報價同貨期` (`name × qty` only).
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

  const priced = lines.filter((line) => isPricedProduct(line.product));
  const unpriced = lines.filter((line) => !isPricedProduct(line.product));

  let total = 0;
  const historyLines: WaHistoryLine[] = [];
  const parts: string[] = [header];

  if (priced.length) {
    const pricedBody = priced
      .map((line) => {
        const name = line.product.name || "Item";
        const qty = line.quantity;
        const subtotal = line.lineTotal;
        total += subtotal;
        historyLines.push({ name, qty, subtotal });
        return `${name} × ${qty} = HKD ${subtotal.toFixed(2)}`;
      })
      .join("\n");
    parts.push(pricedBody);
    parts.push(`Total: HKD ${total.toFixed(2)}`);
  }

  if (unpriced.length) {
    // Always include separator before unpriced (even when there are no priced lines).
    parts.push(UNPRICED_SEPARATOR);
    const unpricedBody = unpriced
      .map((line) => {
        const name = line.product.name || "Item";
        const qty = line.quantity;
        historyLines.push({ name, qty, subtotal: 0 });
        return `${name} × ${qty}`;
      })
      .join("\n");
    parts.push(unpricedBody);
  }

  return {
    text: parts.join("\n"),
    lines: historyLines,
    total,
  };
}
