import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { useIdempotencyKey, withIdempotencyKey } from "../../services/idempotency";
import Icon from "../Icon";
import { DONATABLE_STATUSES } from "../feed/rescueUtils";

const PRESETS = [100, 500, 1000];

// The rescue page's money card: what it has raised, and a donation form paid
// from the donor's wallet (the same flow as DonatePostModal in the feed).
export default function DonationCard({ post, user, onDonated }) {
  const volunteer = post.assignedVolunteer;
  const raised = post.donationReceived;
  const target = post.donationTarget;
  const isOwnPost = user?.id === post.creator.id;
  const handlingIt = volunteer && volunteer.user.id === user?.id;
  const canDonate = target > 0 && DONATABLE_STATUSES.includes(post.status) && !isOwnPost && !handlingIt;
  const progress = target ? Math.min(100, Math.round((raised / target) * 100)) : 0;
  const remaining = Math.max(target - raised, 0);

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col gap-4 overflow-hidden">
      <Ribbon post={post} />

      {target > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <p className="flex items-baseline flex-wrap gap-x-1.5">
              <span className="font-display text-4xl font-extrabold text-on-surface">৳{raised.toLocaleString()}</span>
              <span className="text-[15px] text-on-surface-variant">raised of ৳{target.toLocaleString()}</span>
            </p>
            <span className="shrink-0 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-container text-xs font-bold">
              {progress}% Funded
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-surface-container-high overflow-hidden flex">
            <div className="h-full bg-secondary rounded-l-full transition-all duration-700" style={{ width: `${progress}%` }} />
            <div className="h-full flex-1 bg-primary/15" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
            {remaining > 0 ? (
              <span className="flex items-center gap-1 font-semibold text-primary">
                <Icon name="flag" className="text-[15px]" />৳{remaining.toLocaleString()} still needed
              </span>
            ) : (
              <span className="flex items-center gap-1 font-semibold text-secondary">
                <Icon name="verified" className="text-[15px]" />
                Target reached
              </span>
            )}
            <span className="flex items-center gap-1">
              <Icon name="group" className="text-[15px] text-secondary" />
              {post.donorCount ?? 0} {post.donorCount === 1 ? "donor" : "donors"}
            </span>
          </div>
        </div>
      ) : (
        <div>
          <p className="font-display text-lg font-semibold text-on-surface">No fundraising target</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            {volunteer
              ? `This rescue isn't raising money on the post. You can support ${volunteer.user.name} directly instead.`
              : "This rescue isn't raising money on the post."}
          </p>
          {raised > 0 && (
            <p className="mt-2 text-sm text-on-surface-variant">
              <span className="font-semibold text-on-surface">৳{raised.toLocaleString()}</span> raised so far
            </p>
          )}
        </div>
      )}

      {canDonate ? (
        user ? (
          <DonateForm post={post} user={user} remaining={remaining} onDonated={onDonated} />
        ) : (
          <Link
            to="/signin"
            className="w-full py-3.5 px-6 rounded-xl bg-primary text-white font-display text-lg font-bold shadow-md hover:bg-primary-container transition flex items-center justify-center gap-2"
          >
            <Icon name="favorite" className="text-[20px]" />
            Sign in to donate
          </Link>
        )
      ) : (
        !target &&
        volunteer &&
        !handlingIt && (
          <Link
            to={`/volunteers/${volunteer.id}`}
            className="w-full py-3 px-6 rounded-xl bg-primary text-white font-bold shadow-md hover:bg-primary-container transition flex items-center justify-center gap-2"
          >
            <Icon name="volunteer_activism" className="text-[20px]" />
            Donate to {volunteer.user.name.split(" ")[0]}
          </Link>
        )
      )}

      {target > 0 && (isOwnPost || handlingIt) && (
        <p className="text-sm text-on-surface-variant bg-surface-container-low rounded-xl px-3 py-2">
          {isOwnPost ? "You posted this rescue, so you can't donate to it." : "Donations to this rescue go to your wallet."}
        </p>
      )}

      <div className="pt-3 border-t border-surface-container-high/60 flex items-start gap-2.5 text-on-surface-variant">
        <Icon name="verified_user" className="text-[20px] text-secondary shrink-0 mt-0.5" />
        <p className="text-xs leading-relaxed">
          <strong className="text-on-surface">Where your money goes:</strong>{" "}
          {volunteer
            ? `straight to ${volunteer.user.name}'s volunteer wallet, which can only be spent on rescue supplies from the PawAid marketplace.`
            : "it's held for this rescue and moves to the volunteer who takes it on. Volunteer wallets can only be spent on rescue supplies from the PawAid marketplace."}{" "}
          <Link to="/transparency" className="font-semibold text-secondary hover:underline">
            See PawAid's finances
          </Link>
        </p>
      </div>
    </div>
  );
}

