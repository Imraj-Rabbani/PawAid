import { useState, useEffect, useCallback, useMemo } from "react";
import { CartContext, maxQuantity } from "./cartContext";

const STORAGE_KEY = "cart";

// The cart is kept in the browser as { ownerId, items }. ownerId is the signed in
// user who filled it (null for a guest). A guest cart is adopted on sign in, but a
// cart that belongs to someone else is never shown, so signing out or switching
// accounts on a shared browser doesn't leak it.
const currentUserId = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null")?.id ?? null;
  } catch {
    return null;
  }
};

const readStoredCart = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (stored && Array.isArray(stored.items)) return stored;
  } catch {
    // unreadable storage means an empty cart
  }
  return { ownerId: null, items: [] };
};

// just what the cart needs to render without a fetch; the cart page refreshes it
const snapshot = (product) => ({
  id: product.id,
  name: product.name,
  imageUrl: product.imageUrl,
  sellingPrice: product.sellingPrice,
  stockQty: product.stockQty,
  rescueContribution: product.rescueContribution,
  category: product.category,
});

export default function CartProvider({ children }) {
  const [stored, setStored] = useState(readStoredCart);
  const userId = currentUserId();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // storage can be full or blocked, the cart still works for this visit
    }
  }, [stored]);

  // keep other open tabs in step
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) setStored(readStoredCart());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // every change starts from the cart the current user can see, and claims it
  const update = useCallback((change) => {
    setStored((prev) => {
      const owner = currentUserId();
      const items = prev.ownerId && prev.ownerId !== owner ? [] : prev.items;
      return { ownerId: owner, items: change(items) };
    });
  }, []);

  const addItem = useCallback(
    (product, quantity = 1) =>
      update((items) => {
        const existing = items.find((item) => item.productId === product.id);
        const nextQuantity = Math.min((existing?.quantity ?? 0) + quantity, maxQuantity(product));
        if (nextQuantity <= 0) return items;
        if (existing) {
          return items.map((item) =>
            item.productId === product.id ? { ...item, quantity: nextQuantity, product: snapshot(product) } : item
          );
        }
        return [...items, { productId: product.id, quantity: nextQuantity, product: snapshot(product) }];
      }),
    [update]
  );

  const setQuantity = useCallback(
    (productId, quantity) =>
      update((items) =>
        items.map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.max(Math.min(quantity, maxQuantity(item.product)), 1) }
            : item
        )
      ),
    [update]
  );

  const removeItem = useCallback(
    (productId) => update((items) => items.filter((item) => item.productId !== productId)),
    [update]
  );

  const clear = useCallback(() => update(() => []), [update]);

  // Replace saved snapshots with the server's current products. Anything missing
  // from `fresh` was deactivated or deleted and is marked unavailable; quantities
  // above the remaining stock are lowered.
  const syncProducts = useCallback(
    (fresh) =>
      update((items) => {
        const byId = new Map(fresh.map((product) => [product.id, product]));
        return items.map((item) => {
          const product = byId.get(item.productId);
          if (!product) return { ...item, unavailable: true };
          const limit = maxQuantity(product);
          return {
            productId: item.productId,
            product: snapshot(product),
            quantity: limit > 0 ? Math.min(item.quantity, limit) : item.quantity,
          };
        });
      }),
    [update]
  );

  const value = useMemo(() => {
    const visible = stored.ownerId && stored.ownerId !== userId ? [] : stored.items;
    const purchasable = visible.filter((item) => !item.unavailable && item.product.stockQty > 0);
    return {
      items: visible,
      count: visible.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: purchasable.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0),
      rescueTotal: purchasable.reduce((sum, item) => sum + item.product.rescueContribution * item.quantity, 0),
      quantityOf: (productId) => visible.find((item) => item.productId === productId)?.quantity ?? 0,
      addItem,
      setQuantity,
      removeItem,
      clear,
      syncProducts,
    };
  }, [stored, userId, addItem, setQuantity, removeItem, clear, syncProducts]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
