import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const uploads = "/home/ubuntu/.cursor/projects/agent/uploads";

/** Comparison Excel vendors only: 興順 + 錦源行 (Vendor A page1 = 錦源行). */
const KIM_YUEN = {
  id: "kim-yuen",
  name: "錦源行",
  tagline: "陳小姐 · 滿 $500 送貨",
  focus: "雜貨 / 乾貨 / 調味",
  image:
    "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=900&q=80",
  moq: { type: "amount", value: 500 },
  whatsappSales: "85266169905",
};

const SIN_SHUN = {
  id: "sin-shun",
  name: "興順",
  tagline: "日式食材報價",
  focus: "急凍 / 日式食材",
  image:
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80",
  moq: { type: "amount", value: 800 },
  whatsappSales: "85266169905",
};

const NEW_KONDO = {
  id: "new-kondo",
  name: "New Kondo",
  tagline: "BEN · 獨立報價 Excel",
  focus: "拉麵 / 湯底 / 酒類",
  image:
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",
  moq: { type: "amount", value: 500 },
  whatsappSales: "85266169905",
  hideProductNumber: true,
};

const COMPARISON_VENDOR_MAP = {
  "錦源有限公司 (Kim Yuen Hong Limited)": KIM_YUEN,
  "Vendor A (page1 sundries)": KIM_YUEN, // confirmed: also 錦源行
  "興順(亞洲)有限公司 (Sin Shun (Asia) Ltd)": SIN_SHUN,
};

function slug(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, " ")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePrice(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const text = String(raw ?? "");
  if (!text || /時價|暫缺|missing|tbc/i.test(text)) return NaN;
  const m = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : NaN;
}

function productNumber(vendorId, product, packaging, index) {
  const base = slug(`${product}-${packaging}`) || `item-${index}`;
  return `${vendorId.toUpperCase().slice(0, 2)}-${base}`.slice(0, 40);
}

/** Pull explicit per-unit price from notes, else derive from pack size when clear. */
function resolveUnitPrice(price, size, note) {
  const noteMatch = String(note ?? "").match(
    /(?:also\s*)?\$?\s*(\d+(?:\.\d+)?)\s*\/\s*(KG|kg|斤|包|PC|pc|條|隻|盒|瓶|BOT)/i,
  );
  if (noteMatch) {
    return {
      unitPrice: Number(noteMatch[1]),
      unitPriceLabel: `/${noteMatch[2].toUpperCase() === "KG" ? "KG" : noteMatch[2]}`,
    };
  }

  const sizeText = String(size ?? "");
  // e.g. 30kg/包, 25kg/袋, 1斤
  const kgPack = sizeText.match(/^(\d+(?:\.\d+)?)\s*kg\b/i);
  if (kgPack) {
    const kg = Number(kgPack[1]);
    if (kg > 0) {
      return {
        unitPrice: Math.round((price / kg) * 100) / 100,
        unitPriceLabel: "/KG",
      };
    }
  }
  const catty = sizeText.match(/^(\d+(?:\.\d+)?)\s*斤/);
  if (catty) {
    const n = Number(catty[1]);
    if (n > 0) {
      return {
        unitPrice: Math.round((price / n) * 100) / 100,
        unitPriceLabel: "/斤",
      };
    }
  }
  return { unitPrice: null, unitPriceLabel: "" };
}

function importComparison() {
  const file = path.join(uploads, "vendor-quotes-comparison_639a.xlsx");
  const wb = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["All Quotes"], { defval: "" });
  const products = [];
  const seen = new Set();
  let index = 0;

  for (const row of rows) {
    const vendorKey = cleanText(row.Vendor);
    const meta = COMPARISON_VENDOR_MAP[vendorKey];
    if (!meta) continue;
    const price = parsePrice(row["Price HKD"]);
    if (!Number.isFinite(price) || price <= 0) continue;

    const name = cleanText(row.Product);
    if (!name) continue;
    const size = cleanText(row["Packaging / Size"]) || "";
    const brand = cleanText(row["Brand / Origin"]);
    const category = cleanText(row.Category) || "General";
    const note = cleanText(row["Price note"]);
    const { unitPrice, unitPriceLabel } = resolveUnitPrice(price, size, note);
    const pn = productNumber(meta.id, name, size, ++index);
    const id = `${meta.id}-${pn}`.replace(/\s+/g, "-");
    if (seen.has(id)) continue;
    seen.add(id);

    products.push({
      id,
      productNumber: pn,
      vendorId: meta.id,
      name,
      brand,
      size: '',
      orderUnit: size,
      productType: category,
      price,
      unit: size,
      unitPrice,
      unitPriceLabel,
      description: [note, `Source p.${row["Source page"]}`].filter(Boolean).join(" · "),
      image: "",
    });
  }

  return products;
}