// the coloured strip across the top of the card: where the rescue stands
function Ribbon({ post }) {
  const volunteer = post.assignedVolunteer;
  const content = {
    OPEN: { tone: "bg-primary-fixed/60 text-on-primary-fixed", dot: "bg-primary animate-ping", text: "Waiting for a volunteer" },
    ASSIGNED: { tone: "bg-secondary-container/50 text-on-secondary-container", dot: "bg-secondary", text: `${volunteer?.user.name} is on this rescue` },
    IN_PROGRESS: { tone: "bg-secondary-container/50 text-on-secondary-container", dot: "bg-secondary animate-ping", text: "Rescue in progress" },
    RESOLVED: { tone: "bg-secondary-container/50 text-on-secondary-container", dot: "bg-secondary", text: "Rescued!" },
  }[post.status] || { tone: "bg-surface-container-high text-on-surface-variant", dot: "bg-on-surface-variant", text: "This rescue is closed" };

  return (
    <div className={`-mx-5 sm:-mx-6 -mt-5 sm:-mt-6 px-5 sm:px-6 py-2.5 flex items-center justify-between gap-2 ${content.tone}`}>
      <span className="flex items-center gap-2 text-xs font-bold">
        <span className={`w-2 h-2 rounded-full ${content.dot}`} />
        {content.text}
      </span>
      <span className="text-[11px] font-semibold">{post.rescueArea.name}</span>
    </div>
  );
}

function DonateForm({ post, user, remaining, onDonated }) {
  const [amount, setAmount] = useState("");
  const [walletBalance, setWalletBalance] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [thanks, setThanks] = useState("");
  // the same key for every try at this payment, so a retry can't charge twice
  const [idempotencyKey, renewIdempotencyKey] = useIdempotencyKey();

  const value = Number(amount);
  const overBalance = walletBalance !== null && value > walletBalance;
  // the fixed amounts, plus one that exactly reaches the target
  const presets = [
    ...PRESETS.map((v) => ({ value: v, hint: null })),
    remaining > 0 && !PRESETS.includes(remaining) ? { value: remaining, hint: "Fills the target" } : { value: 2000, hint: null },
  ];

  useEffect(() => {
    api
      .get("/wallet/me")
      .then((res) => setWalletBalance(res.data.data.balance))
      .catch((err) => {
        console.error(err);
        setError("Couldn't load your wallet balance");
      });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !value) return;

    try {
      setSubmitting(true);
      setError("");
      const res = await api.post(`/donations/rescue-post/${post.id}`, { amount: value }, withIdempotencyKey(idempotencyKey));
      renewIdempotencyKey();
      setWalletBalance((b) => (b === null ? b : b - value));
      setAmount("");
      setThanks(`Thank you! You donated ৳${res.data.data.donation.amount.toLocaleString()} to this rescue.`);
      onDonated(res.data.data);
    } catch (err) {
      console.error(err);
      const fieldErrors = Object.values(err.response?.data?.errors || {}).flat();
      setError(fieldErrors[0] || err.response?.data?.message || "Donation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const topUpLink = (
    <Link to={`/profile/${user.id}`} className="font-semibold underline underline-offset-2">
      Top up your wallet
    </Link>
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-on-surface">Choose an amount</span>
        <div className="grid grid-cols-2 gap-2">
          {presets.map(({ value: preset, hint }) => {
            const active = value === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className={`flex flex-col items-start p-3 rounded-xl text-left transition ${
                  active ? "bg-surface-container-high ring-2 ring-primary" : "bg-surface-container-low hover:bg-surface-container"
                }`}
              >
                <span className={`font-display text-xl font-bold ${active ? "text-primary" : "text-on-surface"}`}>
                  ৳{preset.toLocaleString()}
                </span>
                {hint && <span className="text-[11px] text-on-surface-variant">{hint}</span>}
              </button>
            );
          })}
        </div>
        <label className="relative mt-1">
          <span className="sr-only">Custom amount in taka</span>
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-lg font-semibold text-on-surface-variant">৳</span>
          <input
            type="number"
            min={1}
            max={1000000}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter a custom amount"
            className="w-full h-11 pl-8 pr-4 bg-surface-container-low rounded-xl font-display text-lg font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-on-surface">Paying from</span>
        <div className="flex items-center justify-between p-3 rounded-xl bg-secondary-container/40">
          <div>
            <span className="block text-xs font-bold text-on-surface">Your PawAid wallet</span>
            <span className="text-[11px] text-on-surface-variant">
              {walletBalance === null ? "Loading balance..." : `৳${walletBalance.toLocaleString()} available`}
            </span>
          </div>
          <Icon name="account_balance_wallet" className="text-[22px] text-secondary" />
        </div>
        {walletBalance === 0 ? (
          <p className="text-sm text-tertiary">Your wallet is empty. {topUpLink} to donate.</p>
        ) : (
          overBalance && <p className="text-sm text-tertiary">That's more than your wallet balance. {topUpLink} first.</p>
        )}
      </div>

      {error && <p className="text-sm text-error">{error}</p>}
      {thanks && (
        <p className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary-container text-on-secondary-container text-sm font-semibold">
          <Icon name="favorite" filled className="text-[18px]" />
          {thanks}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !value || walletBalance === null || walletBalance === 0 || overBalance}
        className="w-full py-3.5 px-6 rounded-xl bg-primary text-white font-display text-lg font-bold shadow-md hover:shadow-lg hover:bg-primary-container transition flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
      >
        <Icon name="favorite" className="text-[20px]" />
        {submitting ? "Donating..." : value ? `Donate ৳${value.toLocaleString()}` : "Donate"}
      </button>
    </form>
  );
}
