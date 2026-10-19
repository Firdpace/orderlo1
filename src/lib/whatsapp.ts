import { formatPrice } from "../data/seed";
import type { Product, Vendor } from "../data/types";

export function buildWhatsAppOrderMessage(args: {
  vendor: Vendor;
  lines: Array<{ product: Product; quantity: number; lineTotal: number }>;
  subtotal: number;
}) {
  const { vendor, lines, subtotal } = args;
  const body = [
    `Orderlo 訂貨 — ${vendor.name}`,
    "",
    ...lines.map((line) => {
      const orderUnit =
        line.product.orderUnit || line.product.unit || line.product.size || "";
      return `• ${line.product.productNumber} | ${line.product.name} | 數量 ${line.quantity}${orderUnit ? ` × ${orderUnit}` : ""} | ${formatPrice(line.product.price)} | 小計 ${formatPrice(line.lineTotal)}`;
    }),
    "",
    `合計: ${formatPrice(subtotal)}`,
    `MOQ: ${vendor.moq.type === "amount" ? formatPrice(vendor.moq.value) : `${vendor.moq.value} pcs`}（已達標）`,
  ].join("\n");

  return body;
}

export function whatsappOrderUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
