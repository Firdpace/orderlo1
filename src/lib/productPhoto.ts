import type { Product } from "../data/types";

/** Quotations rarely include photos — only treat real URLs as displayable. */
export function hasProductPhoto(product: Pick<Product, "image"> | undefined) {
  const image = product?.image?.trim() ?? "";
  if (!image) return false;
  // Ignore stock placeholders used before quote import.
  if (image.includes("images.unsplash.com")) return false;
  return true;
}
