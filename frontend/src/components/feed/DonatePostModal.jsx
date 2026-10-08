import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Icon from "../Icon";

const QUICK_AMOUNTS = [100, 500, 1000];

export default function DonatePostModal({ post, user, raised, onClose, onDonated }) {
  const [amount, setAmount] = useState("");
  const [walletBalance, setWalletBalance] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const remaining = Math.max(post.donationTarget - raised, 0);
  const volunteer = post.assignedVolunteer;
  const overBalance = walletBalance !== null && Number(amount) > walletBalance;
  // the fixed amounts, plus one that exactly reaches the target
  const quickAmounts = [
    ...QUICK_AMOUNTS.map((value) => ({ value, label: `৳${value.toLocaleString()}` })),
    ...(remaining > 0 && !QUICK_AMOUNTS.includes(remaining) ? [{ value: remaining, label: "Fill target" }] : []),
  ];

  useEffect(() => {
    const fetchWallet = async () => {
      try {
        const res = await api.get("/wallet/me");
        setWalletBalance(res.data.data.balance);
      } catch (err) {
        console.error(err);
        setError("Couldn't load your wallet balance");
      }
    };
    fetchWallet();
  }, []);

  // Escape closes, like the other dialogs
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError("");
      const res = await api.post(`/donations/rescue-post/${post.id}`, { amount: Number(amount) });
      onDonated(res.data.data);
    } catch (err) {
      console.error(err);
      const fieldErrors = Object.values(err.response?.data?.errors || {}).flat();
      setError(fieldErrors[0] || err.response?.data?.message || "Donation failed");
      setSubmitting(false);
    }
  };

  const topUpLink = (
    <Link to={`/profile/${user.id}`} className="font-semibold underline underline-offset-2">
      Top up your wallet
    </Link>
  );

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
        aria-labelledby="donate-post-title"
        className="w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-lg p-6 flex flex-col gap-4 animate-pop-in"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="donate-post-title" className="font-display text-lg font-bold text-on-surface">
              Support this rescue
            </h2>
            <p className="text-sm text-on-surface-variant truncate">{post.title}</p>
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

        {/* where the money goes */}
        <p className="flex gap-2 text-[13px] text-on-surface-variant bg-surface-container-low rounded-xl px-3 py-2">
          <Icon name="info" className="text-[18px] text-secondary shrink-0" />
          {volunteer
            ? `Your donation goes straight to ${volunteer.user.name}'s wallet to fund this rescue.`
            : "No volunteer has taken this rescue yet. Your donation is held for it and moves to the volunteer who takes it on."}
        </p>

        {remaining > 0 && (
          <p className="text-sm text-on-surface-variant">
            <span className="font-semibold text-primary">৳{remaining.toLocaleString()}</span> still needed to reach the target.
          </p>
        )}

        <div className="flex gap-2">
          {quickAmounts.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(String(value))}
              className={`flex-1 px-2 py-2 text-sm rounded-xl transition ${
                Number(amount) === value
                  ? "bg-primary text-white font-semibold shadow-sm"
                  : "bg-surface-container-low text-on-surface font-medium hover:bg-surface-container-high"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Amount (৳)</span>
          <input
            required
            autoFocus
            type="number"
            min={1}
            max={1000000}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="500"
            className="w-full px-3 py-2 bg-surface-container-low text-on-surface rounded-xl border border-transparent focus:outline-none focus:border-primary focus:bg-surface-container-lowest"
          />
        </label>

        <div className="text-sm">
          <p className="flex items-center gap-1.5 text-on-surface-variant">
            <Icon name="account_balance_wallet" className="text-[18px] text-secondary" />
            Your wallet:{" "}
            <span className="font-semibold text-on-surface">
              {walletBalance === null ? "Loading..." : `৳${walletBalance.toLocaleString()}`}
            </span>
          </p>
          {walletBalance === 0 ? (
            <p className="mt-1.5 text-tertiary">Your wallet is empty. {topUpLink} to donate.</p>
          ) : (
            overBalance && <p className="mt-1.5 text-tertiary">That's more than your wallet balance. {topUpLink} first.</p>
          )}
          {error && <p className="mt-1.5 text-error">{error}</p>}
        </div>

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
            disabled={submitting || !amount || walletBalance === null || walletBalance === 0 || overBalance}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-container shadow-sm disabled:opacity-50"
          >
            <Icon name="volunteer_activism" className="text-[18px]" />
            {submitting ? "Donating..." : amount ? `Donate ৳${Number(amount).toLocaleString()}` : "Donate"}
          </button>
        </div>
      </form>
    </div>
  );
}
