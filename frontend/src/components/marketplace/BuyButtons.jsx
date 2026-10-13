import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../Icon";
import { useCart, maxQuantity } from "../../context/cartContext";

// "Add to cart" + "Buy now". Buy now puts the product in the cart (if it isn't
// already) and goes straight to the cart to check out.
export default function BuyButtons({ product, quantity = 1, size = "sm" }) {
  const navigate = useNavigate();
  const { addItem, quantityOf } = useCart();
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!justAdded) return;
    const id = setTimeout(() => setJustAdded(false), 1500);
    return () => clearTimeout(id);
  }, [justAdded]);

  const inCart = quantityOf(product.id);
  const room = maxQuantity(product) - inCart;
  const soldOut = product.stockQty <= 0;

  const addToCart = () => {
    addItem(product, quantity);
    setJustAdded(true);
  };

  const buyNow = () => {
    if (!inCart) addItem(product, quantity);
    navigate("/cart");
  };

  const sizing = size === "lg" ? "px-5 py-3 text-sm rounded-xl" : "px-3 py-2 text-xs rounded-lg";
  const iconSize = size === "lg" ? "text-[20px]" : "text-[16px]";

  if (soldOut) {
    return (
      <button
        type="button"
        disabled
        className={`w-full font-semibold bg-surface-container-high text-on-surface-variant cursor-not-allowed ${sizing}`}
      >
        Out of stock
      </button>
    );
  }

  return (
    <div className={`grid gap-2 ${size === "lg" ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2"}`}>
      <button
        type="button"
        onClick={addToCart}
        disabled={room <= 0 && !justAdded}
        title={room <= 0 ? "You have all available stock in your cart" : undefined}
        aria-live="polite"
        className={`flex items-center justify-center gap-1.5 font-semibold border transition disabled:opacity-50 disabled:cursor-not-allowed ${sizing} ${
          justAdded
            ? "border-secondary bg-secondary-container text-on-secondary-container"
            : "border-primary text-primary hover:bg-primary-fixed/40"
        }`}
      >
        <Icon name={justAdded ? "check" : "add_shopping_cart"} className={iconSize} />
        {justAdded ? "Added" : room <= 0 ? "Max in cart" : "Add to cart"}
      </button>
      <button
        type="button"
        onClick={buyNow}
        className={`flex items-center justify-center gap-1.5 font-semibold bg-primary text-white shadow-sm hover:bg-primary-container transition ${sizing}`}
      >
        <Icon name="bolt" className={iconSize} />
        Buy now
      </button>
    </div>
  );
}
