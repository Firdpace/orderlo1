import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { formatMoq, formatPrice } from "../data/seed";
import { useCatalog } from "../context/CatalogContext";
import {
  findSameAcrossVendors,
  findSimilarProducts,
  sizeLabel,
  type CompareRow,
} from "../lib/productCompare";

type Metric = {
  key: string;
  label: string;
  value: (row: CompareRow) => string;
};

/** Slim rows only — product name lives in the column header. */
const METRICS: Metric[] = [
  {
    key: "size",
    label: "規格",
    value: (row) => sizeLabel(row.product),
  },
  {
    key: "price",
    label: "價錢",
    value: (row) => formatPrice(row.product.price),
  },
  {
    key: "unitPrice",
    label: "單價",
    value: (row) => {
      const p = row.product;
      if (p.unitPrice != null && p.unitPrice > 0) {
        return `${formatPrice(p.unitPrice)}${p.unitPriceLabel || ""}`;
      }
      return "—";
    },
  },
  {
    key: "moq",
    label: "MOQ",
    value: (row) => (row.vendor ? formatMoq(row.vendor.moq) : "—"),
  },
];

function CompareTable({
  rows,
  emptyHint,
}: {
  rows: CompareRow[];
  emptyHint?: string;
}) {
  if (rows.length === 0) {
    return <p className="meta">{emptyHint || "未有可對照項目。"}</p>;
  }

  return (
    <div className="compare-scroll" role="region" aria-label="欄位對照">
      <table className="compare-table">
        <thead>
          <tr>
            <th scope="col" className="compare-sticky compare-corner">
              {/* narrow label rail */}
            </th>
            {rows.map((row) => (
              <th
                key={row.product.id}
                scope="col"
                className={
                  row.kind === "self"
                    ? "compare-col-head compare-col-self"
                    : "compare-col-head"
                }
              >
                <span className="compare-col-vendor">
                  {row.vendor?.name ?? "—"}
                  {row.kind === "self" ? " ·本" : ""}
                </span>
                <Link
                  to={`/product/${row.product.id}`}
                  className="compare-name-link"
                >
                  {row.product.name}
                </Link>
                <Link
                  to={`/product/${row.product.id}`}
                  className="compare-col-open"
                >
                  睇貨
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRICS.map((metric) => (
            <tr key={metric.key}>
              <th scope="row" className="compare-sticky">
                {metric.label}
              </th>
              {rows.map((row) => (
                <td
                  key={`${row.product.id}-${metric.key}`}
                  className={row.kind === "self" ? "compare-col-self" : undefined}
                >
                  {metric.value(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ComparePage() {
  const { productId = "" } = useParams();
  const { getProduct, getVendor, products } = useCatalog();
  const product = getProduct(productId);
  const vendor = product ? getVendor(product.vendorId) : undefined;

  const sameRows = useMemo(() => {
    if (!product) return [];
    return findSameAcrossVendors(product, products, getVendor);
  }, [product, products, getVendor]);

  const similarRows = useMemo(() => {
    if (!product) return [];
    const exclude = new Set(sameRows.map((r) => r.product.id));
    return findSimilarProducts(product, products, getVendor, exclude);
  }, [product, products, getVendor, sameRows]);

  if (!product || !vendor) {
    return (
      <div className="page page-pad">
        <p>搵唔到呢件貨。</p>
        <Link to="/shop">返回選購</Link>
      </div>
    );
  }

  const crossVendorSame = sameRows.filter((r) => r.kind !== "self");

  return (
    <div className="page page-pad compare-page">
      <header className="page-header">
        <p className="eyebrow">
          <Link to={`/product/${product.id}`}>返回貨品</Link>
          {" · "}
          <Link to={`/vendor/${vendor.id}`}>{vendor.name}</Link>
        </p>
        <h1>比較 · {product.name}</h1>
        <p>欄位對照規格、價錢同各家 MOQ，再決定落邊家。</p>
      </header>

      <section className="compare-section">
        <div className="section-head">
          <h2>1. 同款 · 跨供應商</h2>
          <p>
            {crossVendorSame.length === 0
              ? "暫時未搵到其他供應商有同款"
              : `${crossVendorSame.length + 1} 欄（含本貨）`}
          </p>
        </div>
        <CompareTable
          rows={sameRows}
          emptyHint="暫時未搵到其他供應商有同款。"
        />
      </section>

      <section className="compare-section">
        <div className="section-head">
          <h2>2. 近似貨</h2>
          <p>
            {similarRows.length === 0
              ? "未有近似貨可對照"
              : `${similarRows.length} 欄相近貨類／名稱`}
          </p>
        </div>
        <CompareTable
          rows={similarRows}
          emptyHint="未有近似貨可對照。試吓喺選購用貨類瀏覽。"
        />
      </section>
    </div>
  );
}
