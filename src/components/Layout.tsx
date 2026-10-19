import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { CartToast } from "./CartToast";

export function Layout() {
  const { itemCount, vendorCount } = useCart();
  const { isAdmin } = useAuth();
  const location = useLocation();
  const hideTabbar = location.pathname.startsWith("/admin");

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand-mini">
          Orderlo
        </NavLink>
        <div className="topbar-actions">
          <NavLink to={isAdmin ? "/admin" : "/admin/login"} className="admin-chip">
            Admin
          </NavLink>
          <NavLink to="/carts" className="cart-chip" aria-label="Open carts">
            <span className="cart-chip-label">購物車</span>
            <span className="cart-chip-meta">
              {vendorCount > 0
                ? `${vendorCount} 家 · ${itemCount}`
                : "未有貨"}
            </span>
          </NavLink>
        </div>
      </header>

      <main className={`main ${hideTabbar ? "main-flush" : ""}`}>
        <Outlet />
      </main>

      <CartToast />

      {!hideTabbar && (
        <nav className="tabbar" aria-label="Primary">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "tab active" : "tab")}>
            首頁
          </NavLink>
          <NavLink to="/shop" className={({ isActive }) => (isActive ? "tab active" : "tab")}>
            貨類
          </NavLink>
          <NavLink to="/vendors" className={({ isActive }) => (isActive ? "tab active" : "tab")}>
            供應商
          </NavLink>
          <NavLink to="/carts" className={({ isActive }) => (isActive ? "tab active" : "tab")}>
            購物車
            {itemCount > 0 && <span className="tab-badge">{itemCount}</span>}
          </NavLink>
        </nav>
      )}
    </div>
  );
}
