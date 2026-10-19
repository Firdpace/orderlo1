import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SEED_CATALOG } from "../data/seed";
import type {
  CatalogSnapshot,
  ParsedQuotationRow,
  Product,
  QuotationSource,
  Vendor,
} from "../data/types";
import {
  isSpreadsheetFile,
  isSupportedQuotationFile,
  parseQuotationFile,
} from "../lib/quotationParse";
import {
  sortPlatformCategories,
  toPlatformCategory,
} from "../lib/platformCategory";

const STORAGE_KEY = "orderlo-catalog-v27-angliss-mp-dp-go";

function normalizeProduct(product: Product): Product {
  const sourceCategory =
    String(product.sourceCategory ?? "").trim() ||
    String(product.productType ?? "").trim() ||
    "其他";
  return {
    ...product,
    sourceCategory,
    productType: toPlatformCategory(sourceCategory),
  };
}

function normalizeSnapshot(snapshot: CatalogSnapshot): CatalogSnapshot {
  return {
    ...snapshot,
    products: snapshot.products.map(normalizeProduct),
  };
}

/** Prefer bundled seed when it is newer / fuller than a stale localStorage copy. */
function shouldPreferSeed(stored: CatalogSnapshot): boolean {
  const seedUpdated = Date.parse(String(SEED_CATALOG.updatedAt ?? "")) || 0;
  const storedUpdated = Date.parse(String(stored.updatedAt ?? "")) || 0;
  if (seedUpdated > storedUpdated) return true;
  if ((SEED_CATALOG.products?.length ?? 0) > (stored.products?.length ?? 0)) {
    return true;
  }
  const seedVendorIds = new Set((SEED_CATALOG.vendors ?? []).map((v) => v.id));
  for (const id of seedVendorIds) {
    if (!(stored.vendors ?? []).some((v) => v.id === id)) return true;
  }
  return false;
}

type CatalogContextValue = {
  vendors: Vendor[];
  products: Product[];
  quotations: QuotationSource[];
  salesWhatsapp: string;
  productTypes: string[];
  getVendor: (id: string) => Vendor | undefined;
  getProduct: (id: string) => Product | undefined;
  productsByVendor: (vendorId: string) => Product[];
  productsByType: (type: string) => Product[];
  setSalesWhatsapp: (phone: string) => void;
  updateVendorMoq: (
    vendorId: string,
    moq: Vendor["moq"],
  ) => void;
  upsertVendor: (vendor: Vendor) => void;
  applyQuotation: (args: {
    vendorId: string;
    file: File;
    rows?: ParsedQuotationRow[];
  }) => Promise<{ rowCount: number; version: number }>;
  resetToSeed: () => void;
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

function loadSnapshot(): CatalogSnapshot {
  const seed = () => normalizeSnapshot(structuredClone(SEED_CATALOG));
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw) as CatalogSnapshot;
    if (!parsed?.vendors?.length) return seed();
    if (shouldPreferSeed(parsed)) return seed();
    return normalizeSnapshot(parsed);
  } catch {
    return seed();
  }
}

function fileToPreviewDataUrl(file: File): Promise<string | undefined> {
  if (!file.type.startsWith("image/") || file.size > 1_200_000) {
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });
}

