import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import api from "../services/api";
import { useIdempotencyKey, withIdempotencyKey } from "../services/idempotency";
import Navbar from "../components/Navbar";
import Icon from "../components/Icon";
import { ProductImage } from "../components/marketplace/ProductCard";
import { taka } from "../components/marketplace/marketplaceUtils";
import { useCart } from "../context/cartContext";
import useCartSync from "../context/useCartSync";

const firstError = (err, fallback) => {
  const errors = err.response?.data?.errors;
  const fieldError = errors && Object.values(errors).flat()[0];
  return fieldError || err.response?.data?.message || fallback;
};

export default function CheckoutPage() {
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const userId = currentUser?.id;
  const [account, setAccount] = useState({ profile: null, balance: null, error: "" });

  useEffect(() => {
    if (!userId) return;
    let ignore = false;

    Promise.all([api.get(`/profile/${userId}`), api.get("/wallet/me")])
      .then(([profileRes, walletRes]) => {
        if (!ignore) setAccount({ profile: profileRes.data, balance: walletRes.data.data.balance, error: "" });
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) setAccount({ profile: null, balance: null, error: firstError(err, "Failed to load checkout") });
      });

    return () => {
      ignore = true;
    };
  }, [userId]);

  if (!currentUser) return <Navigate to="/signin?redirect=/checkout" replace />;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <Link
          to="/cart"
          className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
        >
          <Icon name="arrow_back" className="text-[18px]" />
          Back to cart
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold text-on-surface">Checkout</h1>

        {account.error ? (
          <div className="mt-6 p-4 bg-error-container border border-error/20 rounded-2xl">
            <p className="text-sm text-on-error-container">{account.error}</p>
          </div>
        ) : !account.profile ? (
          <p className="py-16 text-center text-on-surface-variant">Loading checkout...</p>
        ) : (
          <CheckoutForm key={account.profile.id} profile={account.profile} balance={account.balance} />
        )}
      </main>
    </div>
  );
}