function importNewKondo() {
  const file = path.join(uploads, "20251104_______e270.xlsx");
  const wb = XLSX.readFile(file);
  const products = [];
  const seen = new Set();

  const table = XLSX.utils.sheet_to_json(wb.Sheets["Table 1"], { header: 1, defval: "" });
  for (let i = 17; i < table.length; i++) {
    const [code, item, packing, unit, priceRaw, remark] = table[i];
    const codeText = cleanText(code);
    if (!codeText || codeText.toLowerCase() === "wrong" || codeText.toLowerCase() === "code") {
      continue;
    }
    const price = parsePrice(priceRaw);
    if (!Number.isFinite(price) || price <= 0) continue;
    const name = cleanText(item);
    if (!name) continue;
    const id = `new-kondo-${codeText}`.replace(/\s+/g, "-");
    if (seen.has(id)) continue;
    seen.add(id);
    const size = cleanText(packing) || cleanText(unit) || "";
    const { unitPrice, unitPriceLabel } = resolveUnitPrice(
      price,
      size,
      cleanText(remark),
    );
    products.push({
      id,
      productNumber: codeText,
      vendorId: "new-kondo",
      name,
      brand: "",
      size: "",
      orderUnit: size,
      productType: /酒|燒酎|sake|kirishima|純米/i.test(name) ? "酒類" : "拉麵食材",
      price,
      unit: size,
      unitPrice,
      unitPriceLabel,
      description: [cleanText(packing), cleanText(remark)].filter(Boolean).join(" · "),
      image: "",
    });
  }

  const sheet2 = XLSX.utils.sheet_to_json(wb.Sheets["Sheet1 (2)"], { header: 1, defval: "" });
  for (let i = 2; i < sheet2.length; i++) {
    const [, code, brand, item, packing, priceRaw, remark] = sheet2[i];
    const codeText = cleanText(code);
    if (!codeText || codeText.toLowerCase() === "wrong") continue;
    const price = parsePrice(priceRaw);
    if (!Number.isFinite(price) || price <= 0) continue;
    const name = cleanText(item);
    if (!name) continue;
    const id = `new-kondo-${codeText}`.replace(/\s+/g, "-");
    if (seen.has(id)) continue;
    seen.add(id);
    const size = cleanText(packing) || "BOT";
    const { unitPrice, unitPriceLabel } = resolveUnitPrice(
      price,
      size,
      cleanText(remark),
    );
    products.push({
      id,
      productNumber: codeText,
      vendorId: "new-kondo",
      name,
      brand: cleanText(brand),
      size: "",
      orderUnit: size,
      productType: "酒類",
      price,
      unit: size,
      unitPrice,
      unitPriceLabel,
      description: cleanText(remark),
      image: "",
    });
  }

  return products;
}

const products = [...importComparison(), ...importNewKondo()];
const vendors = [KIM_YUEN, SIN_SHUN, NEW_KONDO];

const quotations = [
  {
    vendorId: "kim-yuen",
    fileName: "vendor-quotes-comparison_639a.xlsx (錦源行 + page1 sundries)",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    uploadedAt: new Date().toISOString(),
    version: 2,
    rowCount: products.filter((p) => p.vendorId === "kim-yuen").length,
  },
  {
    vendorId: "sin-shun",
    fileName: "vendor-quotes-comparison_639a.xlsx (興順)",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    uploadedAt: new Date().toISOString(),
    version: 2,
    rowCount: products.filter((p) => p.vendorId === "sin-shun").length,
  },
  {
    vendorId: "new-kondo",
    fileName: "20251104_______e270.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    uploadedAt: new Date().toISOString(),
    version: 1,
    rowCount: products.filter((p) => p.vendorId === "new-kondo").length,
  },
];

const catalog = {
  salesWhatsapp: "85266169905",
  updatedAt: new Date().toISOString(),
  currency: "HKD",
  quotations,
  vendors,
  products,
};

const out = path.join(root, "src/data/importedCatalog.json");
fs.writeFileSync(out, JSON.stringify(catalog));
console.log(
  JSON.stringify(
    {
      vendors: vendors.map((v) => ({
        id: v.id,
        name: v.name,
        moq: v.moq,
        count: products.filter((p) => p.vendorId === v.id).length,
      })),
      totalProducts: products.length,
      productTypes: [...new Set(products.map((p) => p.productType))].length,
      out,
    },
    null,
    2,
  ),
);
