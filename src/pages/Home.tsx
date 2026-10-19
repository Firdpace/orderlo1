import { Link } from "react-router-dom";
import { useDeferredValue, useMemo, useState } from "react";
import heroImage from "../assets/hero.jpg";
import { formatMoq } from "../data/seed";
import { ProductTile } from "../components/ProductTile";
import { useCatalog } from "../context/CatalogContext";
import type { Product } from "../data/types";

const SEARCH_LIMIT = 80;

function matchesQuery(
  product: Product,
  vendorName: string,
  tokens: string[],
): boolean {
  if (tokens.length === 0) return false;
  const haystack = [
    product.name,
    product.brand,
    product.productNumber,
    product.productType,
    product.sourceCategory,
    product.orderUnit,
    product.unit,
    product.description,
    vendorName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

export function Home() {
  const { vendors, productTypes, products, getVendor } = useCatalog();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());

  const topTypes = useMemo(() => {
    return productTypes.map((type) => ({
      type,
      count: products.filter((p) => p.productType === type).length,
    }));
  }, [productTypes, products]);

  const { searchHits, totalMatchCount } = useMemo(() => {
    const tokens = deferredQuery
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (tokens.length === 0) {
      return { searchHits: [] as Product[], totalMatchCount: 0 };
    }

    const hits: Product[] = [];
    let total = 0;
    for (const product of products) {
      const vendorName = getVendor(product.vendorId)?.name ?? "";
      if (!matchesQuery(product, vendorName, tokens)) continue;
      total += 1;
      if (hits.length < SEARCH_LIMIT) hits.push(product);
    }
    return { searchHits: hits, totalMatchCount: total };
  }, [products, deferredQuery, getVendor]);

  const searching = deferredQuery.length > 0;

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-media" aria-hidden="true">
          <img src={heroImage} alt="" />
          <div className="hero-scrim" />
        </div>
        <div className="hero-content reveal">
          <p className="brand-mark">Orderlo</p>
          <h1 className="hero-headline">先選貨類，或直接揀供應商。</h1>
          <p className="hero-lede">
            {products.length.toLocaleString()} 項報價 · {vendors.length}{" "}
            家供應商 · 各家獨立購物車，達 MOQ 後 WhatsApp 確認給業務。
          </p>
        </div>
      </section>

      <section className="home-search page-pad" aria-label="搜尋全部供應商">
        <label className="home-search-label" htmlFor="home-product-search">
          搜尋全部供應商
        </label>
        <div className="home-search-field">
          <input
            id="home-product-search"
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="品名、牌子、貨類、供應商…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              className="home-search-clear"
              onClick={() => setQuery("")}
              aria-label="清除搜尋"
            >
              清除
            </button>
          ) : null}
        </div>
      </section>

      {searching ? (
        <section className="section home-search-results">
          <div className="section-head">
            <h2>搜尋結果</h2>
            <p>
              {totalMatchCount === 0
                ? "搵唔到"
                : totalMatchCount > SEARCH_LIMIT
                  ? `顯示前 ${SEARCH_LIMIT} / ${totalMatchCount} 項`
                  : `${totalMatchCount} 項`}
            </p>
          </div>
          {searchHits.length === 0 ? (
            <p className="meta">試吓改關鍵字，或用貨類／供應商瀏覽。</p>
          ) : (
            <div className="product-list">
              {searchHits.map((product) => (
                <ProductTile key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="section">
            <div className="section-head">
              <h2>按貨類選購</h2>
              <p>共 {productTypes.length} 類 · 點入後再揀細類</p>
            </div>
            <div className="choice-grid">
              {topTypes.map(({ type, count }) => (
                <Link
                  key={type}
                  to={`/shop?type=${encodeURIComponent(type)}`}
                  className="choice-tile"
                >
                  <strong>{type}</strong>
                  <span>{count} 項</span>
                </Link>
              ))}
            </div>
            <Link to="/shop" className="text-link">
              睇晒全部貨類
            </Link>
          </section>

          <section className="section section-vendors">
            <div className="section-head">
              <h2>按供應商選購</h2>
              <p>每家獨立 MOQ，確認時只傳該車貨單給業務。</p>
            </div>
            <div className="vendor-strip">
              {vendors.map((vendor) => {
                const count = products.filter((p) => p.vendorId === vendor.id)
                  .length;
                return (
                  <Link
                    key={vendor.id}
                    to={`/vendor/${vendor.id}`}
                    className="vendor-strip-item"
                  >
                    <img src={vendor.image} alt="" loading="lazy" />
                    <div>
                      <strong>{vendor.name}</strong>
                      <span>
                        {count} 項 · {formatMoq(vendor.moq)}
                      </span>
                      {vendor.deliverySchedule ? (
                        <span className="vendor-cheuki-inline">
                          車期 · {vendor.deliverySchedule}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
