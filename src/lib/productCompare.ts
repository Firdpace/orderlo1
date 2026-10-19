import type { Product, Vendor } from "../data/types";

const SIZE_NOISE =
  /\b\d+(?:\.\d+)?\s*(?:kg|g|ml|l|斤|磅|pcs?|pc|箱|包|袋|瓶|罐|盒|支|條|隻|杯|ctn|box|pack|bottle)s?\b/gi;

const PUNCT = /[()（）\[\]【】{}「」『』'"“”‘’.,，。、/\\|+\-_*~!?:;@#￥$%^&=<>]/g;

/** Collapse a product name to comparable tokens. */
export function normalizeProductName(name: string): string {
  return String(name ?? "")
    .normalize("NFKC")
    .replace(SIZE_NOISE, " ")
    .replace(PUNCT, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokenize(name: string): string[] {
  const normalized = normalizeProductName(name);
  if (!normalized) return [];
  const parts = normalized.split(" ").filter(Boolean);
  const tokens = new Set<string>();
  for (const part of parts) {
    if (part.length >= 2) tokens.add(part);
    // Split CJK runs into overlapping bigrams for soft matching
    const cjk = part.match(/[\u4e00-\u9fff]+/g) ?? [];
    for (const run of cjk) {
      if (run.length <= 2) {
        tokens.add(run);
      } else {
        for (let i = 0; i < run.length - 1; i++) {
          tokens.add(run.slice(i, i + 2));
        }
        if (run.length >= 3) tokens.add(run);
      }
    }
  }
  return [...tokens];
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function coreKey(product: Product): string {
  const norm = normalizeProductName(product.name);
  const brand = normalizeProductName(product.brand || "");
  return brand ? `${brand}::${norm}` : norm;
}

export type CompareRow = {
  product: Product;
  vendor?: Vendor;
  /** Why it matched (for debugging / subtle UI). */
  score: number;
  kind: "self" | "same" | "similar";
};

export function findSameAcrossVendors(
  product: Product,
  catalog: Product[],
  getVendor: (id: string) => Vendor | undefined,
): CompareRow[] {
  const selfTokens = tokenize(product.name);
  const selfCore = coreKey(product);
  const rows: CompareRow[] = [
    {
      product,
      vendor: getVendor(product.vendorId),
      score: 1,
      kind: "self",
    },
  ];

  for (const other of catalog) {
    if (other.id === product.id) continue;
    if (other.vendorId === product.vendorId) continue;

    const otherCore = coreKey(other);
    const otherTokens = tokenize(other.name);
    const score = jaccard(selfTokens, otherTokens);
    const exact =
      selfCore.length >= 2 &&
      (selfCore === otherCore ||
        normalizeProductName(product.name) === normalizeProductName(other.name));
    const brandSame =
      product.brand &&
      other.brand &&
      normalizeProductName(product.brand) === normalizeProductName(other.brand);
    const strong =
      exact ||
      score >= 0.72 ||
      (brandSame && score >= 0.45) ||
      (score >= 0.55 &&
        product.productType === other.productType &&
        normalizeProductName(product.name).includes(
          normalizeProductName(other.name),
        ));

    if (!strong) continue;
    rows.push({
      product: other,
      vendor: getVendor(other.vendorId),
      score: exact ? 1 : score,
      kind: "same",
    });
  }

  return rows.sort((a, b) => {
    if (a.kind === "self") return -1;
    if (b.kind === "self") return 1;
    return b.score - a.score || a.product.price - b.product.price;
  });
}

export function findSimilarProducts(
  product: Product,
  catalog: Product[],
  getVendor: (id: string) => Vendor | undefined,
  excludeIds: Set<string>,
  limit = 12,
): CompareRow[] {
  const selfTokens = tokenize(product.name);
  const scored: CompareRow[] = [];

  for (const other of catalog) {
    if (excludeIds.has(other.id)) continue;
    if (other.id === product.id) continue;

    const sameType = other.productType === product.productType;
    const sameSource =
      product.sourceCategory &&
      other.sourceCategory &&
      product.sourceCategory === other.sourceCategory;
    if (!sameType && !sameSource) continue;

    const otherTokens = tokenize(other.name);
    let score = jaccard(selfTokens, otherTokens);
    if (
      product.brand &&
      other.brand &&
      normalizeProductName(product.brand) === normalizeProductName(other.brand)
    ) {
      score += 0.12;
    }
    if (sameSource) score += 0.08;
    if (other.vendorId === product.vendorId) score -= 0.05;

    // Prefer comparable unit economics when both have unit prices
    if (
      product.unitPrice != null &&
      product.unitPrice > 0 &&
      other.unitPrice != null &&
      other.unitPrice > 0
    ) {
      const ratio =
        Math.min(product.unitPrice, other.unitPrice) /
        Math.max(product.unitPrice, other.unitPrice);
      if (ratio >= 0.4) score += 0.05 * ratio;
    }

    if (score < 0.28) continue;
    scored.push({
      product: other,
      vendor: getVendor(other.vendorId),
      score,
      kind: "similar",
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
    .slice(0, limit);
}

export function sizeLabel(product: Product): string {
  const pkg = product.size?.trim();
  const order = product.orderUnit?.trim() || product.unit?.trim();
  if (pkg && order && pkg !== order) return `${pkg} · 訂 ${order}`;
  return pkg || order || "—";
}

export function unitPriceLabel(product: Product): string {
  if (product.unitPrice != null && product.unitPrice > 0) {
    return `${product.unitPrice}${product.unitPriceLabel || ""}`;
  }
  return "";
}
