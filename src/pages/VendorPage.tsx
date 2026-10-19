import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { formatMoq } from "../data/seed";
import { ProductTile } from "../components/ProductTile";
import { useCatalog } from "../context/CatalogContext";
import {
  sortPlatformCategories,
  subcategoryLabel,
} from "../lib/platformCategory";
import type { Product } from "../data/types";

type SubGroup = { sub: string; items: Product[] };
type CategoryGroup = { category: string; items: Product[]; subs: SubGroup[] };

function groupBySub(items: Product[]): SubGroup[] {
  const map = new Map<string, Product[]>();
  for (const product of items) {
    const key = subcategoryLabel(product);
    const bucket = map.get(key);
    if (bucket) bucket.push(product);
    else map.set(key, [product]);
  }
  return [...map.entries()]
    .map(([sub, groupItems]) => ({ sub, items: groupItems }))
    .sort((a, b) => {
      if (b.items.length !== a.items.length) return b.items.length - a.items.length;
      return a.sub.localeCompare(b.sub, "zh-Hant");
    });
}

export function VendorPage() {
  const { vendorId = "" } = useParams();
  const { getVendor, productsByVendor, quotations } = useCatalog();
  const vendor = getVendor(vendorId);
  const list = productsByVendor(vendorId);
  const quote = quotations.find((q) => q.vendorId === vendorId);

  const groups = useMemo<CategoryGroup[]>(() => {
    const map = new Map<string, Product[]>();
    for (const product of list) {
      const key = product.productType?.trim() || "其他";
      const bucket = map.get(key);
      if (bucket) bucket.push(product);
      else map.set(key, [product]);
    }
    const ordered = sortPlatformCategories([...map.keys()]);
    const rest = [...map.keys()]
      .filter((k) => !ordered.includes(k as (typeof ordered)[number]))
      .sort((a, b) => a.localeCompare(b, "zh-Hant"));
    return [...ordered, ...rest].map((category) => {
      const items = map.get(category) ?? [];
      return { category, items, subs: groupBySub(items) };
    });
  }, [list]);

  if (!vendor) {
    return (
      <div className="page page-pad">
        <p>搵唔到呢家供應商。</p>
        <Link to="/vendors">返回供應商</Link>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="vendor-hero">
        <img src={vendor.image} alt="" />
        <div className="vendor-hero-copy">
          <p className="eyebrow">供應商</p>
          <h1>{vendor.name}</h1>
          <p>{vendor.tagline}</p>
          <p className="meta">
            {vendor.focus} · {formatMoq(vendor.moq)} · {list.length} 項 · {groups.length}{" "}
            類
            {quote ? ` · 報價 v${quote.version}` : ""}
          </p>
          {vendor.deliverySchedule ? (
            <p className="vendor-cheuki">
              <span>車期</span>
              {vendor.deliverySchedule}
            </p>
          ) : null}
        </div>
      </section>

      <div className="vendor-category-jump page-pad">
        {groups.map(({ category, items }) => (
          <a key={category} href={`#cat-${encodeURIComponent(category)}`} className="filter-chip">
            {category} ({items.length})
          </a>
        ))}
      </div>

      {groups.map(({ category, items, subs }) => (
        <section
          key={category}
          id={`cat-${encodeURIComponent(category)}`}
          className="section vendor-category-section"
        >
          <div className="section-head">
            <h2>{category}</h2>
            <p>
              {items.length} 項 · {subs.length} 細類 · 加入後只入 {vendor.name} 購物車
            </p>
          </div>

          {subs.map(({ sub, items: subItems }) => {
            const showSubHeading = !(subs.length === 1 && sub === category);
            return (
              <div key={sub} className="vendor-subcategory">
                {showSubHeading ? (
                  <div className="vendor-subcategory-head">
                    <h3>{sub}</h3>
                    <span>{subItems.length} 項</span>
                  </div>
                ) : null}
                <div className="product-list">
                  {subItems.map((product) => (
                    <ProductTile key={product.id} product={product} />
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
