import * as XLSX from "xlsx";
import type { ParsedQuotationRow } from "../data/types";

const HEADER_ALIASES: Record<string, string[]> = {
  productNumber: [
    "product number",
    "product no",
    "product no.",
    "product#",
    "product #",
    "sku",
    "item code",
    "item no",
    "item number",
    "code",
    "part number",
    "pn",
  ],
  name: ["name", "product name", "item", "item name", "description", "product"],
  brand: ["brand", "brand / origin", "origin", "牌子", "品牌"],
  productType: [
    "product type",
    "type",
    "category",
    "group",
    "family",
    "class",
  ],
  price: [
    "price",
    "unit price",
    "wholesale",
    "cost",
    "amount",
    "rm",
    "usd",
    "myr",
    "hkd",
  ],
  unit: ["unit", "uom", "pack", "size", "pack size", "packaging", "規格"],
  description: ["notes", "remark", "remarks", "spec", "specification", "price note"],
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ");
}

function pickColumn(
  headers: string[],
  aliases: string[],
  used: Set<number>,
): number {
  for (const alias of aliases) {
    const idx = headers.findIndex((h, i) => !used.has(i) && h === alias);
    if (idx >= 0) {
      used.add(idx);
      return idx;
    }
  }
  for (const alias of aliases) {
    const idx = headers.findIndex(
      (h, i) => !used.has(i) && (h.includes(alias) || alias.includes(h)),
    );
    if (idx >= 0) {
      used.add(idx);
      return idx;
    }
  }
  return -1;
}

function parsePrice(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const cleaned = String(raw ?? "")
    .replace(/[^0-9.,-]/g, "")
    .replace(/,(?=\d{3}\b)/g, "");
  const n = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

function rowsFromSheet(sheet: XLSX.WorkSheet): ParsedQuotationRow[] {
  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];

  if (!matrix.length) return [];

  // Find header row within first 15 rows
  let headerRowIndex = 0;
  let bestScore = -1;
  for (let r = 0; r < Math.min(15, matrix.length); r++) {
    const headers = (matrix[r] ?? []).map(normalizeHeader);
    const used = new Set<number>();
    let score = 0;
    for (const key of Object.keys(HEADER_ALIASES) as Array<
      keyof typeof HEADER_ALIASES
    >) {
      if (pickColumn(headers, HEADER_ALIASES[key], used) >= 0) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = r;
    }
  }

  const headers = (matrix[headerRowIndex] ?? []).map(normalizeHeader);
  const used = new Set<number>();
  const map = {
    productNumber: pickColumn(headers, HEADER_ALIASES.productNumber, used),
    name: pickColumn(headers, HEADER_ALIASES.name, used),
    brand: pickColumn(headers, HEADER_ALIASES.brand, used),
    productType: pickColumn(headers, HEADER_ALIASES.productType, used),
    price: pickColumn(headers, HEADER_ALIASES.price, used),
    unit: pickColumn(headers, HEADER_ALIASES.unit, used),
    description: pickColumn(headers, HEADER_ALIASES.description, used),
  };

  if (map.name < 0 && map.productNumber < 0) {
    throw new Error(
      "Could not find product name or product number columns in this file.",
    );
  }

  const rows: ParsedQuotationRow[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    const productNumber = String(line[map.productNumber] ?? "").trim();
    const name = String(line[map.name] ?? "").trim();
    if (!productNumber && !name) continue;
    const price = parsePrice(line[map.price]);
    if (!Number.isFinite(price)) continue;

    rows.push({
      productNumber: productNumber || `ROW-${r + 1}`,
      name: name || productNumber,
      brand: String(line[map.brand] ?? "").trim() || undefined,
      productType: String(line[map.productType] ?? "General").trim() || "General",
      price,
      unit: String(line[map.unit] ?? "each").trim() || "each",
      description: String(line[map.description] ?? "").trim() || undefined,
    });
  }

  return rows;
}

export async function parseQuotationFile(file: File): Promise<ParsedQuotationRow[]> {
  const name = file.name.toLowerCase();
  const isSpreadsheet =
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv") ||
    file.type.includes("sheet") ||
    file.type.includes("csv") ||
    file.type.includes("excel");

  if (!isSpreadsheet) {
    throw new Error(
      "PDF/image quotations are stored as the new version, but products must be provided via Excel/CSV (or wait for agent import). Upload an .xlsx/.xls/.csv with columns like Product Number, Name, Type, Price.",
    );
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Spreadsheet has no sheets.");
  const rows = rowsFromSheet(sheet);
  if (!rows.length) {
    throw new Error("No product rows found after the header.");
  }
  return rows;
}

export function isSpreadsheetFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".xlsx") ||
    name.endsWith(".xls") ||
    name.endsWith(".csv") ||
    file.type.includes("sheet") ||
    file.type.includes("csv") ||
    file.type.includes("excel")
  );
}

export function isSupportedQuotationFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    isSpreadsheetFile(file) ||
    name.endsWith(".pdf") ||
    file.type.startsWith("image/") ||
    file.type === "application/pdf"
  );
}
