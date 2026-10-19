import type { Product, Vendor } from "../data/types";

function money(amount: number): string {
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(cents)) return "$0";
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const rem = abs % 100;
  const core = rem === 0 ? `${whole}` : `${whole}.${String(rem).padStart(2, "0")}`;
  return `${neg ? "-" : ""}$${core}`;
}

export function buildWhatsAppOrderMessage(args: {
  vendor: Vendor;
  lines: Array<{ product: Product; quantity: number; lineTotal: number }>;
  subtotal: number;
}) {
  const { vendor, lines, subtotal } = args;
  const body = [
    `訂貨 — ${vendor.name}`,
    "",
    ...lines.map((line) => {
      const orderUnit =
        line.product.orderUnit || line.product.unit || line.product.size || "";
      return `• ${line.product.productNumber} | ${line.product.name} | ${line.quantity}${orderUnit ? ` × ${orderUnit}` : ""} | 小計 ${money(line.lineTotal)}`;
    }),
    "",
    `合計: ${money(subtotal)}`,
  ].join("\n");

  return body.replace(/HK\$/g, "$").replace(/HKD\s*/gi, "").replace(/\.00(?!\d)/g, "");
}

export function whatsappOrderUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
