import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useCatalog } from "./CatalogContext";
import type { Product, Vendor } from "../data/types";

export type CartLine = {
  productId: string;
  quantity: number;
};

export type VendorCart = {
  vendorId: string;
  lines: CartLine[];
};

export type CartAddToast = {
  id: number;
  productId: string;
  productName: string;
  vendorName: string;
  quantity: number;
};

type CartContextValue = {
  carts: VendorCart[];
  addItem: (productId: string, quantity?: number) => void;
  removeItem: (vendorId: string, productId: string) => void;
  setQuantity: (vendorId: string, productId: string, quantity: number) => void;
  clearVendorCart: (vendorId: string) => void;
  clearAll: () => void;
  vendorCount: number;
  itemCount: number;
  addToast: CartAddToast | null;
  getVendorSubtotal: (vendorId: string) => number;
  getVendorQuantity: (vendorId: string) => number;
  getCartLines: (vendorId: string) => Array<{
    product: Product;
    quantity: number;
    lineTotal: number;
  }>;
  getActiveVendors: () => Vendor[];
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "orderlo-carts-v1";
const TOAST_MS = 2000;

function loadCarts(): VendorCart[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VendorCart[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const catalog = useCatalog();
  const [carts, setCarts] = useState<VendorCart[]>(() => loadCarts());
  const [addToast, setAddToast] = useState<CartAddToast | null>(null);
  const toastTimer = useRef<number | null>(null);
  const toastSeq = useRef(0);

  useEffect(() => {
    return () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const persist = (next: VendorCart[]) => {
    setCarts(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const value = useMemo<CartContextValue>(() => {
    const addItem = (productId: string, quantity = 1) => {
      const product = catalog.getProduct(productId);
      if (!product) return;
      const vendor = catalog.getVendor(product.vendorId);

      const next = carts.map((c) => ({
        ...c,
        lines: c.lines.map((l) => ({ ...l })),
      }));
      let cart = next.find((c) => c.vendorId === product.vendorId);
      if (!cart) {
        cart = { vendorId: product.vendorId, lines: [] };
        next.push(cart);
      }
      const line = cart.lines.find((l) => l.productId === productId);
      if (line) line.quantity += quantity;
      else cart.lines.push({ productId, quantity });
      persist(next);

      toastSeq.current += 1;
      setAddToast({
        id: toastSeq.current,
        productId: product.id,
        productName: product.name,
        vendorName: vendor?.name ?? "",
        quantity,
      });
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => {
        setAddToast(null);
        toastTimer.current = null;
      }, TOAST_MS);
    };

    const removeItem = (vendorId: string, productId: string) => {
      persist(
        carts
          .map((cart) =>
            cart.vendorId === vendorId
              ? {
                  ...cart,
                  lines: cart.lines.filter((l) => l.productId !== productId),
                }
              : cart,
          )
          .filter((cart) => cart.lines.length > 0),
      );
    };

    const setQuantity = (
      vendorId: string,
      productId: string,
      quantity: number,
    ) => {
      if (quantity <= 0) {
        removeItem(vendorId, productId);
        return;
      }
      persist(
        carts.map((cart) =>
          cart.vendorId === vendorId
            ? {
                ...cart,
                lines: cart.lines.map((l) =>
                  l.productId === productId ? { ...l, quantity } : l,
                ),
              }
            : cart,
        ),
      );
    };

    const clearVendorCart = (vendorId: string) => {
      persist(carts.filter((c) => c.vendorId !== vendorId));
    };

    const clearAll = () => persist([]);

    const getCartLines = (vendorId: string) => {
      const cart = carts.find((c) => c.vendorId === vendorId);
      if (!cart) return [];
      return cart.lines
        .map((line) => {
          const product = catalog.getProduct(line.productId);
          if (!product) return null;
          return {
            product,
            quantity: line.quantity,
            lineTotal: product.price * line.quantity,
          };
        })
        .filter(Boolean) as Array<{
        product: Product;
        quantity: number;
        lineTotal: number;
      }>;
    };

    const getVendorSubtotal = (vendorId: string) =>
      getCartLines(vendorId).reduce((sum, line) => sum + line.lineTotal, 0);

    const getVendorQuantity = (vendorId: string) =>
      getCartLines(vendorId).reduce((sum, line) => sum + line.quantity, 0);

    const getActiveVendors = () =>
      carts
        .map((c) => catalog.getVendor(c.vendorId))
        .filter(Boolean) as Vendor[];

    const itemCount = carts.reduce(
      (sum, cart) =>
        sum + cart.lines.reduce((lineSum, line) => lineSum + line.quantity, 0),
      0,
    );

    return {
      carts,
      addItem,
      removeItem,
      setQuantity,
      clearVendorCart,
      clearAll,
      vendorCount: carts.length,
      itemCount,
      addToast,
      getVendorSubtotal,
      getVendorQuantity,
      getCartLines,
      getActiveVendors,
    };
  }, [carts, catalog, addToast]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
