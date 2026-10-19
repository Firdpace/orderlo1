/**
 * Merge Angliss Hong Kong product lists (MP-1408 meat, DP-3008 dairy/pastry,
 * GO-0221 grocery) into vendor `angliss`. Does not touch Ocean Prime / hai-bao.
 *
 * Source fixture (preferred): store path or local copy under src/data/.
 * Keeps prior priced Angliss Dairy/GCL SKUs that are not in the PDF lists.
 *
 * Run: node scripts/import-angliss-catalogs.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const catalogPath = path.join(root, "src/data/importedCatalog.json");
const localFixture = path.join(root, "src/data/angliss-pdf-fixture.json");
const storeFixture =
  "/cursor/stores/bc-01a1504f-09ad-78ea-8834-df2b19959e37/internal/orderlo-scaffold/data/angliss-pdf-fixture.json";

const VENDOR_ID = "angliss";

const ANGLISS_VENDOR = {
  id: VENDOR_ID,
  name: "Angliss Hong Kong",
  tagline: "Angliss Hong Kong · MP-1408 / DP-3008 / GO-0221",
  focus: "Meat · Dairy & Pastry · Grocery · 產品目錄（無標價請查詢）",
  image:
    "https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=900&q=80",
  moq: { type: "amount", value: 1000 },
  whatsappSales: "85266169905",
  deliverySchedule: "訂貨前置時間及 MOQ 以業務確認為準（產品目錄無標價）",
};

function skuFromNote(note) {
  const m = String(note ?? "").match(/SKU\s+([A-Z0-9-]+)/i);
  return m ? m[1] : null;
}

function storageFromNote(note) {
  const m = String(note ?? "").match(
    /\b(Chilled|Frozen|Ambient|Dry|Cool)\b/i,
  );
  return m ? m[1] : "";
}

function catalogLabel(sourcePage) {
  const s = String(sourcePage ?? "").toLowerCase();
  if (s.includes("pdf2") || s.includes("dp-3008") || s.includes("dp3008")) {
    return "DP-3008 Dairy & Pastry";
  }
  if (s.includes("pdf3") || s.includes("go-0221") || s.includes("go0221")) {
    return "GO-0221 Grocery & Other";
  }
  if (s.includes("mp1408") || s.includes("mp-1408")) {
    return "MP-1408 Meat";
  }
  return "Angliss product list";
}

function orderUnitFromPack(pack) {
  const p = String(pack ?? "").toUpperCase();
  if (/\bKG\b/.test(p)) return "kg";
  if (/\bTIN\b/.test(p)) return "tin";
  if (/\bPKT\b|\bPACK\b/.test(p)) return "pack";
  if (/\bCTN\b|\bCASE\b/.test(p)) return "ctn";
  if (/\bBAG\b/.test(p)) return "bag";
  if (/\bBOT\b|\bBTL\b/.test(p)) return "bottle";
  if (/\bPC\b|\bPCS\b/.test(p)) return "pc";
  return "pc";
}

function zhEnName(product) {
  // Fixture names are often "English 中文" — keep as-is; prefer ZH-first when both present.
  const text = String(product ?? "").trim();
  const m = text.match(/^(.+?)\s+([\u4e00-\u9fff].+)$/);
  if (m) return `${m[2]} ${m[1]}`.replace(/\s+/g, " ").trim();
  return text;
}

function rowToProduct(row) {
  const sku = skuFromNote(row.priceNote);
  if (!sku) return null;
  const pack = String(row.packaging ?? "").trim();
  const orderUnit = orderUnitFromPack(pack);
  const storage = storageFromNote(row.priceNote);
  const catalog = catalogLabel(row.sourcePage);
  const brand = String(row.brandOrigin ?? "").trim();
  const sourceCategory = String(row.category ?? "其他").trim() || "其他";
  const price =
    row.priceHkd == null || Number.isNaN(Number(row.priceHkd))
      ? 0
      : Number(row.priceHkd);
  const descParts = [
    `Angliss ${catalog}`,
    brand || null,
    storage || null,
    pack || null,
    price > 0 ? null : "價錢請查詢/WhatsApp確認",
  ].filter(Boolean);

  return {
    id: `${VENDOR_ID}-${sku}`,
    productNumber: sku,
    vendorId: VENDOR_ID,
    name: zhEnName(row.product),
    brand,
    size: pack,
    orderUnit,
    productType: sourceCategory,
    price,
    unit: orderUnit,
    unitPrice: price > 0 ? price : null,
    unitPriceLabel: "",
    description: descParts.join(" · "),
    image: "",
    sourceCategory,
  };
}

function loadFixture() {
  const src = fs.existsSync(localFixture)
    ? localFixture
    : fs.existsSync(storeFixture)
      ? storeFixture
      : null;
  if (!src) {
    throw new Error(
      `Missing Angliss fixture. Expected ${localFixture} or ${storeFixture}`,
    );
  }
  const rows = JSON.parse(fs.readFileSync(src, "utf8"));
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Fixture empty or invalid: ${src}`);
  }
  return { src, rows };
}

function main() {
  const { src, rows } = loadFixture();
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

  // Copy fixture into repo for reproducible re-imports.
  if (path.resolve(src) !== path.resolve(localFixture)) {
    fs.copyFileSync(src, localFixture);
  }

  const fromCatalog = new Map();
  for (const row of rows) {
    const product = rowToProduct(row);
    if (!product) continue;
    // Prefer later sources already unioned in angliss-pdf-fixture (v2 meat).
    fromCatalog.set(product.productNumber, product);
  }

  const priorPriced = catalog.products.filter(
    (p) =>
      p.vendorId === VENDOR_ID &&
      Number(p.price) > 0 &&
      !fromCatalog.has(p.productNumber),
  );

  const otherProducts = catalog.products.filter((p) => p.vendorId !== VENDOR_ID);
  const anglissProducts = [
    ...priorPriced,
    ...Array.from(fromCatalog.values()),
  ].sort((a, b) => {
    const byCat = String(a.sourceCategory).localeCompare(
      String(b.sourceCategory),
      "zh-HK",
    );
    if (byCat !== 0) return byCat;
    return String(a.name).localeCompare(String(b.name), "zh-HK");
  });

  const vendors = catalog.vendors.map((v) =>
    v.id === VENDOR_ID ? { ...v, ...ANGLISS_VENDOR } : v,
  );
  if (!vendors.some((v) => v.id === VENDOR_ID)) {
    vendors.push(ANGLISS_VENDOR);
  }

  const now = new Date().toISOString();
  const prevQuote = (catalog.quotations || []).find(
    (q) => q.vendorId === VENDOR_ID,
  );
  const quotation = {
    vendorId: VENDOR_ID,
    fileName:
      "angliss-mp1408-v2.pdf (MP-1408) + pdf2-catalog.pdf (DP-3008) + pdf3-catalog.pdf (GO-0221)" +
      (priorPriced.length
        ? ` + ${priorPriced.length} prior priced Dairy/GCL SKUs`
        : ""),
    mimeType: "application/pdf",
    uploadedAt: now,
    version: (prevQuote?.version ?? 0) + 1,
    rowCount: anglissProducts.length,
  };

  const next = {
    ...catalog,
    updatedAt: now,
    vendors,
    products: [...otherProducts, ...anglissProducts],
    quotations: [
      ...(catalog.quotations || []).filter((q) => q.vendorId !== VENDOR_ID),
      quotation,
    ],
  };

  fs.writeFileSync(catalogPath, JSON.stringify(next));

  const priced = anglissProducts.filter((p) => p.price > 0).length;
  const unpriced = anglissProducts.length - priced;
  const bySrc = { meat: 0, dairy: 0, grocery: 0 };
  for (const p of fromCatalog.values()) {
    const d = p.description || "";
    if (d.includes("MP-1408")) bySrc.meat += 1;
    else if (d.includes("DP-3008")) bySrc.dairy += 1;
    else if (d.includes("GO-0221")) bySrc.grocery += 1;
  }

  console.log(
    JSON.stringify(
      {
        fixture: src,
        fixtureRows: rows.length,
        catalogSkuRows: fromCatalog.size,
        priorPricedKept: priorPriced.length,
        anglissTotal: anglissProducts.length,
        priced,
        unpriced,
        bySourceCatalog: bySrc,
        haiBaoUntouched: next.products.filter((p) => p.vendorId === "hai-bao")
          .length,
        productTotal: next.products.length,
      },
      null,
      2,
    ),
  );
}

main();
