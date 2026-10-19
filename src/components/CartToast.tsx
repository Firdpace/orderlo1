import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

export function CartToast() {
  const { addToast } = useCart();
  if (!addToast) return null;

  return (
    <div className="cart-toast" role="status" aria-live="polite" key={addToast.id}>
      <p className="cart-toast-eyebrow">已加入購物車</p>
      <p className="cart-toast-name">{addToast.productName}</p>
      <p className="cart-toast-meta">
        {addToast.vendorName}
        {addToast.quantity > 1 ? ` · ×${addToast.quantity}` : ""}
      </p>
      <Link to="/carts" className="cart-toast-link">
        睇購物車
      </Link>
    </div>
  );
}
