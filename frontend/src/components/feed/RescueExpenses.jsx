import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Icon from "../Icon";
import ImageLightbox from "./ImageLightbox";
import { fullTime } from "./rescueUtils";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB, same as the backend limit
const MAX_DESCRIPTION_LENGTH = 500;
// orders that never went through can't back an expense, same as the backend
const UNSPENT_ORDER_STATUSES = ["CANCELLED", "REFUNDED"];

const shortDate = (date) => new Date(date).toLocaleDateString(undefined, { day: "numeric", month: "short" });

const itemSummary = (items) =>
  items.map((item) => (item.quantity > 1 ? `${item.product.name} ×${item.quantity}` : item.product.name)).join(", ");

// What the rescue's money was spent on (PRD §21), each backed by a receipt photo
// or a marketplace order. The volunteer handling it (canRecord) gets a form to add more;
// each time focusSignal goes up, that form takes focus.
export default function RescueExpenses({ postId, raised, canRecord, user, focusSignal = 0, timeAgo, onCountChange }) {
  const [expenses, setExpenses] = useState([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const closeReceipt = useCallback(() => setReceipt(null), []);

  useEffect(() => {
    let ignore = false;

    api
      .get(`/rescue-post/${postId}/expenses`)
      .then((res) => {
        if (ignore) return;
        setExpenses(res.data.data);
        setTotal(res.data.total);
        setNextCursor(res.data.nextCursor);
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) setError(err.response?.data?.message || "Failed to load expenses");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [postId]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const res = await api.get(`/rescue-post/${postId}/expenses`, { params: { cursor: nextCursor } });
      // an expense recorded since the last fetch can come back again, skip those
      setExpenses((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...res.data.data.filter((e) => !seen.has(e.id))];
      });
      setTotal(res.data.total);
      setNextCursor(res.data.nextCursor);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to load older expenses");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleRecorded = (expense) => {
    setExpenses((prev) => [expense, ...prev]);
    setTotal((t) => t + expense.amount);
    onCountChange?.(1);
  };

  const handleDelete = async (expense) => {
    if (!confirm(`Remove the ৳${expense.amount.toLocaleString()} expense "${expense.description}"?`)) return;

    try {
      await api.delete(`/expenses/${expense.id}`);
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
      setTotal((t) => t - expense.amount);
      onCountChange?.(-1);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to remove expense");
    }
  };

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-container-high/60">
        <div>
          <div className="flex items-center gap-2">
            <Icon name="receipt_long" className="text-[22px] text-secondary" />
            <h2 className="font-display text-xl font-semibold text-on-surface">Where the Money Went</h2>
          </div>
          <p className="mt-0.5 text-[13px] text-on-surface-variant">
            Every expense is backed by a receipt photo or a PawAid marketplace order.
          </p>
        </div>
        <span className="self-start sm:self-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-container text-[11px] font-semibold">
          <Icon name="shield" className="text-[14px]" />
          Receipts attached
        </span>
      </div>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading expenses...</p>
      ) : error ? (
        <p className="text-sm text-error">{error}</p>
      ) : expenses.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          {canRecord
            ? "No expenses yet. Record what you spend so supporters can see where their money went."
            : "The volunteer hasn't recorded any expenses yet."}
        </p>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-on-surface-variant bg-surface-container-low">
                <th scope="col" className="py-2.5 px-3 rounded-l-lg font-semibold">What it was for</th>
                <th scope="col" className="py-2.5 px-3 font-semibold">Proof</th>
                <th scope="col" className="py-2.5 px-3 font-semibold">Date</th>
                <th scope="col" className="py-2.5 px-3 rounded-r-lg text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low">
              {expenses.map((expense) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  canDelete={expense.volunteer.user.id === user?.id}
                  timeAgo={timeAgo}
                  onOpenReceipt={() => setReceipt(expense)}
                  onDelete={() => handleDelete(expense)}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-container-low font-bold text-on-surface">
                <td colSpan={3} className="py-3 px-3 rounded-l-lg text-right">
                  Spent so far{raised > 0 && <span className="font-medium text-on-surface-variant"> of ৳{raised.toLocaleString()} raised</span>}
                </td>
                <td className="py-3 px-3 rounded-r-lg text-right font-display text-lg text-primary whitespace-nowrap">
                  ৳{total.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {nextCursor && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="self-start text-sm font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-50"
        >
          {loadingMore ? "Loading..." : "View earlier expenses"}
        </button>
      )}

      <p className="flex items-start gap-2 p-3 rounded-xl bg-surface-container text-[13px] text-on-surface-variant">
        <Icon name="info" className="text-[20px] text-secondary shrink-0" />
        <span>
          Donations to a rescue go to its volunteer's wallet, which can only be spent on the PawAid marketplace or passed
          to another volunteer. Expenses here are recorded by the volunteer so you can follow every taka.
        </span>
      </p>

      {canRecord && <ExpenseForm postId={postId} focusSignal={focusSignal} onRecorded={handleRecorded} />}

      {receipt && (
        <ImageLightbox
          images={[{ id: receipt.id, imageUrl: receipt.receiptUrl }]}
          startIndex={0}
          alt={`Receipt for ${receipt.description}`}
          onClose={closeReceipt}
        />
      )}
    </div>
  );
}

function ExpenseRow({ expense, canDelete, timeAgo, onOpenReceipt, onDelete }) {
  const { volunteer, order } = expense;

  return (
    <tr className="align-top">
      <td className="py-3 px-3">
        <p className="font-semibold text-on-surface wrap-break-word">{expense.description}</p>
        <p className="mt-0.5 text-xs text-on-surface-variant">
          by{" "}
          <Link to={`/volunteers/${volunteer.id}`} className="font-semibold hover:text-secondary">
            {volunteer.user.name}
          </Link>
          {canDelete && (
            <>
              {" · "}
              <button type="button" onClick={onDelete} className="font-semibold hover:text-error">
                Remove
              </button>
            </>
          )}
        </p>
      </td>
      <td className="py-3 px-3">
        <div className="flex flex-col items-start gap-1">
          {expense.receiptUrl && (
            <button
              type="button"
              onClick={onOpenReceipt}
              className="inline-flex items-center gap-1.5 pr-2 rounded-full bg-secondary-fixed text-on-secondary-container text-[11px] font-semibold hover:opacity-80"
            >
              <img src={expense.receiptUrl} alt="" loading="lazy" className="w-6 h-6 rounded-full object-cover" />
              Receipt
            </button>
          )}
          {order && (
            <span
              title={order.items.length > 0 ? itemSummary(order.items) : undefined}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed text-[11px] font-semibold"
            >
              <Icon name="storefront" className="text-[14px]" />
              Order #{order.number}
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-3 text-on-surface-variant whitespace-nowrap">
        <time dateTime={expense.createdAt} title={`${fullTime(expense.createdAt)} · ${timeAgo(expense.createdAt)}`}>
          {shortDate(expense.createdAt)}
        </time>
      </td>
      <td className="py-3 px-3 text-right font-semibold text-on-surface whitespace-nowrap">
        ৳{expense.amount.toLocaleString()}
      </td>
    </tr>
  );
}

function ExpenseForm({ postId, focusSignal, onRecorded }) {
  const amountRef = useRef(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receipt, setReceipt] = useState(null); // { file, url }
  const [orderId, setOrderId] = useState("");
  const [orders, setOrders] = useState(null); // null until loaded
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // the volunteer's own recent orders, to back an expense bought on the marketplace
  useEffect(() => {
    let ignore = false;
    api
      .get("/orders", { params: { limit: 50 } })
      .then((res) => {
        if (!ignore) setOrders(res.data.data.filter((order) => !UNSPENT_ORDER_STATUSES.includes(order.status)));
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) setOrders([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (focusSignal) amountRef.current?.focus({ preventScroll: true });
  }, [focusSignal]);

  // free the preview when the photo changes or the form goes away
  useEffect(() => () => receipt && URL.revokeObjectURL(receipt.url), [receipt]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      setError("The receipt photo must be 5MB or smaller.");
      return;
    }
    setError("");
    setReceipt({ file, url: URL.createObjectURL(file) });
  };

  const chooseOrder = (id) => {
    setOrderId(id);
    // start from the order total; the volunteer can lower it if only part was for this rescue
    const order = orders.find((o) => o.id === id);
    if (order && !amount) setAmount(String(order.totalAmount));
  };

  const ready = Number(amount) > 0 && description.trim().length >= 3 && (receipt || orderId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving || !ready) return;

    const formData = new FormData();
    formData.append("amount", amount);
    formData.append("description", description);
    if (orderId) formData.append("orderId", orderId);
    if (receipt) formData.append("receipt", receipt.file);

    try {
      setSaving(true);
      setError("");
      const res = await api.post(`/rescue-post/${postId}/expenses`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAmount("");
      setDescription("");
      setReceipt(null);
      setOrderId("");
      onRecorded(res.data.data);
    } catch (err) {
      console.error(err);
      const fieldErrors = err.response?.data?.errors;
      setError(
        fieldErrors?.amount?.[0] ||
          fieldErrors?.description?.[0] ||
          fieldErrors?.orderId?.[0] ||
          err.response?.data?.message ||
          "Failed to record expense"
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2 text-sm bg-surface-container-lowest text-on-surface rounded-xl border border-transparent focus:outline-none focus:border-primary";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-4 rounded-xl bg-surface-container-low">
      <p className="text-sm font-bold text-on-surface">Record an expense</p>

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="sm:w-36 shrink-0">
          <span className="sr-only">Amount in taka</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">৳</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={amount}
              ref={amountRef}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className={`${inputClass} pl-7`}
            />
          </div>
        </label>
        <label className="flex-1">
          <span className="sr-only">What was it for?</span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={MAX_DESCRIPTION_LENGTH}
            placeholder="What was it for? e.g. Vet visit and antibiotics"
            className={inputClass}
          />
        </label>
      </div>

      {orders?.length > 0 && (
        <label>
          <span className="sr-only">Marketplace order</span>
          <select value={orderId} onChange={(e) => chooseOrder(e.target.value)} className={inputClass}>
            <option value="">Bought on the marketplace? Link the order (optional)</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                #{order.id.slice(0, 8).toUpperCase()} · ৳{order.totalAmount.toLocaleString()} · {itemSummary(order.items)}
              </option>
            ))}
          </select>
        </label>
      )}

      {receipt && (
        <div className="relative self-start">
          <img src={receipt.url} alt="Receipt" className="h-20 rounded-lg object-cover" />
          <button
            type="button"
            onClick={() => setReceipt(null)}
            aria-label="Remove receipt"
            className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white text-xs hover:bg-black/80"
          >
            ×
          </button>
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-on-surface-variant bg-surface-container-lowest rounded-xl hover:bg-surface-container-high cursor-pointer">
          <Icon name="photo_camera" className="text-[18px]" />
          {receipt ? "Change Receipt" : "Add Receipt"}
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
        <button
          type="submit"
          disabled={saving || !ready}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-white bg-secondary rounded-xl hover:opacity-90 shadow-sm disabled:opacity-50"
        >
          <Icon name="add" className="text-[16px]" />
          {saving ? "Saving..." : "Record Expense"}
        </button>
      </div>
      {!receipt && !orderId && (
        <p className="text-xs text-on-surface-variant">Add a receipt photo or link a marketplace order so supporters can verify it.</p>
      )}
    </form>
  );
}
