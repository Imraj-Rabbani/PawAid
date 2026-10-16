import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { ProductImage } from "../marketplace/ProductCard";

// the groups listMyOrders filters by
const FILTERS = [
  { value: "", label: "All", countKey: "all" },
  { value: "active", label: "In progress", countKey: "active" },
  { value: "delivered", label: "Delivered", countKey: "delivered" },
  { value: "cancelled", label: "Cancelled", countKey: "cancelled" },
];

const STATUS = {
  PENDING: { label: "Pending", className: "bg-yellow-100 text-yellow-700" },
  CONFIRMED: { label: "Confirmed", className: "bg-blue-100 text-blue-700" },
  PROCESSING: { label: "Processing", className: "bg-blue-100 text-blue-700" },
  SHIPPED: { label: "Shipped", className: "bg-blue-100 text-blue-700" },
  DELIVERED: { label: "Delivered", className: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700" },
  REFUNDED: { label: "Refunded", className: "bg-gray-100 text-gray-700" },
};

// the delivery steps an order goes through, in order
const STEPS = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"];

const PAYMENT = {
  CASH: "Cash on delivery",
  WALLET: "PawAid wallet",
};

const orderNumber = (order) => order.id.slice(0, 8).toUpperCase();

export default function OrdersTab() {
  const [filter, setFilter] = useState("");
  const [result, setResult] = useState({ key: null, orders: [], counts: null, nextCursor: null, error: "" });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let ignore = false;

    api
      .get("/orders", { params: { status: filter || undefined } })
      .then((res) => {
        if (ignore) return;
        setResult({
          key: filter,
          orders: res.data.data,
          counts: res.data.counts,
          nextCursor: res.data.nextCursor,
          error: "",
        });
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) {
          setResult((prev) => ({ ...prev, key: filter, error: err.response?.data?.message || "Failed to load your orders" }));
        }
      });

    return () => {
      ignore = true;
    };
  }, [filter]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const res = await api.get("/orders", { params: { status: filter || undefined, cursor: result.nextCursor } });
      setResult((prev) => {
        const seen = new Set(prev.orders.map((o) => o.id));
        return {
          ...prev,
          orders: [...prev.orders, ...res.data.data.filter((o) => !seen.has(o.id))],
          nextCursor: res.data.nextCursor,
        };
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const { orders, counts, nextCursor, error } = result;
  const loading = result.key !== filter;

  if (result.key === null) return <p className="text-gray-500">Loading orders...</p>;

  if (error && !counts) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Orders</h2>
        {counts.all > 0 && (
          <div className="inline-flex flex-wrap rounded-lg border border-gray-200 p-1 bg-gray-50">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={`px-3 py-1.5 text-sm rounded-md transition ${
                  filter === f.value ? "bg-white shadow-sm text-blue-700 font-medium" : "text-gray-600"
                }`}
              >
                {f.label} ({counts[f.countKey]})
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {orders.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {counts.all === 0 ? (
            <>
              <p>You haven't placed any orders yet.</p>
              <Link to="/marketplace" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
                Browse the marketplace
              </Link>
            </>
          ) : (
            <p>No orders here.</p>
          )}
        </div>
      ) : (
        <div className={`transition-opacity ${loading ? "opacity-50" : ""}`}>
          <ul className="flex flex-col gap-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </ul>
          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore || loading}
              className="mt-4 w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }) {
  const status = STATUS[order.status] ?? STATUS.PENDING;
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const shown = order.items.slice(0, 3);
  const hidden = order.items.length - shown.length;
  // cash on delivery stays unpaid until the courier collects it
  const cashDue = order.payment?.status === "PENDING";
  const refunded = order.payment?.status === "REFUNDED";

  return (
    <li className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="font-semibold text-gray-900">Order #{orderNumber(order)}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.className}`}>{status.label}</span>
        </div>
        <p className="text-xs text-gray-500">
          {new Date(order.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>

      <div className="px-4 py-4 flex flex-col gap-4">
        {STEPS.includes(order.status) && <Progress status={order.status} />}

        <ul className="flex flex-col gap-3">
          {shown.map((item) => (
            <li key={item.id} className="flex items-center gap-3">
              <ProductImage product={item.product} className="w-12 h-12 rounded-lg shrink-0" />
              <div className="flex-1 min-w-0">
                <Link
                  to={`/marketplace/${item.product.id}`}
                  className="block text-sm font-medium text-gray-900 truncate hover:underline"
                >
                  {item.product.name}
                </Link>
                <p className="text-xs text-gray-500">
                  {item.quantity} × ৳{item.unitPrice.toLocaleString()}
                </p>
              </div>
            </li>
          ))}
        </ul>
        {hidden > 0 && (
          <p className="-mt-2 text-xs text-gray-500">
            and {hidden} more {hidden === 1 ? "product" : "products"}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
        <div>
          <p className="font-semibold text-gray-900">
            ৳{order.totalAmount.toLocaleString()}
            <span className="ml-1.5 text-xs font-normal text-gray-500">
              · {itemCount} {itemCount === 1 ? "item" : "items"} · {PAYMENT[order.paymentMethod] ?? order.paymentMethod}
            </span>
          </p>
          {cashDue && order.status !== "CANCELLED" && (
            <p className="text-xs text-yellow-700">Pay in cash when it arrives</p>
          )}
          {refunded && <p className="text-xs text-gray-500">Refunded to your wallet</p>}
        </div>
        <Link
          to={`/orders/${order.id}`}
          className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"
        >
          View order
        </Link>
      </div>
    </li>
  );
}

// where an order is on its way to the buyer
function Progress({ status }) {
  const current = STEPS.indexOf(status);

  return (
    <ol className="flex items-start" aria-label={`Order status: ${STATUS[status].label}`}>
      {STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <li key={step} className={`flex items-start ${i > 0 ? "flex-1" : ""}`}>
            {/* sits level with the dots, not the labels under them */}
            {i > 0 && <span className={`mt-[5px] h-0.5 flex-1 ${done ? "bg-blue-500" : "bg-gray-200"}`} />}
            <span className="flex flex-col items-center gap-1">
              <span
                className={`w-3 h-3 rounded-full ${
                  i === current ? "bg-blue-600 ring-4 ring-blue-100" : done ? "bg-blue-500" : "bg-gray-200"
                }`}
              />
              <span className={`hidden sm:block text-[11px] ${i === current ? "font-semibold text-gray-900" : "text-gray-500"}`}>
                {STATUS[step].label === "Pending" ? "Placed" : STATUS[step].label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
