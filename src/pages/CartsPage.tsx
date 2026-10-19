import { Link } from "react-router-dom";
import { useCallback, useState } from "react";
import { formatMoq, formatPrice } from "../data/seed";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
import { moqProgress } from "../lib/moq";
import {
  listWaHistoryForUser,
  saveWaHistoryEntry,
  type WaHistoryEntry,
} from "../lib/waHistory";
import {
  buildWhatsAppOrderMessage,
  whatsappOrderUrl,
} from "../lib/whatsapp";

async function copyText(message: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(message);
    return;
  }
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
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(carts[0]?.vendorId ?? null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [historyCopiedId, setHistoryCopiedId] = useState<string | null>(null);

  // historyTick bumps after save / refresh so we re-read localStorage.
  const history =
    user && historyTick >= 0
      ? listWaHistoryForUser(user.id)
      : ([] as WaHistoryEntry[]);

  const reloadHistory = useCallback(() => {
    setHistoryTick((n) => n + 1);
  }, []);

  const persistOrder = useCallback(
    (args: {
      vendorId: string;
      vendorName: string;
      messageText: string;
      lines: WaHistoryEntry["lines"];
      total: number;
    }) => {
      if (!user) return;
      saveWaHistoryEntry({
        userId: user.id,
        vendorId: args.vendorId,
        vendorName: args.vendorName,
        messageText: args.messageText,
        lines: args.lines,
        total: args.total,
      });
      reloadHistory();
    },
    [user, reloadHistory],
  );

  if (vendorCount === 0 && history.length === 0) {
    return (
      <div className="page page-pad empty-state">
        <h1>購物車</h1>
        <p>
          未有供應商購物車。請先揀貨類或供應商落單，達 MOQ
          後再複製訊息用 WhatsApp 確認。
        </p>
        <Link to="/" className="btn btn-primary">
          開始選購
        </Link>
      </div>
    );
  }

  const copyOrder = async (
    vendorId: string,
    built: ReturnType<typeof buildWhatsAppOrderMessage>,
    vendorName: string,
  ) => {
    setCopyError(null);
    try {
      await copyText(built.text);
      persistOrder({
        vendorId,
        vendorName,
        messageText: built.text,
        lines: built.lines,
        total: built.total,
      });
      setCopiedId(vendorId);
      window.setTimeout(
        () => setCopiedId((id) => (id === vendorId ? null : id)),
        2200,
      );
    } catch {
      setCopyError("複製失敗，請手動選取訊息。");
      setCopiedId(vendorId);
    }
  };

  const openWhatsApp = (
    vendorId: string,
    phone: string,
    built: ReturnType<typeof buildWhatsAppOrderMessage>,
    vendorName: string,
  ) => {
    persistOrder({
      vendorId,
      vendorName,
      messageText: built.text,
      lines: built.lines,
      total: built.total,
    });
    if (!phone) {
      setCopyError("未設定業務 WhatsApp 號碼，請先複製訊息或於管理員設定。");
      setCopiedId(vendorId);
      return;
    }
    window.open(whatsappOrderUrl(phone, built.text), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="page page-pad">
      <header className="page-header">
        <h1>購物車</h1>
        <p>
          {vendorCount > 0
            ? `${vendorCount} 家供應商 · 達 MOQ 後複製或開啟 WhatsApp；會自動儲存最近 2 次落單訊息。`
            : "暫無進行中購物車；可重看下方 WhatsApp 紀錄。"}
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
          const built = buildWhatsAppOrderMessage({ vendor, lines, subtotal });
          const message = built.text;
          const copied = copiedId === cart.vendorId;
          const vendorHistory = history.filter((h) => h.vendorId === cart.vendorId);

          return (
            <section
              key={cart.vendorId}
              className={`cart-drawer ${open ? "open" : ""}`}
            >
              <div className="cart-drawer-header">
                <div className="cart-drawer-heading">
                  <Link to={`/vendor/${vendor.id}`} className="cart-vendor-link">
                    {vendor.name}
                  </Link>
                  <span>
                    {lines.length} 項 · {formatPrice(subtotal)} ·{" "}
                    {formatMoq(vendor.moq)}
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
                                <span className="product-tile-orderunit">
                                  {" "}
                                  · {orderUnit}
                                </span>
                              ) : null}
                            </Link>
                            <span className="cart-line-unitprice">
                              {formatPrice(product.price)}
                              {orderUnit ? ` each` : ""}
                            </span>
                          </div>
                          <div className="cart-line-right">
                            <p className="cart-line-subtotal">
                              {formatPrice(lineTotal)}
                            </p>
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
                          onClick={() =>
                            void copyOrder(cart.vendorId, built, vendor.name)
                          }
                        >
                          {copied ? "已複製並儲存" : "複製並儲存 WhatsApp 訊息"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-block"
                          onClick={() =>
                            openWhatsApp(
                              cart.vendorId,
                              phone,
                              built,
                              vendor.name,
                            )
                          }
                        >
                          開啟 WhatsApp
                        </button>
                        {copied ? (
                          <div className="wa-copy-panel">
                            <p className="meta">
                              已複製並儲存。可開啟 WhatsApp
                              {phone ? `（${phone}）` : ""} 貼上傳送。
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
                      <button
                        type="button"
                        className="btn btn-primary btn-block"
                        disabled
                      >
                        未達 MOQ，未能確認
                      </button>
                    )}
                    {vendorHistory.length > 0 ? (
                      <div className="wa-history-inline">
                        <p className="meta">
                          此供應商最近 {vendorHistory.length} 則落單訊息
                        </p>
                        {vendorHistory.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            className="btn btn-ghost btn-block"
                            onClick={() => {
                              void copyText(entry.messageText).then(() => {
                                setHistoryCopiedId(entry.id);
                                window.setTimeout(
                                  () =>
                                    setHistoryCopiedId((id) =>
                                      id === entry.id ? null : id,
                                    ),
                                  1800,
                                );
                              });
                            }}
                          >
                            {historyCopiedId === entry.id
                              ? "已再複製"
                              : `再複製 · ${new Date(entry.createdAt).toLocaleString()} · HKD ${entry.total.toFixed(2)}`}
                          </button>
                        ))}
                      </div>
                    ) : null}
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

      <section className="wa-history-section">
        <h2>WhatsApp 落單紀錄</h2>
        <p className="meta">
          每個供應商最多保留最近 2 則（此帳戶）。複製或開啟 WhatsApp
          時自動儲存。
        </p>
        {history.length === 0 ? (
          <p className="meta">未有儲存紀錄。</p>
        ) : (
          <ul className="wa-history-list">
            {history.map((entry) => (
              <li key={entry.id} className="wa-history-card">
                <div className="wa-history-head">
                  <strong>{entry.vendorName}</strong>
                  <span className="meta">
                    {new Date(entry.createdAt).toLocaleString()} · HKD{" "}
                    {entry.total.toFixed(2)}
                  </span>
                </div>
                <ul className="wa-history-lines">
                  {entry.lines.map((line, i) => (
                    <li key={`${entry.id}-${i}`}>
                      {line.name} × {line.qty} = HKD {line.subtotal.toFixed(2)}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => {
                    void copyText(entry.messageText).then(() => {
                      setHistoryCopiedId(entry.id);
                      window.setTimeout(
                        () =>
                          setHistoryCopiedId((id) =>
                            id === entry.id ? null : id,
                          ),
                        1800,
                      );
                    });
                  }}
                >
                  {historyCopiedId === entry.id ? "已再複製" : "再複製訊息"}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={reloadHistory}
        >
          重新整理紀錄
        </button>
      </section>
    </div>
  );
}
