import { createContext, useContext } from "react";

export const CartContext = createContext(null);

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart must be used inside <CartProvider>");
  return cart;
}

// no single cart line goes above this, whatever the stock
export const MAX_PER_ITEM = 99;

export const maxQuantity = (product) => Math.max(Math.min(product.stockQty, MAX_PER_ITEM), 0);
