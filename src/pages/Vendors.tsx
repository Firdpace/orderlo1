import { Link } from "react-router-dom";
import { formatMoq } from "../data/seed";
import { useCatalog } from "../context/CatalogContext";

export function Vendors() {
  const { vendors, productsByVendor, quotations } = useCatalog();

  return (
    <div className="page page-pad">
      <header className="page-header">
        <h1>供應商</h1>
        <p>每家獨立報價版本、MOQ 同 WhatsApp 確認。</p>
      </header>

      <div className="vendor-list">
        {vendors.map((vendor) => {
          const count = productsByVendor(vendor.id).length;
          const quote = quotations.find((q) => q.vendorId === vendor.id);
          return (
            <Link key={vendor.id} to={`/vendor/${vendor.id}`} className="vendor-row">
              <img src={vendor.image} alt="" loading="lazy" />
              <div className="vendor-row-body">
                <h2>{vendor.name}</h2>
                <p>{vendor.tagline}</p>
                <span className="meta">
                  {formatMoq(vendor.moq)} · {count} 項
                  {quote ? ` · 報價 v${quote.version}` : ""}
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
    </div>
  );
}
