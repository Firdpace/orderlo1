import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { formatMoq } from "../data/seed";
import { useAuth } from "../context/AuthContext";
import { useCatalog } from "../context/CatalogContext";
import { displayPhone, type LocalUser } from "../lib/auth";
import { isValidPin } from "../lib/pin";

export function AdminLoginPage() {
  const { adminUnlocked, unlockAdmin } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (adminUnlocked) return <Navigate to="/admin" replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!isValidPin(pin.trim())) {
        setError("請輸入 4 位數字 PIN。");
        return;
      }
      const ok = await unlockAdmin(pin.trim());
      if (!ok) setError("Admin PIN 不正確。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-pad">
      <header className="page-header">
        <h1>管理員</h1>
        <p>輸入網站 Admin PIN 以管理報價、用戶同設定。</p>
      </header>
      <form className="checkout-form" onSubmit={onSubmit}>
        <label>
          Admin PIN
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) =>
              setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="預設：1234"
            maxLength={4}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={busy}
        >
          {busy ? "驗證中…" : "解鎖管理員"}
        </button>
      </form>
    </div>
  );
}

export function AdminPage() {
  const {
    adminUnlocked,
    lockAdmin,
    changePin,
    user: me,
    refreshUsers,
    setUserEnabled,
  } = useAuth();
  const {
    vendors,
    quotations,
    salesWhatsapp,
    setSalesWhatsapp,
    updateVendorMoq,
    applyQuotation,
    resetToSeed,
    productsByVendor,
  } = useCatalog();

  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState(salesWhatsapp);
  const [pinForm, setPinForm] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [users, setUsers] = useState<LocalUser[]>([]);

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId),
    [vendors, vendorId],
  );
  const quote = quotations.find((q) => q.vendorId === vendorId);

  useEffect(() => {
    if (!adminUnlocked) return;
    void refreshUsers().then(setUsers);
  }, [adminUnlocked, refreshUsers]);

  if (!adminUnlocked) return <Navigate to="/admin/login" replace />;

  const onUpload = async (file: File | null) => {
    if (!file || !vendorId) return;
    setBusy(true);
    setStatus("");
    try {
      const result = await applyQuotation({ vendorId, file });
      setStatus(
        `Uploaded ${file.name} as quotation v${result.version} — ${result.rowCount} products now live (previous list overwritten).`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-pad">
      <header className="page-header">
        <h1>管理員</h1>
        <p>新報價會覆蓋該供應商舊產品表。現有貨源已由你上傳嘅報價匯入。</p>
      </header>

      <section className="admin-card">
        <h2>業務 WhatsApp</h2>
        <p className="meta">
          落單訊息只含品名、數量同小計（HKD）。複製或開啟 WhatsApp
          時會儲存最近紀錄。
        </p>
        <form
          className="checkout-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSalesWhatsapp(phone);
            setStatus("Sales WhatsApp number saved.");
          }}
        >
          <label>
            WhatsApp number (country code, digits only)
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="85291234567"
              required
            />
          </label>
          <button type="submit" className="btn btn-secondary btn-block">
            Save number
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>Upload quotation</h2>
        <p className="meta">
          Accepts Excel/CSV to replace products. PDF/images: send in chat for
          first import, or convert to Excel for self-serve overwrite.
        </p>
        <label>
          Vendor
          <select
            value={vendorId}
            onChange={(e) => setVendorId(e.target.value)}
            className="select-input"
          >
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name} ({formatMoq(vendor.moq)})
              </option>
            ))}
          </select>
        </label>

        {selectedVendor && (
          <div className="moq-edit">
            <p className="meta">
              Live SKUs: {productsByVendor(selectedVendor.id).length}
              {quote
                ? ` · Current file: ${quote.fileName} (v${quote.version})`
                : " · No quotation file yet"}
            </p>
            <div className="moq-edit-row">
              <select
                className="select-input"
                value={selectedVendor.moq.type}
                onChange={(e) =>
                  updateVendorMoq(selectedVendor.id, {
                    ...selectedVendor.moq,
                    type: e.target.value as "quantity" | "amount",
                  })
                }
              >
                <option value="amount">MOQ by amount ($)</option>
                <option value="quantity">MOQ by quantity (pcs)</option>
              </select>
              <input
                className="select-input"
                type="number"
                min={1}
                value={selectedVendor.moq.value}
                onChange={(e) =>
                  updateVendorMoq(selectedVendor.id, {
                    ...selectedVendor.moq,
                    value: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
        )}

        <label className="upload-box">
          <span>{busy ? "Uploading…" : "Choose PDF, image, Excel, or CSV"}</span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/pdf,image/*"
            disabled={busy}
            onChange={(e) => onUpload(e.target.files?.[0] ?? null)}
          />
        </label>
        {status && <p className="admin-status">{status}</p>}
      </section>

      <section className="admin-card">
        <h2>Quotation versions</h2>
        {quotations.length === 0 ? (
          <p className="meta">No uploads yet — demo catalog is active.</p>
        ) : (
          <ul className="quote-list">
            {quotations.map((q) => {
              const vendor = vendors.find((v) => v.id === q.vendorId);
              return (
                <li key={`${q.vendorId}-${q.version}`}>
                  <strong>{vendor?.name ?? q.vendorId}</strong>
                  <span>
                    v{q.version} · {q.fileName} · {q.rowCount} rows ·{" "}
                    {new Date(q.uploadedAt).toLocaleString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="admin-card">
        <h2>管理用戶</h2>
        <p className="meta">
          啟用或停用帳戶。首個註冊用戶為管理員。停用後無法登入。
        </p>
        {users.length === 0 ? (
          <p className="meta">未有註冊用戶。</p>
        ) : (
          <ul className="user-admin-list">
            {users.map((u) => (
              <li key={u.id} className="user-admin-row">
                <div>
                  <strong>{displayPhone(u.phoneE164)}</strong>
                  <span className="meta">
                    {u.isAdmin ? "Admin · " : ""}
                    {u.enabled ? "已啟用" : "已停用"}
                    {me?.id === u.id ? " · 你" : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className={`btn ${u.enabled ? "btn-ghost" : "btn-secondary"}`}
                  disabled={me?.id === u.id}
                  onClick={() => {
                    void (async () => {
                      const next = await setUserEnabled(u.id, !u.enabled);
                      setUsers(next);
                      setStatus(
                        u.enabled
                          ? `已停用 ${displayPhone(u.phoneE164)}`
                          : `已啟用 ${displayPhone(u.phoneE164)}`,
                      );
                    })();
                  }}
                >
                  {u.enabled ? "停用" : "啟用"}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            void refreshUsers().then((list) => {
              setUsers(list);
              setStatus("用戶列表已更新。");
            });
          }}
        >
          重新整理用戶
        </button>
      </section>

      <section className="admin-card">
        <h2>Security</h2>
        <form
          className="checkout-form"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              if (pinForm.next !== pinForm.confirm) {
                setStatus("新 PIN 兩次輸入唔一致。");
                return;
              }
              if (!isValidPin(pinForm.next)) {
                setStatus("新 PIN 必須為 4 位數字。");
                return;
              }
              const ok = await changePin(pinForm.current, pinForm.next);
              setStatus(ok ? "Admin PIN 已更新。" : "無法更改 PIN。");
              if (ok) setPinForm({ current: "", next: "", confirm: "" });
            })();
          }}
        >
          <label>
            Current PIN
            <input
              type="password"
              inputMode="numeric"
              value={pinForm.current}
              onChange={(e) =>
                setPinForm((s) => ({
                  ...s,
                  current: e.target.value.replace(/\D/g, "").slice(0, 4),
                }))
              }
              maxLength={4}
              required
            />
          </label>
          <label>
            New PIN
            <input
              type="password"
              inputMode="numeric"
              value={pinForm.next}
              onChange={(e) =>
                setPinForm((s) => ({
                  ...s,
                  next: e.target.value.replace(/\D/g, "").slice(0, 4),
                }))
              }
              maxLength={4}
              required
            />
          </label>
          <label>
            Confirm new PIN
            <input
              type="password"
              inputMode="numeric"
              value={pinForm.confirm}
              onChange={(e) =>
                setPinForm((s) => ({
                  ...s,
                  confirm: e.target.value.replace(/\D/g, "").slice(0, 4),
                }))
              }
              maxLength={4}
              required
            />
          </label>
          <button type="submit" className="btn btn-secondary btn-block">
            Change PIN
          </button>
        </form>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={lockAdmin}
        >
          鎖定管理員（需再輸入 PIN）
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => {
            if (confirm("Reset catalog to demo seed?")) {
              resetToSeed();
              setStatus("Catalog reset to demo seed.");
            }
          }}
        >
          Reset demo catalog
        </button>
        <Link to="/" className="text-link">
          Back to shop
        </Link>
      </section>
    </div>
  );
}