function CheckoutForm({ profile, balance }) {
  const navigate = useNavigate();
  const { items, removeItems } = useCart();
  const { syncError, syncing, resync } = useCartSync();

  const lines = items.filter((item) => !item.unavailable && item.product.stockQty > 0);
  const skipped = items.length - lines.length;
  const total = lines.reduce((sum, item) => sum + item.product.sellingPrice * item.quantity, 0);
  const rescueTotal = lines.reduce((sum, item) => sum + item.product.rescueContribution * item.quantity, 0);

  const isVolunteer = profile.volunteerProfile?.status === "ACTIVE";
  const walletCovers = isVolunteer && balance >= total;

  const [delivery, setDelivery] = useState({
    name: profile.name || "",
    phone: profile.phone || "",
    address: profile.address || "",
  });
  const [saveAddress, setSaveAddress] = useState(!profile.address);
  const [method, setMethod] = useState(walletCovers ? "WALLET" : "CASH");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  // the same key for every try at this payment, so a retry can't charge twice;
  // a success leaves this screen, so it never needs a new one
  const [idempotencyKey] = useIdempotencyKey();

  const addressChanged = delivery.address.trim() !== (profile.address || "").trim();
  const walletBlocked = method === "WALLET" && !walletCovers;

  const placeOrder = async (event) => {
    event.preventDefault();
    if (placing || walletBlocked) return;
    setError("");
    setPlacing(true);

    try {
      const res = await api.post("/orders", {
        items: lines.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        paymentMethod: method,
        delivery,
        saveAddress: saveAddress && addressChanged,
        expectedTotal: total,
      }, withIdempotencyKey(idempotencyKey));
      removeItems(lines.map((item) => item.productId));
      navigate(`/orders/${res.data.data.id}`, { replace: true, state: { justPlaced: true } });
    } catch (err) {
      console.error(err);
      setError(firstError(err, "Failed to place your order. You have not been charged."));
      // the server says the cart is stale: pull fresh prices and stock so the summary is right
      if (err.response?.data?.code === "CART_CHANGED") resync();
      setPlacing(false);
    }
  };

  if (lines.length === 0) {
    return (
      <div className="mt-6 py-16 text-center bg-surface-container-lowest rounded-2xl shadow-sm">
        <Icon name="remove_shopping_cart" className="text-[56px] text-on-surface-variant/40" />
        <p className="mt-3 font-display text-lg font-semibold text-on-surface">Nothing to check out</p>
        <p className="mt-1 text-sm text-on-surface-variant">
          {items.length > 0 ? "None of the items in your cart can be bought right now." : "Your cart is empty."}
        </p>
        <Link
          to={items.length > 0 ? "/cart" : "/marketplace"}
          className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl shadow-sm hover:bg-primary-container transition"
        >
          {items.length > 0 ? "Review your cart" : "Browse the marketplace"}
        </Link>
      </div>
    );
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container-highest placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition";

  return (
    <form onSubmit={placeOrder} className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <div className="lg:col-span-2 flex flex-col gap-6">
        {/* ── Delivery ── */}
        <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 md:p-6">
          <SectionTitle step={1} title="Delivery details" />

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-on-surface">Recipient name</span>
              <input
                required
                minLength={3}
                maxLength={100}
                autoComplete="name"
                value={delivery.name}
                onChange={(e) => setDelivery({ ...delivery, name: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-on-surface">Phone number</span>
              <input
                required
                type="tel"
                autoComplete="tel"
                pattern="\+?[0-9][0-9 \-]{5,18}[0-9]"
                title="Digits, spaces or dashes, with an optional leading +"
                placeholder="01XXXXXXXXX"
                value={delivery.phone}
                onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-on-surface">Delivery address</span>
              <textarea
                required
                minLength={10}
                maxLength={500}
                rows={3}
                autoComplete="street-address"
                placeholder="House or building, street, area, city"
                value={delivery.address}
                onChange={(e) => setDelivery({ ...delivery, address: e.target.value })}
                className={`${inputClass} resize-y`}
              />
            </label>
          </div>

          {addressChanged && delivery.address.trim() && (
            <label className="mt-3 flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveAddress}
                onChange={(e) => setSaveAddress(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              {profile.address ? "Replace the address saved on my profile" : "Save this address to my profile"}
            </label>
          )}
        </section>

        {/* ── Payment ── */}
        <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 md:p-6">
          <SectionTitle step={2} title="Payment" />

          <fieldset className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <legend className="sr-only">Payment method</legend>
            <PaymentOption
              value="CASH"
              checked={method === "CASH"}
              onChange={setMethod}
              icon="payments"
              label="Cash on delivery"
              detail="Pay when your order arrives"
            />
            <PaymentOption
              value="WALLET"
              checked={method === "WALLET"}
              onChange={setMethod}
              disabled={!walletCovers}
              icon="account_balance_wallet"
              label="PawAid wallet"
              detail={
                !isVolunteer
                  ? "For active volunteers only"
                  : balance < total
                    ? `Not enough balance (${taka(balance)})`
                    : `Balance ${taka(balance)}`
              }
            />
          </fieldset>

          <p className="mt-4 flex items-start gap-2 text-xs text-on-surface-variant">
            <Icon name="info" className="text-[16px]" />
            {method === "WALLET"
              ? "The total is deducted from your wallet balance when you place the order."
              : `Please have ${taka(total)} in cash ready for the courier when your order arrives.`}
          </p>
        </section>
      </div>

      {/* ── Summary ── */}
      <aside className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 lg:sticky lg:top-26">
        <h2 className="font-display text-lg font-bold text-on-surface">Order summary</h2>

        <ul className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
          {lines.map((item) => (
            <li key={item.productId} className="flex items-center gap-3">
              <div className="relative shrink-0">
                <ProductImage product={item.product} className="w-14 h-14 rounded-lg" />
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-on-surface text-white text-[11px] font-bold">
                  {item.quantity}
                </span>
              </div>
              <p className="flex-1 min-w-0 text-sm font-medium text-on-surface line-clamp-2">{item.product.name}</p>
              <p className="text-sm font-semibold text-on-surface">{taka(item.product.sellingPrice * item.quantity)}</p>
            </li>
          ))}
        </ul>

        {skipped > 0 && (
          <p className="mt-3 text-xs text-on-surface-variant">
            {skipped === 1 ? "1 unavailable item is" : `${skipped} unavailable items are`} left in your cart and not included.
          </p>
        )}

        <dl className="mt-4 pt-4 space-y-3 text-sm border-t border-surface-container-high">
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Subtotal</dt>
            <dd className="font-semibold text-on-surface">{taka(total)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Delivery</dt>
            <dd className="font-semibold text-secondary">Free</dd>
          </div>
          <div className="flex justify-between pt-3 border-t border-surface-container-high">
            <dt className="font-semibold text-on-surface">Total</dt>
            <dd className="font-display text-xl font-bold text-on-surface">{taka(total)}</dd>
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

        {(error || syncError) && (
          <p role="alert" className="mt-4 p-3 text-sm rounded-xl bg-error-container text-on-error-container">
            {error || syncError}
          </p>
        )}

        <button
          type="submit"
          disabled={placing || syncing || walletBlocked}
          className="mt-5 w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-primary rounded-xl shadow-sm hover:bg-primary-container disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Icon name="lock" className="text-[18px]" />
          {placing ? "Placing order..." : syncing ? "Checking prices..." : `Place order · ${taka(total)}`}
        </button>
      </aside>
    </form>
  );
}

function SectionTitle({ step, title }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-lg font-bold text-on-surface">
      <span className="w-7 h-7 flex items-center justify-center rounded-full bg-primary-fixed text-on-primary-fixed text-sm">
        {step}
      </span>
      {title}
    </h2>
  );
}

function PaymentOption({ value, checked, onChange, disabled = false, icon, label, detail }) {
  return (
    <label
      className={`flex items-center gap-3 p-4 rounded-xl border-2 transition ${
        disabled
          ? "border-surface-container-high opacity-60 cursor-not-allowed"
          : checked
            ? "border-primary bg-primary-fixed/30 cursor-pointer"
            : "border-surface-container-high hover:border-outline-variant cursor-pointer"
      }`}
    >
      <input
        type="radio"
        name="paymentMethod"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="w-4 h-4 accent-primary"
      />
      <Icon name={icon} className={`text-[22px] ${checked ? "text-primary" : "text-on-surface-variant"}`} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-on-surface">{label}</span>
        <span className="block text-xs text-on-surface-variant">{detail}</span>
      </span>
    </label>
  );
}
