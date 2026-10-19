import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ProductTile } from "../components/ProductTile";
import { useCatalog } from "../context/CatalogContext";
import {
  listSubcategories,
  subcategoryLabel,
} from "../lib/platformCategory";

export function Shop() {
  const { products, productTypes, vendors } = useCatalog();
  const [params, setParams] = useSearchParams();
  const type = params.get("type") ?? "all";
  const sub = params.get("sub") ?? "all";
  const vendorId = params.get("vendor") ?? "all";

  const sortedTypes = productTypes;

  const subcategories = useMemo(() => {
    if (type === "all") return [];
    return listSubcategories(products, type);
  }, [products, type]);

  const list = useMemo(() => {
    return products.filter((p) => {
      const typeOk = type === "all" || p.productType === type;
      const subOk =
        type === "all" || sub === "all" || subcategoryLabel(p) === sub;
      const vendorOk = vendorId === "all" || p.vendorId === vendorId;
      return typeOk && subOk && vendorOk;
    });
  }, [products, type, sub, vendorId]);

  const setType = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("type");
    else next.set("type", value);
    // Subcategories are scoped to the selected platform category.
    next.delete("sub");
    setParams(next);
  };

  const setSub = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("sub");
    else next.set("sub", value);
    setParams(next);
  };

  const setVendor = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("vendor");
    else next.set("vendor", value);
    setParams(next);
  };

  return (
    <div className="page page-pad">
      <header className="page-header">
        <h1>選購</h1>
        <p>可同時用貨類同供應商篩選 · 購物車仍然分家計。</p>
      </header>

      <p className="filter-label">貨類</p>
      <div className="filter-row" role="tablist" aria-label="Product type">
        <button
          type="button"
          className={type === "all" ? "filter-chip active" : "filter-chip"}
          onClick={() => setType("all")}
        >
          全部
        </button>
        {sortedTypes.map((value) => (
          <button
            key={value}
            type="button"
            className={type === value ? "filter-chip active" : "filter-chip"}
            onClick={() => setType(value)}
          >
            {value}
          </button>
        ))}
      </div>

      {type !== "all" && subcategories.length > 0 ? (
        <div className="filter-sublevel" aria-live="polite">
          <p className="filter-label">細類 · {type}</p>
          <div
            className="filter-row filter-row-sub"
            role="tablist"
            aria-label={`${type} subcategories`}
          >
            <button
              type="button"
              className={sub === "all" ? "filter-chip active" : "filter-chip"}
              onClick={() => setSub("all")}
            >
              全部{type}
            </button>
            {subcategories.map((value) => (
              <button
                key={value}
                type="button"
                className={sub === value ? "filter-chip active" : "filter-chip"}
                onClick={() => setSub(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <p className="filter-label">供應商</p>
      <div className="filter-row" role="tablist" aria-label="Vendor">
        <button
          type="button"
          className={vendorId === "all" ? "filter-chip active" : "filter-chip"}
          onClick={() => setVendor("all")}
        >
          全部供應商
        </button>
        {vendors.map((vendor) => (
          <button
            key={vendor.id}
            type="button"
            className={vendorId === vendor.id ? "filter-chip active" : "filter-chip"}
            onClick={() => setVendor(vendor.id)}
          >
            {vendor.name}
          </button>
        ))}
      </div>

      <p className="meta" style={{ marginBottom: 12 }}>
        {list.length} 項 · <Link to="/vendors">供應商一覽</Link>
      </p>

      <div className="product-list">
        {list.map((product) => (
          <ProductTile key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
