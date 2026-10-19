import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { formatMoq, formatPrice } from "../data/seed";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
import { moqProgress } from "../lib/moq";
import { listShopsForUser, type Shop } from "../lib/shops";
import {
  listWaHistoryForUser,
  saveWaHistoryEntry,
  type WaHistoryEntry,
} from "../lib/waHistory";
import { buildWhatsAppOrderMessage } from "../lib/whatsapp";

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

function QtyInput(props: {
  value: number;
  onCommit: (next: number) => void;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const [draft, setDraft] = useState(String(props.value));

  useEffect(() => {
    setDraft(String(props.value));
  }, [props.value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(String(props.value));
      return;
    }
    const n = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(n) || n < 0) {
      setDraft(String(props.value));
      return;
    }
    // 0 removes the line (matches +/- stepper / setQuantity behavior).
    props.onCommit(n);
    if (n > 0) setDraft(String(n));
  };

  return (
    <div className="qty-row">
      <button type="button" aria-label="Decrease" onClick={props.onDecrement}>
        −
      </button>
      <input
        className="qty-input"
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={draft}
        aria-label="Quantity"
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
      <button type="button" aria-label="Increase" onClick={props.onIncrement}>
        +
      </button>
    </div>
  );
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
  const { getVendor } = useCatalog();
  const { user } = useAuth();
  const [openId, setOpenId] = useState<string | null>(carts[0]?.vendorId ?? null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const [historyCopiedId, setHistoryCopiedId] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [pickerVendorId, setPickerVendorId] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<{
    vendorId: string;
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!user) {
      setShops([]);
      return;
    }
    setShops(listShopsForUser(user.id));
  }, [user, pickerVendorId, copiedId]);

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

  const beginCopy = (vendorId: string) => {
    setCopyError(null);
    if (!user) return;
    const currentShops = listShopsForUser(user.id);
    setShops(currentShops);
    if (currentShops.length === 0) {
      setCopyError("請先在個人資料新增店舖，再複製落單訊息。");
      setCopiedId(vendorId);
      return;
    }
    setPickerVendorId(vendorId);
  };

  const confirmCopyWithShop = async (shop: Shop) => {
    const vendorId = pickerVendorId;
    if (!vendorId) return;
    const vendor = getVendor(vendorId);
    if (!vendor) return;
    const lines = getCartLines(vendorId);
    const subtotal = getVendorSubtotal(vendorId);
    const built = buildWhatsAppOrderMessage({
      vendor,
      shopName: shop.name,
      lines,
      subtotal,
    });
    setPickerVendorId(null);
    setCopyError(null);
    try {
      await copyText(built.text);
      persistOrder({
        vendorId,
        vendorName: vendor.name,
        messageText: built.text,
        lines: built.lines,
        total: built.total,
      });
      setLastMessage({ vendorId, text: built.text });
      setCopiedId(vendorId);
      window.setTimeout(
        () => setCopiedId((id) => (id === vendorId ? null : id)),
        2200,
      );
    } catch {
      setCopyError("複製失敗，請手動選取訊息。");
      setLastMessage({ vendorId, text: built.text });
      setCopiedId(vendorId);
    }
  };

  const pickerVendor = pickerVendorId ? getVendor(pickerVendorId) : null;

  return (
    <div className="page page-pad">
      <header className="page-header">
        <h1>購物車</h1>
        <p>
          {vendorCount > 0
            ? `${vendorCount} 家供應商 · 達 MOQ 後複製 WhatsApp 訊息；會自動儲存最近 2 次落單訊息。`
            : "暫無進行中購物車；可重看下方 WhatsApp 紀錄。"}
        </p>
      </header>

      {pickerVendorId && pickerVendor ? (
        <div
          className="shop-picker-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="shop-picker-title"
        >
          <div className="shop-picker-sheet">
            <h2 id="shop-picker-title">揀送貨店舖</h2>
            <p className="meta">
              複製給 {pickerVendor.name} 的落單訊息前，請揀一間店舖。
            </p>
            <ul className="shop-picker-list">
              {shops.map((shop) => (
                <li key={shop.id}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-block shop-picker-item"
                    onClick={() => void confirmCopyWithShop(shop)}
                  >
                    <strong>{shop.name}</strong>
                    <span className="meta">{shop.deliveryAddress}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Link to="/profile" className="btn btn-ghost btn-block">
              管理店舖（個人資料）
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              onClick={() => setPickerVendorId(null)}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

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
          const copied = copiedId === cart.vendorId;
          const messagePreview =
            lastMessage?.vendorId === cart.vendorId ? lastMessage.text : null;

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
                            <QtyInput
                              value={qty}
                              onDecrement={() =>
                                setQuantity(cart.vendorId, product.id, qty - 1)
                              }
                              onIncrement={() =>
                                setQuantity(cart.vendorId, product.id, qty + 1)
                              }
                              onCommit={(next) =>
                                setQuantity(cart.vendorId, product.id, next)
                              }
                            />
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
                          onClick={() => beginCopy(cart.vendorId)}
                        >
                          {copied ? "已複製並儲存" : "複製 WhatsApp 訊息"}
                        </button>
                        {copied && messagePreview ? (
                          <div className="wa-copy-panel">
                            <p className="meta">
                              已複製並儲存。請自行開啟 WhatsApp 貼上傳送。
                            </p>
                            <textarea
                              className="wa-copy-text"
                              readOnly
                              rows={8}
                              value={messagePreview}
                              onFocus={(e) => e.currentTarget.select()}
                            />
                          </div>
                        ) : null}
                        {copyError && copiedId === cart.vendorId ? (
                          <p className="meta">
                            {copyError}{" "}
                            {copyError.includes("個人資料") ? (
                              <Link to="/profile" className="text-link">
                                前往個人資料
                              </Link>
                            ) : null}
                          </p>
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
          每個供應商最多保留最近 2 則（此帳戶）。複製訊息時自動儲存。
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
