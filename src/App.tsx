import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CatalogProvider } from "./context/CatalogContext";
import { CartProvider } from "./context/CartContext";
import { AuthGate } from "./components/AuthGate";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Shop } from "./pages/Shop";
import { Vendors } from "./pages/Vendors";
import { VendorPage } from "./pages/VendorPage";
import { ProductPage } from "./pages/ProductPage";
import { ComparePage } from "./pages/ComparePage";
import { CartsPage } from "./pages/CartsPage";
import { AdminLoginPage, AdminPage } from "./pages/AdminPage";

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <CatalogProvider>
          <CartProvider>
            <BrowserRouter>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="shop" element={<Shop />} />
                  <Route path="vendors" element={<Vendors />} />
                  <Route path="vendor/:vendorId" element={<VendorPage />} />
                  <Route path="product/:productId" element={<ProductPage />} />
                  <Route path="compare/:productId" element={<ComparePage />} />
                  <Route path="carts" element={<CartsPage />} />
                  <Route path="admin/login" element={<AdminLoginPage />} />
                  <Route path="admin" element={<AdminPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </CatalogProvider>
      </AuthGate>
    </AuthProvider>
  );
}
