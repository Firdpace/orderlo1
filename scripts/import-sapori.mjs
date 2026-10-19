/**
 * Merge Sapori July 2026 price list (OCR text under /tmp/sapori/ocr) into catalog.
 * Image PDF → pdftoppm → tesseract eng; this script parses Description/Code/Price
 * layouts plus PA/IM inline price lines.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const ocrDir = "/tmp/sapori/ocr";
const catalogPath = path.join(root, "src/data/importedCatalog.json");

const SAPORI = {
  id: "sapori",
  name: "Sapori",
  tagline: "意大利進口 · July 2026 報價",
  focus: "甜品 / 芝士 / 醬汁 / 急凍",
  image:
    "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80",
  moq: { type: "amount", value: 800 },
  whatsappSales: "85266169905",
};

const PAGE_SECTION = {
  4: "Bindi Sorbet and Desserts",
  5: "Bindi Sherbet and Dessert Cup",
  6: "Bindi Portion Cake",
  7: "Bindi Portion Cake",
  8: "Bindi Whole Cake",
  9: "Bindi-Manzoni Cake",
  10: "Bindi Pre-cut Cake",
  11: "Bindi Pre-cut Cake",
  12: "Bindi Pre-cut Cake",
  13: "Bindi Pastry",
  14: "Bindi Pastry",
  15: "Bindi Bakery",
  16: "Basque Cheesecake",
  17: "Gelato / Sorbet",
  18: "Gelato / Sorbet",
  19: "Caffe / Espresso",
  20: "Pistachio",
  21: "Pistachio",
  22: "Avocado / Guacamole",
  23: "Avocado / Guacamole",
  24: "Produce / Specialty",
  25: "Frozen Avocado",
  26: "Cheese",
  27: "Cheese",
  28: "Cheese",
  29: "Cheese",
  30: "Hard Cheese",
  31: "Cheese / Dairy",
  32: "Pasta / Dry",
  33: "Pasta / Dry",
  34: "Cured / Meat",
  35: "Pork",
  36: "Condiment",
  37: "Oil / Condiment",
  38: "Oil / Condiment",
  39: "Truffle",
  40: "Truffle Condiment",
  41: "Condiment",
  42: "Condiment",
  43: "Vinegar",
  44: "Vinegar",
  45: "Balsamico",
  46: "Specialty",
  47: "Bindi promo pack",
  48: "Bindi promo pack",
};

function sectionToSourceCategory(section) {
  const s = String(section || "");
  if (/sorbet|sherbet|dessert|cake|pastry|bakery|gelato|cheesecake|bindi|promo/i.test(s))
    return "甜品/蛋糕";
  if (/cheese|dairy|parmig|grana|pecorino|mozarella|mozzarella/i.test(s))
    return "芝士";
  if (/pork|meat|cured|loin|ribs|belly|collar/i.test(s)) return "急凍肉類-豬";
  if (/avocado|guacamole|produce|vegetable/i.test(s)) return "日本蔬菜";
  if (/truffle|vinegar|balsam|condiment|oil|pesto|pistachio/i.test(s))
    return "醬汁";
  if (/pasta|dry|flour/i.test(s)) return "意大利粉";
  if (/caffe|espresso|drink|beverage/i.test(s)) return "飲品";
  return "其他";
}

function clean(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/[|;]+/g, " ")
    .trim();
}

function parsePrice(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const text = String(raw ?? "").replace(/,/g, "");
  const m = text.match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : NaN;
}

function unitFromPacking(packing, priceText) {
  const blob = `${packing} ${priceText}`;
  const m = blob.match(
    /\/\s*(box|bottle|pack|kg|pc|pcs|cup|ctn|tray|wheel|bot)\b/i,
  );
  if (m) {
    const u = m[1].toLowerCase();
    if (u === "bot" || u === "bottle") return "bottle";
    if (u === "pcs") return "pc";
    return u;
  }
  if (/12\s*bots?\/ctn|bottle/i.test(blob)) return "bottle";
  if (/\/box|pcs\/box|pe[sx]?\/box|pc\/box/i.test(blob)) return "box";
  if (/\/kg|per\s*kg/i.test(blob)) return "kg";
  if (/\/pack/i.test(blob)) return "pack";
  if (/\/cup/i.test(blob)) return "cup";
  return packing || "box";
}

function unitPriceFromParen(priceText, packPrice) {
  const m = String(priceText).match(
    /\(\s*\$?\s*(\d+(?:\.\d+)?)\s*\/?\s*(pc|each|slice|kg)?/i,
  );
  if (m) {
    return {
      unitPrice: Number(m[1]),
      unitPriceLabel: m[2] ? `/${m[2].toLowerCase() === "each" ? "pc" : m[2]}` : "/pc",
    };
  }
  const pcs = String(priceText).match(/(\d+)\s*pcs?\/box/i);
  if (pcs && packPrice > 0) {
    const n = Number(pcs[1]);
    if (n > 0) {
      return {
        unitPrice: Math.round((packPrice / n) * 100) / 100,
        unitPriceLabel: "/pc",
      };
    }
  }
  return { unitPrice: null, unitPriceLabel: "" };
}

function normalizeCode(raw) {
  let code = clean(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
  // OCR fixes
  code = code
    .replace(/^PSO(\d)/, "P50$1")
    .replace(/^PS(\d{2,})$/, "P5$1")
    .replace(/^PO(\d)/, "P0$1")
    .replace(/^PPOS$/, "PP05")
    .replace(/^PROS$/, "PP05")
    .replace(/^PP0S$/, "PP05");
  if (!/^[A-Z]{1,4}\d{2,5}(-\d+)?$/i.test(code) && !/^[A-Z]{2,4}\d+[A-Z]?$/i.test(code)) {
    return "";
  }
  return code.slice(0, 24);
}

function normalizeName(raw) {
  let name = clean(raw)
    .replace(/^description\s*[:;.-]?\s*/i, "")
    .replace(/\bdescription\b.*$/i, "")
    .replace(/[“”‘’]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Drop pure CJK garbage tails that OCR invents; keep bilingual if present
  if (name.length < 2) return "";
  if (/^[^A-Za-z0-9\u4e00-\u9fff]+$/.test(name)) return "";
  // Prefer latin product titles when OCR mangled Chinese
  const latin = name.match(/[A-Za-z][A-Za-z0-9 &'./()-]{2,}/);
  if (latin && name.length > 40) name = latin[0].trim();
  return name.slice(0, 80);
}

function extractTwoColumnBlocks(text, page, section) {
  const products = [];
  // Split into left/right by pairing Description appearances
  const lines = text.split(/\n/);
  const joined = lines.join("\n");

  // Collect description names (may be two per line)
  const descRe =
    /Description\s*[:;.-]?\s*([^:\n]+?)(?=\s+Description\s*[:;.-]|\s+Code\s*[:;.=<-]|\n|$)/gi;
  const codeRe = /Code\s*[:;.=<-]?\s*([A-Za-z0-9-]{2,16})/gi;
  const packRe = /Packing\s*[:;.-]?\s*([^\n]*?)(?=\s+Packing\s*[:;.-]|\s+Price|\n|$)/gi;
  const priceRe =
    /Pri[cv]e\s*\(?\s*HK\$?\)?\s*[:;.-]?\s*([^\n]*?)(?=\s+Pri[cv]e\s*\(?|\s+Description|\n|$)/gi;

  const descs = [...joined.matchAll(descRe)].map((m) => normalizeName(m[1]));
  const codes = [...joined.matchAll(codeRe)].map((m) => normalizeCode(m[1]));
  const packs = [...joined.matchAll(packRe)].map((m) => clean(m[1]));
  const prices = [...joined.matchAll(priceRe)].map((m) => clean(m[1]));

  const n = Math.min(codes.length, Math.max(descs.length, codes.length));
  for (let i = 0; i < n; i++) {
    const code = codes[i];
    if (!code) continue;
    const priceText = prices[i] || "";
    const price = parsePrice(priceText);
    if (!Number.isFinite(price) || price <= 0 || price > 20000) continue;
    const packing = packs[i] || "";
    const name = descs[i] || code;
    if (!name) continue;
    const orderUnit = unitFromPacking(packing, priceText);
    const { unitPrice, unitPriceLabel } = unitPriceFromParen(
      `${packing} ${priceText}`,
      price,
    );
    products.push({
      code,
      name,
      packing,
      price,
      orderUnit,
      unitPrice,
      unitPriceLabel,
      page,
      section,
    });
  }
  return products;
}

function extractInlineCodes(text, page, section) {
  const products = [];
  // PA101 - HK$56/bottle, 12 bots/ctn
  const inline =
    /([A-Z]{1,4}\d{2,5}[A-Z]?)\s*[-–—:]\s*HK\$?\s*(\d+(?:\.\d+)?)\s*\/\s*(bottle|pack|pc|kg|cup|box|ctn|tray)/gi;
  for (const m of text.matchAll(inline)) {
    const code = normalizeCode(m[1]);
    const price = Number(m[2]);
    const unit = m[3].toLowerCase();
    if (!code || !(price > 0)) continue;
    // Try to find name on previous lines
    const idx = m.index ?? 0;
    const before = text.slice(Math.max(0, idx - 180), idx);
    const nameMatch = before
      .split(/\n/)
      .map((l) => clean(l))
      .filter((l) => l.length > 4 && /[A-Za-z]/.test(l) && !/shelf life|packing|code|price/i.test(l))
      .pop();
    products.push({
      code,
      name: normalizeName(nameMatch || code),
      packing: clean(m[0]),
      price,
      orderUnit: unit,
      unitPrice: null,
      unitPriceLabel: "",
      page,
      section,
    });
  }

  // Meat: Code : IM201 ... $115/kg or Packaging: ... $89/kg
  const meatBlocks = text.split(/(?=Code\s*[:;.-]?\s*IM\d+)/i);
  for (const block of meatBlocks) {
    const codeM = block.match(/Code\s*[:;.-]?\s*(IM\d+)/i);
    if (!codeM) continue;
    const code = normalizeCode(codeM[1]);
    const priceM =
      block.match(/\$\s*(\d+(?:\.\d+)?)\s*\/\s*kg/i) ||
      block.match(/HK\$\s*(\d+(?:\.\d+)?)\s*\/\s*kg/i);
    if (!priceM) continue;
    const price = Number(priceM[1]);
    const nameLine = clean(block.split(/\n/).find((l) => /pork|loin|ribs|belly|collar|sliced/i.test(l)) || "");
    products.push({
      code,
      name: normalizeName(nameLine || code),
      packing: "kg",
      price,
      orderUnit: "kg",
      unitPrice: price,
      unitPriceLabel: "/kg",
      page,
      section,
    });
  }

  // Frozen avocado style: Item no. : FPG201 / Price : HK$94/kg
  const itemNos = [...text.matchAll(/Item\s*no\.?\s*[:;.-]?\s*([A-Z0-9-]+)/gi)];
  for (const m of itemNos) {
    const code = normalizeCode(m[1]);
    if (!code) continue;
    const window = text.slice(m.index ?? 0, (m.index ?? 0) + 220);
    const priceM =
      window.match(/HK\$\s*(\d+(?:\.\d+)?)\s*\/\s*(kg|cup|bag|carton|pack|pc)/i) ||
      window.match(/Price\s*[:;.-]?\s*HK\$\s*(\d+(?:\.\d+)?)/i);
    if (!priceM) continue;
    const price = Number(priceM[1]);
    if (!(price > 0)) continue;
    const unit = (priceM[2] || "kg").toLowerCase();
    const before = text.slice(Math.max(0, (m.index ?? 0) - 120), m.index ?? 0);
    const nameLine = before
      .split(/\n/)
      .map(clean)
      .filter((l) => /frozen|avocado|guacamole|[A-Za-z]{4,}/i.test(l))
      .pop();
    products.push({
      code,
      name: normalizeName(nameLine || code),
      packing: unit,
      price,
      orderUnit: unit,
      unitPrice: unit === "kg" ? price : null,
      unitPriceLabel: unit === "kg" ? "/kg" : "",
      page,
      section,
    });
  }

  return products;
}

function parsePage(pageNum) {
  const file = path.join(
    ocrDir,
    `p-${String(pageNum).padStart(2, "0")}.txt`,
  );
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, "utf8");
  if (!text.trim()) return [];
  const section =
    PAGE_SECTION[pageNum] ||
    (text.match(/^[A-Z][A-Za-z /-]{6,40}$/m)?.[0] ?? `Sapori p.${pageNum}`);

  // Prefer banner line if present
  const banner = text.match(
    /Bindi[^\n]{0,40}|Truffle[^\n]{0,20}|LEONARDI[^\n]{0,30}|VIRGILIO|Pistachio|Avocado|Pork|Balsam/i,
  );
  const sectionName = banner ? clean(banner[0]).slice(0, 48) : section;

  const fromBlocks = extractTwoColumnBlocks(text, pageNum, sectionName);
  const fromInline = extractInlineCodes(text, pageNum, sectionName);
  return [...fromBlocks, ...fromInline];
}

function toCatalogProduct(row, index) {
  const sourceCategory = sectionToSourceCategory(row.section);
  const id = `sapori-${row.code}`.replace(/\s+/g, "-");
  return {
    id,
    productNumber: row.code,
    vendorId: "sapori",
    name: row.name,
    brand: /bindi|manzoni|albert|lykke/i.test(row.section + row.name)
      ? "Bindi"
      : "Sapori",
    size: "",
    orderUnit: row.orderUnit || row.packing || "box",
    productType: sourceCategory,
    price: row.price,
    unit: row.orderUnit || row.packing || "box",
    unitPrice: row.unitPrice,
    unitPriceLabel: row.unitPriceLabel || "",
    description: `Sapori July 2026 · p.${row.page} · ${row.section}${row.packing ? ` · ${row.packing}` : ""}`,
    image: "",
    sourceCategory,
  };
}

const raw = [];
for (let p = 4; p <= 48; p++) {
  raw.push(...parsePage(p));
}

// Dedupe by code, keep first good name
const seen = new Map();
for (const row of raw) {
  if (!row.code || !row.name) continue;
  const prev = seen.get(row.code);
  if (!prev) {
    seen.set(row.code, row);
    continue;
  }
  // Prefer longer/cleaner name
  if (row.name.length > prev.name.length && /[A-Za-z]{3,}/.test(row.name)) {
    seen.set(row.code, row);
  }
}

const saporiProducts = [...seen.values()].map(toCatalogProduct);

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
catalog.vendors = [
  ...catalog.vendors.filter((v) => v.id !== "sapori"),
  SAPORI,
];
catalog.products = [
  ...catalog.products.filter((p) => p.vendorId !== "sapori"),
  ...saporiProducts,
];
catalog.quotations = [
  ...catalog.quotations.filter((q) => q.vendorId !== "sapori"),
  {
    vendorId: "sapori",
    fileName: "Sapori_Price_List_July_2026_compressed_bcaa.pdf",
    mimeType: "application/pdf",
    uploadedAt: new Date().toISOString(),
    version: 1,
    rowCount: saporiProducts.length,
  },
];
catalog.updatedAt = new Date().toISOString();

fs.writeFileSync(catalogPath, JSON.stringify(catalog));
console.log(
  JSON.stringify(
    {
      saporiProducts: saporiProducts.length,
      sample: saporiProducts.slice(0, 8).map((p) => ({
        code: p.productNumber,
        name: p.name,
        price: p.price,
        type: p.sourceCategory,
      })),
      bySource: Object.fromEntries(
        [...saporiProducts.reduce((m, p) => {
          m.set(p.sourceCategory, (m.get(p.sourceCategory) || 0) + 1);
          return m;
        }, new Map())],
      ),
      totalProducts: catalog.products.length,
      vendors: catalog.vendors.map((v) => v.name),
    },
    null,
    2,
  ),
);
