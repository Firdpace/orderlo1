export type ProductType = string;

export type MoqRule = {
  /** Compare cart line quantities or cart subtotal against the threshold. */
  type: "quantity" | "amount";
  value: number;
};

export type Vendor = {
  id: string;
  name: string;
  tagline: string;
  focus: string;
  image: string;
  moq: MoqRule;
  /** Digits only preferred; used if per-vendor sales chat differs. */
  whatsappSales?: string;
  /** Hide SKU / product number in shopper UI (still kept for WhatsApp/admin). */
  hideProductNumber?: boolean;
  /** Delivery days / lead time from quotation first page (車期). */
  deliverySchedule?: string;
};

export type Product = {
  id: string;
  /** Vendor SKU / product number shown on WhatsApp orders. */
  productNumber: string;
  vendorId: string;
  name: string;
  brand: string;
  /**
   * Package size (e.g. 1kg printed on the product).
   * Distinct from orderUnit — you may order 6kg while each pack is 1kg.
   */
  size: string;
  /**
   * Order unit from the quotation (what qty=1 means).
   * Example: package is 1kg, order unit is 6kg / 6PCS.
   */
  orderUnit: string;
  /** Platform browse category (雜貨 / 乾貨 / …). */
  productType: ProductType;
  /** Original quotation category before platform regroup. */
  sourceCategory?: string;
  /** Price for one order unit. */
  price: number;
  /** @deprecated prefer orderUnit */
  unit: string;
  /** Price per measurable unit when known (e.g. per KG / 斤). */
  unitPrice?: number | null;
  unitPriceLabel?: string;
  description: string;
  image: string;
};

export type QuotationSource = {
  vendorId: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  /** Overwrites previous version for this vendor. */
  version: number;
  /** Optional preview for images; skipped for large binaries. */
  previewDataUrl?: string;
  rowCount: number;
};

export type CatalogSnapshot = {
  vendors: Vendor[];
  products: Product[];
  quotations: QuotationSource[];
  /** Shared sales WhatsApp number (country code, no +). */
  salesWhatsapp: string;
  updatedAt: string;
  currency?: "HKD" | "USD";
};

export type ParsedQuotationRow = {
  productNumber: string;
  name: string;
  brand?: string;
  productType: string;
  price: number;
  unit: string;
  unitPrice?: number | null;
  unitPriceLabel?: string;
  description?: string;
};
