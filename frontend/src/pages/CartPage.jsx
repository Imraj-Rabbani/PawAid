import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Icon from "../components/Icon";
import { ProductImage } from "../components/marketplace/ProductCard";
import QuantityStepper from "../components/marketplace/QuantityStepper";
import { taka } from "../components/marketplace/marketplaceUtils";
import { useCart, maxQuantity } from "../context/cartContext";

export default function CartPage() {
  const { items, count, subtotal, rescueTotal, setQuantity, removeItem, clear, syncProducts } = useCart();
  const [syncError, setSyncError] = useState("");
  // products already checked against the server on this visit
  const synced = useRef(new Set());

  const idsKey = items.map((item) => item.productId).sort().join(",");

  // prices, stock and availability may have changed since the items were added
  useEffect(() => {
    const ids = idsKey.split(",").filter((id) => id && !synced.current.has(id));
    if (ids.length === 0) return;
    let ignore = false;

    api
      .get("/marketplace/products", { params: { ids: ids.join(","), limit: 48 } })
      .then((res) => {
        if (ignore) return;
        ids.forEach((id) => synced.current.add(id));
        syncProducts(res.data.data.filter((product) => ids.includes(product.id)));
        setSyncError("");
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) setSyncError("Couldn't check the latest prices and stock. Showing what was saved.");
      });

    return () => {
      ignore = true;
    };
  }, [idsKey, syncProducts]);

  const unavailableCount = items.filter((item) => item.unavailable || item.product.stockQty <= 0).length;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
        >
          <Icon name="arrow_back" className="text-[18px]" />
          Continue shopping
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <h1 className="font-display text-3xl font-bold text-on-surface">
            Your cart
            {count > 0 && (
              <span className="ml-2 text-lg font-semibold text-on-surface-variant">
                ({count} {count === 1 ? "item" : "items"})
              </span>
            )}
          </h1>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Remove everything from your cart?")) clear();
              }}
              className="text-sm font-semibold text-on-surface-variant hover:text-error transition-colors"
            >
              Clear cart
            </button>
          )}
        </div>

        {syncError && (
          <p role="status" className="mt-4 p-3 text-sm rounded-xl bg-surface-container-low text-on-surface-variant">
            {syncError}
          </p>
        )}

        {items.length === 0 ? (
          <div className="mt-6 py-16 text-center bg-surface-container-lowest rounded-2xl shadow-sm">
            <Icon name="shopping_cart" className="text-[56px] text-on-surface-variant/40" />
            <p className="mt-3 font-display text-lg font-semibold text-on-surface">Your cart is empty</p>
            <p className="mt-1 text-sm text-on-surface-variant">Rescue supplies you add will show up here.</p>
            <Link
              to="/marketplace"
              className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl shadow-sm hover:bg-primary-container transition"
            >
              <Icon name="storefront" className="text-[18px]" />
              Browse the marketplace
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <ul className="lg:col-span-2 bg-surface-container-lowest rounded-2xl shadow-sm divide-y divide-surface-container-high">
              {items.map((item) => (
                <CartLine
                  key={item.productId}
                  item={item}
                  onQuantity={(quantity) => setQuantity(item.productId, quantity)}
                  onRemove={() => removeItem(item.productId)}
                />
              ))}
            </ul>

            <aside className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 lg:sticky lg:top-26">
              <h2 className="font-display text-lg font-bold text-on-surface">Order summary</h2>

              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">Subtotal</dt>
                  <dd className="font-semibold text-on-surface">{taka(subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-on-surface-variant">Delivery</dt>
                  <dd className="text-on-surface-variant">Calculated at checkout</dd>
                </div>
                <div className="flex justify-between pt-3 border-t border-surface-container-high">
                  <dt className="font-semibold text-on-surface">Total</dt>
                  <dd className="font-display text-xl font-bold text-on-surface">{taka(subtotal)}</dd>
                </div>
              </dl>

              {rescueTotal > 0 && (
                <p className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-secondary-container/40 text-xs text-on-surface">
                  <Icon name="pets" className="text-[18px] text-secondary" />
                  <span>
                    <span className="font-semibold">{taka(rescueTotal)}</span> of this order goes to the rescue fund.
                  </span>
                </p>
              )}

              {unavailableCount > 0 && (
                <p className="mt-3 text-xs text-on-surface-variant">
                  {unavailableCount === 1 ? "1 item isn't" : `${unavailableCount} items aren't`} available and{" "}
                  {unavailableCount === 1 ? "is" : "are"} left out of the total.
                </p>
              )}

              <button
                type="button"
                disabled
                className="mt-5 w-full px-5 py-3 text-sm font-semibold text-white bg-primary rounded-xl shadow-sm opacity-50 cursor-not-allowed"
              >
                Proceed to checkout
              </button>
              <p className="mt-2 text-center text-xs text-on-surface-variant">
                Checkout is coming soon. Your cart is saved on this device.
              </p>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function CartLine({ item, onQuantity, onRemove }) {
  const { product, quantity, unavailable } = item;
  const soldOut = !unavailable && product.stockQty <= 0;
  const blocked = unavailable || soldOut;
  const href = `/marketplace/${product.id}`;

  return (
    <li className="flex gap-4 p-4">
      <Link to={href} tabIndex={-1} aria-hidden="true" className="shrink-0">
        <ProductImage
          product={product}
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl ${blocked ? "opacity-50 grayscale" : ""}`}
        />
      </Link>

      <div className="flex-1 min-w-0 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
            {product.category?.name}
          </p>
          <Link to={href} className="block font-semibold text-on-surface hover:text-primary transition-colors truncate">
            {product.name}
          </Link>
          <p className="text-sm text-on-surface-variant">{taka(product.sellingPrice)} each</p>
          {unavailable && <p className="mt-1 text-xs font-semibold text-error">No longer available</p>}
          {soldOut && <p className="mt-1 text-xs font-semibold text-error">Out of stock</p>}
          {!blocked && quantity >= product.stockQty && (
            <p className="mt-1 text-xs text-on-surface-variant">Only {product.stockQty} in stock</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
          <p className="font-display font-bold text-on-surface sm:order-first">
            {blocked ? "—" : taka(product.sellingPrice * quantity)}
          </p>
          <div className="flex items-center gap-2">
            {!blocked && (
              <QuantityStepper
                value={quantity}
                max={maxQuantity(product)}
                onChange={onQuantity}
                label={`Quantity of ${product.name}`}
              />
            )}
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ${product.name}`}
              title="Remove"
              className="p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/50 transition"
            >
              <Icon name="delete" className="text-[20px]" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
