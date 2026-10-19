import { useMemo, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { formatMoq } from "../data/seed";
import { useAuth } from "../context/AuthContext";
import { useCatalog } from "../context/CatalogContext";

export function AdminLoginPage() {
  const { isAdmin, login } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  if (isAdmin) return <Navigate to="/admin" replace />;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (login(pin)) {
      setError("");
    } else {
      setError("Incorrect admin PIN.");
    }
  };

  return (
    <div className="page page-pad">
      <header className="page-header">
        <h1>管理員</h1>
        <p>上載供應商報價，會覆蓋該供應商舊版產品表。</p>
      </header>
      <form className="checkout-form" onSubmit={onSubmit}>
        <label>
          Admin PIN
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Default demo PIN: 2468"
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block">
          Sign in
        </button>
      </form>
    </div>
  );
}

export function AdminPage() {
  const { isAdmin, logout, changePin } = useAuth();
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
  const [pinForm, setPinForm] = useState({ current: "", next: "" });

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === vendorId),
    [vendors, vendorId],
  );
  const quote = quotations.find((q) => q.vendorId === vendorId);

  if (!isAdmin) return <Navigate to="/admin/login" replace />;

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
          確認掣會開 WhatsApp，帶貨號、名稱、數量、價錢。
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
              placeholder="60123456789"
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
        <h2>Security</h2>
        <form
          className="checkout-form"
          onSubmit={(e) => {
            e.preventDefault();
            const ok = changePin(pinForm.current, pinForm.next);
            setStatus(ok ? "Admin PIN updated." : "Could not change PIN.");
            if (ok) setPinForm({ current: "", next: "" });
          }}
        >
          <label>
            Current PIN
            <input
              type="password"
              value={pinForm.current}
              onChange={(e) =>
                setPinForm((s) => ({ ...s, current: e.target.value }))
              }
              required
            />
          </label>
          <label>
            New PIN
            <input
              type="password"
              value={pinForm.next}
              onChange={(e) =>
                setPinForm((s) => ({ ...s, next: e.target.value }))
              }
              minLength={4}
              required
            />
          </label>
          <button type="submit" className="btn btn-secondary btn-block">
            Change PIN
          </button>
        </form>
        <button type="button" className="btn btn-ghost btn-block" onClick={logout}>
          Sign out
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
