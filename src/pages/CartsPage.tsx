import { Link } from "react-router-dom";
import { useState } from "react";
import { formatMoq, formatPrice } from "../data/seed";
import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
import { moqProgress } from "../lib/moq";
import { buildWhatsAppOrderMessage } from "../lib/whatsapp";

export function CartsPage() {
  const {
    carts,
    getCartLines,
    getVendorSubtotal,
    getVendorQuantity,
    setQuantity,
    clearVendorCart,
    vendorCount,
  } = useCart();
  const { getVendor, salesWhatsapp } = useCatalog();
  const [openId, setOpenId] = useState<string | null>(carts[0]?.vendorId ?? null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  if (vendorCount === 0) {
    return (
      <div className="page page-pad empty-state">
        <h1>購物車</h1>
        <p>未有供應商購物車。請先揀貨類或供應商落單，達 MOQ 後再複製訊息用 WhatsApp 確認。</p>
        <Link to="/" className="btn btn-primary">
          開始選購
        </Link>
      </div>
    );
  }

  const copyOrder = async (vendorId: string, message: string) => {
    setCopyError(null);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
      } else {
        const ta = document.createElement("textarea");
        ta.value = message;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopiedId(vendorId);
      window.setTimeout(() => setCopiedId((id) => (id === vendorId ? null : id)), 2200);
    } catch {
      setCopyError("複製失敗，請手動選取訊息。");
      setCopiedId(vendorId);
    }
  };

  return (
    <div className="page page-pad">
      <header className="page-header">
        <h1>購物車</h1>
        <p>
          {vendorCount} 家供應商 · 達 MOQ 後先複製落單訊息，再開 WhatsApp 自己貼上傳送。
        </p>
      </header>

      <div className="drawer-stack">
        {carts.map((cart) => {
          const vendor = getVendor(cart.vendorId);
          if (!vendor) return null;
          const open = openId === cart.vendorId;
          const lines = getCartLines(cart.vendorId);
          const subtotal = getVendorSubtotal(cart.vendorId);
          const quantity = getVendorQuantity(cart.vendorId);
          const progress = moqProgress({
            moq: vendor.moq,
            quantity,
            amount: subtotal,
          });
          const phone = vendor.whatsappSales || salesWhatsapp;
          const message = buildWhatsAppOrderMessage({ vendor, lines, subtotal });
          const copied = copiedId === cart.vendorId;

          return (
            <section key={cart.vendorId} className={`cart-drawer ${open ? "open" : ""}`}>
              <div className="cart-drawer-header">
                <div className="cart-drawer-heading">
                  <Link to={`/vendor/${vendor.id}`} className="cart-vendor-link">
                    {vendor.name}
                  </Link>
                  <span>
                    {lines.length} 項 · {formatPrice(subtotal)} · {formatMoq(vendor.moq)}
                  </span>
                </div>
                <button
                  type="button"
                  className="cart-drawer-toggle"
                  aria-expanded={open}
                  aria-label={open ? `收起 ${vendor.name}` : `展開 ${vendor.name}`}
                  onClick={() => setOpenId(open ? null : cart.vendorId)}
                >
                  <span className="chevron" aria-hidden>
                    {open ? "–" : "+"}
                  </span>
                </button>
              </div>

              {open && (
                <div className="cart-drawer-body">
                  <div className="moq-meter" aria-label={progress.label}>
                    <div className="moq-meter-track">
                      <div
                        className={`moq-meter-fill ${progress.met ? "met" : ""}`}
                        style={{ width: `${Math.max(8, progress.ratio * 100)}%` }}
                      />
                    </div>
                    <p className="moq-meter-label">{progress.label}</p>
                  </div>

                  <ul className="cart-lines cart-lines-text">
                    {lines.map(({ product, quantity: qty, lineTotal }) => {
                      const orderUnit =
                        product.orderUnit || product.unit || product.size || "";
                      return (
                        <li key={product.id} className="cart-line-row">
                          <div className="cart-line-copy">
                            <Link to={`/product/${product.id}`}>
                              {vendor.hideProductNumber
                                ? product.name
                                : `${product.productNumber} · ${product.name}`}
                              {orderUnit ? (
                                <span className="product-tile-orderunit"> · {orderUnit}</span>
                              ) : null}
                            </Link>
                            <span className="cart-line-unitprice">
                              {formatPrice(product.price)}
                              {orderUnit ? ` each` : ""}
                            </span>
                          </div>
                          <div className="cart-line-right">
                            <p className="cart-line-subtotal">{formatPrice(lineTotal)}</p>
                            <div className="qty-row">
                              <button
                                type="button"
                                aria-label="Decrease"
                                onClick={() =>
                                  setQuantity(cart.vendorId, product.id, qty - 1)
                                }
                              >
                                −
                              </button>
                              <span>{qty}</span>
                              <button
                                type="button"
                                aria-label="Increase"
                                onClick={() =>
                                  setQuantity(cart.vendorId, product.id, qty + 1)
                                }
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="cart-drawer-actions">
                    <p className="subtotal">
                      小計 <strong>{formatPrice(subtotal)}</strong>
                    </p>
                    {progress.met ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary btn-block"
                          onClick={() => copyOrder(cart.vendorId, message)}
                        >
                          {copied ? "已複製落單訊息" : "複製 WhatsApp 落單訊息"}
                        </button>
                        {copied ? (
                          <div className="wa-copy-panel">
                            <p className="meta">
                              已複製。請開啟 WhatsApp，貼上傳送給業務
                              {phone ? `（${phone}）` : ""}。
                              {/* wa.me redirect paused — reactivate later */}
                            </p>
                            <textarea
                              className="wa-copy-text"
                              readOnly
                              rows={8}
                              value={message}
                              onFocus={(e) => e.currentTarget.select()}
                            />
                          </div>
                        ) : null}
                        {copyError && copiedId === cart.vendorId ? (
                          <p className="meta">{copyError}</p>
                        ) : null}
                      </>
                    ) : (
                      <button type="button" className="btn btn-primary btn-block" disabled>
                        未達 MOQ，未能確認
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-block"
                      onClick={() => clearVendorCart(cart.vendorId)}
                    >
                      清空此供應商購物車
                    </button>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
