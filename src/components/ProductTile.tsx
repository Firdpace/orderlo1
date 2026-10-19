import { Link } from "react-router-dom";
import { useState } from "react";
import { formatPrice } from "../data/seed";
import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
import type { Product } from "../data/types";
import { hasProductPhoto } from "../lib/productPhoto";

function packageSize(product: Product) {
  return product.size?.trim() || "";
}

function orderUnit(product: Product) {
  return product.orderUnit?.trim() || product.unit?.trim() || "";
}

function IconScale({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
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
  );
}

export function ProductTile({ product }: { product: Product }) {
  const { getVendor } = useCatalog();
  const vendor = getVendor(product.vendorId);
  const { addItem } = useCart();
  const [flashed, setFlashed] = useState(false);
  const pkg = packageSize(product);
  const order = orderUnit(product);
  const showPhoto = hasProductPhoto(product);
  const unitPrice =
    product.unitPrice != null && product.unitPrice > 0
      ? `${formatPrice(product.unitPrice)}${product.unitPriceLabel || ""}`
      : "";

  const onAdd = () => {
    addItem(product.id);
    setFlashed(true);
    window.setTimeout(() => setFlashed(false), 450);
  };

  return (
    <article className={`product-tile${showPhoto ? " product-tile-with-photo" : ""}`}>
      {showPhoto ? (
        <Link to={`/product/${product.id}`} className="product-tile-photo">
          <img src={product.image} alt="" loading="lazy" />
        </Link>
      ) : null}
      <div className="product-tile-main">
        <p className="product-tile-vendor">{vendor?.name}</p>
        <Link to={`/product/${product.id}`} className="product-tile-title">
          {product.name}
          {order ? <span className="product-tile-orderunit"> · {order}</span> : null}
        </Link>
        <div className="product-tile-facts">
          {product.brand ? <span>{product.brand}</span> : null}
          {pkg ? <span>{pkg}</span> : null}
          <span className="product-tile-price">
            {product.price > 0 ? formatPrice(product.price) : "查詢報價"}
          </span>
          {unitPrice ? <span className="product-tile-unitprice">{unitPrice}</span> : null}
        </div>
      </div>
      <div className="product-tile-actions">
        <Link
          to={`/compare/${product.id}`}
          className="btn btn-icon btn-compare"
          aria-label={`比較 ${product.name}`}
          title="比較"
        >
          <IconScale />
        </Link>
        <button
          type="button"
          className={`btn btn-icon btn-add ${flashed ? "btn-add-flash" : ""}`}
          onClick={onAdd}
          aria-label={`加入 ${product.name}`}
          title="加入"
        >
          +
        </button>
      </div>
    </article>
  );
}
