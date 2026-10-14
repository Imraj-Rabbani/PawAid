import { useState, useEffect } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Icon from "../components/Icon";
import { ProductImage } from "../components/marketplace/ProductCard";
import { taka } from "../components/marketplace/marketplaceUtils";

const STATUS = {
  PENDING: { label: "Pending", className: "bg-surface-container-high text-on-surface-variant" },
  CONFIRMED: { label: "Confirmed", className: "bg-secondary-container text-on-secondary-container" },
  PROCESSING: { label: "Processing", className: "bg-primary-fixed text-on-primary-fixed" },
  SHIPPED: { label: "Shipped", className: "bg-primary-fixed text-on-primary-fixed" },
  DELIVERED: { label: "Delivered", className: "bg-secondary-container text-on-secondary-container" },
  CANCELLED: { label: "Cancelled", className: "bg-error-container text-on-error-container" },
  REFUNDED: { label: "Refunded", className: "bg-surface-container-high text-on-surface-variant" },
};

const PAYMENT_METHOD = {
  CASH: "Cash on delivery",
  WALLET: "PawAid wallet",
  BKASH: "bKash",
  NAGAD: "Nagad",
  CARD: "Card",
};

export default function OrderPage() {
  const { orderId } = useParams();
  const { state } = useLocation();
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const [result, setResult] = useState({ id: null, order: null, error: "" });

  useEffect(() => {
    if (!currentUser) return;
    let ignore = false;

    api
      .get(`/orders/${orderId}`)
      .then((res) => {
        if (!ignore) setResult({ id: orderId, order: res.data.data, error: "" });
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) {
          setResult({
            id: orderId,
            order: null,
            error: err.response?.status === 404 ? "Order not found" : err.response?.data?.message || "Failed to load order",
          });
        }
      });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (!currentUser) return <Navigate to={`/signin?redirect=/orders/${orderId}`} replace />;

  const { order, error } = result;
  const loading = result.id !== orderId;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <p className="py-16 text-center text-on-surface-variant">Loading order...</p>
        ) : error ? (
          <div className="py-16 text-center bg-surface-container-lowest rounded-2xl shadow-sm">
            <Icon name="receipt_long" className="text-[48px] text-on-surface-variant/40" />
            <p className="mt-3 font-semibold text-on-surface">{error}</p>
            <Link to="/marketplace" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
              Back to the marketplace
            </Link>
          </div>
        ) : (
          <OrderDetails order={order} justPlaced={!!state?.justPlaced} />
        )}
      </main>
    </div>
  );
}

function OrderDetails({ order, justPlaced }) {
  const number = order.id.slice(0, 8).toUpperCase();
  const status = STATUS[order.status] ?? STATUS.PENDING;
  // cash on delivery stays unpaid until the courier collects it
  const unpaid = order.payment?.status === "PENDING";
  const placedAt = new Date(order.createdAt).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <>
      {justPlaced ? (
        <div className="text-center">
          <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-secondary-container text-secondary">
            <Icon name="check_circle" filled className="text-[40px]" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold text-on-surface">Thank you for your order</h1>
          <p className="mt-2 text-on-surface-variant">
            Order <span className="font-semibold text-on-surface">#{number}</span>{" "}
            {unpaid
              ? `has been placed. Please have ${taka(order.totalAmount)} in cash ready when it arrives.`
              : "is confirmed. Profit from it goes to the rescue fund."}
          </p>
        </div>
      ) : (
        <h1 className="font-display text-3xl font-bold text-on-surface">Order #{number}</h1>
      )}

      <section className="mt-8 bg-surface-container-lowest rounded-2xl shadow-sm divide-y divide-surface-container-high">
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <Fact label="Order">#{number}</Fact>
          <Fact label="Placed">{placedAt}</Fact>
          <Fact label="Status">
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.className}`}>
              {status.label}
            </span>
          </Fact>
          <Fact label="Payment">{PAYMENT_METHOD[order.paymentMethod] ?? order.paymentMethod}</Fact>
        </div>

        <ul className="p-5 space-y-4">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-4">
              <ProductImage product={item.product} className="w-16 h-16 rounded-xl shrink-0" />
              <div className="flex-1 min-w-0">
                <Link
                  to={`/marketplace/${item.product.id}`}
                  className="block font-semibold text-on-surface hover:text-primary transition-colors truncate"
                >
                  {item.product.name}
                </Link>
                <p className="text-sm text-on-surface-variant">
                  {item.quantity} × {taka(item.unitPrice)}
                </p>
              </div>
              <p className="font-semibold text-on-surface">{taka(item.unitPrice * item.quantity)}</p>
            </li>
          ))}
        </ul>

        <dl className="p-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-on-surface-variant">Delivery</dt>
            <dd className="font-semibold text-secondary">Free</dd>
          </div>
          <div className="flex justify-between">
            <dt className="font-semibold text-on-surface">{unpaid ? "Total due on delivery" : "Total paid"}</dt>
            <dd className="font-display text-xl font-bold text-on-surface">{taka(order.totalAmount)}</dd>
          </div>
        </dl>

        <div className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Delivering to</p>
          <p className="mt-2 font-semibold text-on-surface">{order.deliveryName}</p>
          <p className="text-sm text-on-surface-variant">{order.deliveryPhone}</p>
          <p className="mt-1 text-sm text-on-surface-variant whitespace-pre-line">{order.deliveryAddress}</p>
        </div>
      </section>

      <div className="mt-6 flex justify-center">
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-xl shadow-sm hover:bg-primary-container transition"
        >
          <Icon name="storefront" className="text-[18px]" />
          Continue shopping
        </Link>
      </div>
    </>
  );
}

function Fact({ label, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{label}</p>
      <div className="mt-1 font-semibold text-on-surface">{children}</div>
    </div>
  );
}