function rowsToProducts(
  vendorId: string,
  rows: ParsedQuotationRow[],
  existingImages: Map<string, string>,
): Product[] {
  return rows.map((row) => {
    const id = `${vendorId}-${row.productNumber}`.replace(/\s+/g, "-");
    const orderUnit = row.unit || "";
    const sourceCategory = row.productType || "其他";
    return {
      id,
      productNumber: row.productNumber,
      vendorId,
      name: row.name,
      brand: row.brand ?? "",
      size: "",
      orderUnit,
      sourceCategory,
      productType: toPlatformCategory(sourceCategory),
      price: row.price,
      unit: orderUnit,
      unitPrice: row.unitPrice ?? null,
      unitPriceLabel: row.unitPriceLabel ?? "",
      description: row.description ?? "",
      // Most quotations have no photos — only keep a real image if one already existed.
      image: existingImages.get(row.productNumber) ?? existingImages.get(id) ?? "",
    };
  });
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<CatalogSnapshot>(() => loadSnapshot());

  const persist = (next: CatalogSnapshot) => {
    const stamped = { ...next, updatedAt: new Date().toISOString() };
    setSnapshot(stamped);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stamped));
  };

  const value = useMemo<CatalogContextValue>(() => {
    const getVendor = (id: string) => snapshot.vendors.find((v) => v.id === id);
    const getProduct = (id: string) => snapshot.products.find((p) => p.id === id);
    const productsByVendor = (vendorId: string) =>
      snapshot.products.filter((p) => p.vendorId === vendorId);
    const productsByType = (type: string) =>
      snapshot.products.filter((p) => p.productType === type);

    const productTypes = sortPlatformCategories(
      Array.from(new Set(snapshot.products.map((p) => p.productType))),
    );

    const setSalesWhatsapp = (phone: string) => {
      persist({ ...snapshot, salesWhatsapp: phone.replace(/\D/g, "") });
    };

    const updateVendorMoq = (vendorId: string, moq: Vendor["moq"]) => {
      persist({
        ...snapshot,
        vendors: snapshot.vendors.map((v) =>
          v.id === vendorId ? { ...v, moq } : v,
        ),
      });
    };

    const upsertVendor = (vendor: Vendor) => {
      const exists = snapshot.vendors.some((v) => v.id === vendor.id);
      persist({
        ...snapshot,
        vendors: exists
          ? snapshot.vendors.map((v) => (v.id === vendor.id ? vendor : v))
          : [...snapshot.vendors, vendor],
      });
    };

    const applyQuotation = async ({
      vendorId,
      file,
      rows: providedRows,
    }: {
      vendorId: string;
      file: File;
      rows?: ParsedQuotationRow[];
    }) => {
      if (!isSupportedQuotationFile(file)) {
        throw new Error("Upload PDF, image, Excel, or CSV.");
      }
      const vendor = getVendor(vendorId);
      if (!vendor) throw new Error("Unknown vendor.");

      let rows = providedRows;
      if (!rows) {
        if (isSpreadsheetFile(file)) {
          rows = await parseQuotationFile(file);
        } else {
          throw new Error(
            "PDF/image saved as quotation file only when paired with Excel/CSV product rows. For now upload .xlsx/.csv, or send the PDF/image in chat for import.",
          );
        }
      }

      const existingImages = new Map<string, string>();
      for (const product of productsByVendor(vendorId)) {
        existingImages.set(product.productNumber, product.image);
        existingImages.set(product.id, product.image);
      }

      const nextProductsForVendor = rowsToProducts(
        vendorId,
        rows,
        existingImages,
      );
      const otherProducts = snapshot.products.filter((p) => p.vendorId !== vendorId);
      const prevQuote = snapshot.quotations.find((q) => q.vendorId === vendorId);
      const version = (prevQuote?.version ?? 0) + 1;
      const previewDataUrl = await fileToPreviewDataUrl(file);
      const quotation: QuotationSource = {
        vendorId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        version,
        previewDataUrl,
        rowCount: nextProductsForVendor.length,
      };

      persist({
        ...snapshot,
        products: [...otherProducts, ...nextProductsForVendor],
        quotations: [
          ...snapshot.quotations.filter((q) => q.vendorId !== vendorId),
          quotation,
        ],
      });

      return { rowCount: nextProductsForVendor.length, version };
    };

    const resetToSeed = () =>
      persist(normalizeSnapshot(structuredClone(SEED_CATALOG)));

    return {
      vendors: snapshot.vendors,
      products: snapshot.products,
      quotations: snapshot.quotations,
      salesWhatsapp: snapshot.salesWhatsapp,
      productTypes,
      getVendor,
      getProduct,
      productsByVendor,
      productsByType,
      setSalesWhatsapp,
      updateVendorMoq,
      upsertVendor,
      applyQuotation,
      resetToSeed,
    };
  }, [snapshot]);

  return (
    <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
  );
}

export function useCatalog() {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error("useCatalog must be used within CatalogProvider");
  return ctx;
}
