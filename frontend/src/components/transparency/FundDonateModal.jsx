import { useState, useEffect } from "react";
import api from "../../services/api";
import { useIdempotencyKey, withIdempotencyKey } from "../../services/idempotency";
import Icon from "../Icon";
import { errorMessage, taka, useDebounced } from "../admin/adminUtils";

const TARGETS = [
  { value: "VOLUNTEER", label: "Volunteer", icon: "badge" },
  { value: "RESCUE_POST", label: "Rescue post", icon: "pets" },
];

// statuses a rescue can still receive money in, matching DONATABLE_STATUSES on the server
const DONATABLE = ["OPEN", "ASSIGNED", "IN_PROGRESS"];
const postClosedReason = (post) =>
  !DONATABLE.includes(post.status) ? "Rescue has ended" : post.donationTarget <= 0 ? "Not raising money" : null;

const fieldClass =
  "w-full px-3 py-2 bg-surface-container-low text-on-surface rounded-xl border border-transparent focus:outline-none focus:border-primary focus:bg-surface-container-lowest";

// Admin only: give money from the PawAid Fund to a volunteer or a rescue post
export default function FundDonateModal({ balance, onClose, onDonated }) {
  const [type, setType] = useState("VOLUNTEER");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search);
  const [results, setResults] = useState({ key: null, items: [] });
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // the same key for every try at this payment, so a retry can't charge twice
  const [idempotencyKey, renewIdempotencyKey] = useIdempotencyKey();

  const overBalance = Number(amount) > balance;
  const searchKey = `${type}|${debouncedSearch}`;

  useEffect(() => {
    let ignore = false;
    const request =
      type === "VOLUNTEER"
        ? api.get("/admin/volunteers", { params: { status: "ACTIVE", search: debouncedSearch || undefined, limit: 6 } })
        : api.get("/admin/posts", { params: { search: debouncedSearch || undefined, limit: 6 } });

    request
      .then((res) => {
        if (!ignore) setResults({ key: searchKey, items: res.data.data });
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) setResults({ key: searchKey, items: [], error: errorMessage(err, "Search failed") });
      });

    return () => {
      ignore = true;
    };
  }, [type, debouncedSearch, searchKey]);

  // Escape closes, like the other dialogs
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const switchType = (next) => {
    setType(next);
    setSelected(null);
    setSearch("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError("");
      await api.post(
        "/admin/fund/donations",
        { destinationType: type, targetId: selected.id, amount: Number(amount) },
        withIdempotencyKey(idempotencyKey)
      );
      renewIdempotencyKey();
      onDonated();
    } catch (err) {
      console.error(err);
      setError(errorMessage(err, "Donation failed"));
      setSubmitting(false);
    }
  };

  const recipientName = selected && (type === "VOLUNTEER" ? selected.user.name : selected.title);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 animate-fade-in"
      onClick={() => !submitting && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fund-donate-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface-container-lowest rounded-2xl shadow-lg p-6 flex flex-col gap-4 animate-pop-in"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="fund-donate-title" className="font-display text-lg font-bold text-on-surface">
              Donate from the PawAid Fund
            </h2>
            <p className="text-sm text-on-surface-variant">
              Available: <span className="font-semibold text-on-surface">{taka(balance)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="p-1 -m-1 rounded-full text-on-surface-variant hover:bg-surface-container-high"
          >
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {TARGETS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => switchType(t.value)}
              aria-pressed={type === t.value}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm rounded-xl transition ${
                type === t.value
                  ? "bg-primary text-white font-semibold shadow-sm"
                  : "bg-surface-container-low text-on-surface font-medium hover:bg-surface-container-high"
              }`}
            >
              <Icon name={t.icon} className="text-[18px]" />
              {t.label}
            </button>
          ))}
        </div>

        {selected ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
            <Recipient type={type} item={selected} />
            <button
              type="button"
              onClick={() => setSelected(null)}
              disabled={submitting}
              className="shrink-0 text-xs font-semibold text-primary hover:text-primary-container"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="relative">
              <Icon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant pointer-events-none"
              />
              <input
                type="search"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={type === "VOLUNTEER" ? "Search active volunteers" : "Search rescue posts"}
                aria-label={type === "VOLUNTEER" ? "Search active volunteers" : "Search rescue posts"}
                className={`${fieldClass} pl-9 text-sm`}
              />
            </label>

            <ResultList
              type={type}
              results={results}
              loading={results.key !== searchKey}
              onPick={(item) => {
                setSelected(item);
                setError("");
              }}
            />
          </div>
        )}

        {selected && (
          <>
            <p className="flex gap-2 text-[13px] text-on-surface-variant bg-surface-container-low rounded-xl px-3 py-2">
              <Icon name="info" className="text-[18px] text-secondary shrink-0" />
              {type === "VOLUNTEER"
                ? `The money goes straight to ${recipientName}'s wallet.`
                : selected.assignedVolunteer
                  ? `The money goes to ${selected.assignedVolunteer.user.name}'s wallet for this rescue.`
                  : "No volunteer has taken this rescue yet. The money is held for it and moves to the volunteer who takes it on."}{" "}
              It shows in the donation lists as from the PawAid Fund.
            </p>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Amount (৳)</span>
              <input
                required
                type="number"
                min={1}
                max={Math.max(balance, 1)}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="500"
                className={fieldClass}
              />
            </label>
            {overBalance && <p className="-mt-2 text-sm text-tertiary">That's more than the fund holds.</p>}
          </>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-semibold text-on-surface bg-surface-container-high rounded-xl hover:bg-surface-container-highest disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !selected || !amount || Number(amount) < 1 || overBalance}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-container shadow-sm disabled:opacity-50"
          >
            <Icon name="volunteer_activism" className="text-[18px]" />
            {submitting ? "Donating..." : amount ? `Donate ${taka(Number(amount))}` : "Donate"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ResultList({ type, results, loading, onPick }) {
  if (results.error) return <p className="text-sm text-error">{results.error}</p>;
  if (results.key === null) return <p className="py-4 text-center text-sm text-on-surface-variant">Loading...</p>;
  if (results.items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-on-surface-variant">
        {type === "VOLUNTEER" ? "No active volunteers found." : "No rescue posts found."}
      </p>
    );
  }

  return (
    <ul className={`flex flex-col gap-1 transition-opacity ${loading ? "opacity-50" : ""}`}>
      {results.items.map((item) => {
        const closed = type === "RESCUE_POST" ? postClosedReason(item) : null;
        return (
          <li key={item.id}>
            <button
              type="button"
              disabled={!!closed}
              onClick={() => onPick(item)}
              className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-surface-container-low disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <Recipient type={type} item={item} />
              {closed && <span className="shrink-0 text-[11px] font-semibold text-on-surface-variant">{closed}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Recipient({ type, item }) {
  if (type === "VOLUNTEER") {
    return (
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <img
          src={item.user.profilePictureUrl || "/default-avatar.png"}
          alt=""
          className="w-10 h-10 rounded-full object-cover shrink-0"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{item.user.name}</p>
          <p className="text-xs text-on-surface-variant truncate">{item.rescueArea?.name}</p>
        </div>
      </div>
    );
  }

  const thumb = item.images?.[0]?.imageUrl;
  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      {thumb ? (
        <img src={thumb} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
          <Icon name="pets" className="text-[20px] text-on-surface-variant" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-semibold text-on-surface truncate">{item.title}</p>
        <p className="text-xs text-on-surface-variant truncate">
          {item.donationTarget > 0 ? `${taka(item.donationReceived)} of ${taka(item.donationTarget)} raised` : "No target"}
          {" · "}
          {item.assignedVolunteer ? item.assignedVolunteer.user.name : "No volunteer yet"}
        </p>
      </div>
    </div>
  );
}
