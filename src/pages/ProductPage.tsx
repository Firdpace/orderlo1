import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { formatMoq, formatPrice } from "../data/seed";
import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
import { hasProductPhoto } from "../lib/productPhoto";

export function ProductPage() {
  const { productId = "" } = useParams();
  const { getProduct, getVendor } = useCatalog();
  const product = getProduct(productId);
  const vendor = product ? getVendor(product.vendorId) : undefined;
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [flashed, setFlashed] = useState(false);

  if (!product || !vendor) {
    return (
      <div className="page page-pad">
        <p>搵唔到呢件貨。</p>
        <Link to="/shop">返回選購</Link>
      </div>
    );
  }

  const onAdd = () => {
    if (!(product.price > 0)) return;
    addItem(product.id);
    setAdded(true);
    setFlashed(true);
    window.setTimeout(() => setFlashed(false), 450);
    window.setTimeout(() => setAdded(false), 1600);
  };

  const showPhoto = hasProductPhoto(product);
  const pkg = product.size?.trim() || "";
  const orderUnit = product.orderUnit?.trim() || product.unit?.trim() || "";
  const unitPrice =
    product.unitPrice != null && product.unitPrice > 0
      ? `${formatPrice(product.unitPrice)}${product.unitPriceLabel || ""}`
      : "";
  const canAdd = product.price > 0;

  return (
    <div className="page">
      {showPhoto && (
        <div className="product-hero">
          <img src={product.image} alt={product.name} />
        </div>
      )}
      <div className={`page-pad product-detail ${showPhoto ? "" : "product-detail-solo"}`}>
        <p className="eyebrow">
          <Link to={`/vendor/${vendor.id}`}>{vendor.name}</Link>
          {product.productType ? ` · ${product.productType}` : ""}
        </p>
        <h1>{product.name}</h1>
        <ul className="product-facts">
          {product.brand ? (
            <li>
              <span>Brand</span>
              <strong>{product.brand}</strong>
            </li>
          ) : null}
          {pkg ? (
            <li>
              <span>包裝規格</span>
              <strong>{pkg}</strong>
            </li>
          ) : null}
          {orderUnit ? (
            <li>
              <span>訂貨單位</span>
              <strong>{orderUnit}</strong>
            </li>
          ) : null}
          <li>
            <span>價錢（每訂貨單位）</span>
            <strong>{canAdd ? formatPrice(product.price) : "查詢報價"}</strong>
          </li>
          {unitPrice ? (
            <li>
              <span>單價</span>
              <strong>{unitPrice}</strong>
            </li>
          ) : null}
        </ul>
        <p className="meta" style={{ marginBottom: 12 }}>
          此供應商 {formatMoq(vendor.moq)}
        </p>
        <p className="product-desc">{product.description || "—"}</p>
        <div className="product-detail-actions">
          <Link
            to={`/compare/${product.id}`}
            className="btn btn-icon btn-compare"
            aria-label="比較"
            title="比較"
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3v18" />
              <path d="M5 7h14" />
              <path d="M8 7l-3 7h6l-3-7z" />
              <path d="M16 7l-3 7h6l-3-7z" />
              <path d="M7 21h10" />
            </svg>
          </Link>
          {canAdd ? (
            <button
              type="button"
              className={`btn btn-icon btn-add btn-add-lg ${flashed ? "btn-add-flash" : ""}`}
              onClick={onAdd}
              aria-label={added ? `已加入 ${vendor.name}` : "加入購物車"}
              title="加入"
            >
              {added ? "✓" : "+"}
            </button>
          ) : (
            <span
              className="btn btn-icon btn-ask btn-add-lg"
              title="查詢報價"
              aria-label="查詢報價（無標價）"
            >
              查詢
            </span>
          )}
        </div>
        <Link to="/carts" className="text-link">
          查看購物車 / WhatsApp 確認
        </Link>
      </div>
    </div>
  );
}
