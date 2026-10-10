import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import TransferForm from "./TransferForm";

// Turns a wallet row into who/what it was with, from the owner's point of view
function describe(t) {
  const { type, source, reference: note, relatedUser, relatedVolunteer, relatedPost } = t.relatedTransaction;
  const credit = t.type === "CREDIT";
  const volunteerLink = relatedVolunteer && { name: relatedVolunteer.user.name, to: `/volunteers/${relatedVolunteer.id}` };
  const userLink = relatedUser && { name: relatedUser.name, to: `/profile/${relatedUser.id}` };

  if (source === "TOP_UP") return { title: "Wallet top up" };

  if (type === "DONATION") {
    return credit
      ? { title: "Donation from", party: userLink, detail: relatedPost && `For ${relatedPost.title}` }
      : relatedPost
        ? { title: `Donation to rescue: ${relatedPost.title}` }
        : { title: "Donation to", party: volunteerLink };
  }

  if (type === "TRANSFER" && source === "RESCUE_POST") {
    return { title: "Rescue donations moved to you", detail: relatedPost?.title };
  }

  if (type === "TRANSFER") {
    // "Volunteer transfer" is the default reference, only a real note is worth showing
    const detail = note && note !== "Volunteer transfer" ? `“${note}”` : null;
    return credit
      ? { title: "Transfer from", party: userLink, detail }
      : { title: "Transfer to", party: volunteerLink, detail };
  }

  return { title: t.reference || "Transaction" };
}

export default function WalletTab({ user, onWalletUpdated }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // a top up from the sidebar changes the balance; refetch so the history matches
  const balance = user.wallet?.balance;
  const [prevBalance, setPrevBalance] = useState(balance);
  if (balance !== prevBalance) {
    setPrevBalance(balance);
    setReloadKey((k) => k + 1);
  }

  const canTransfer = user.volunteerProfile?.status === "ACTIVE";

  useEffect(() => {
    let ignore = false;

    const fetchHistory = async () => {
      try {
        const res = await api.get("/wallet/transactions");
        if (ignore) return;
        setTransactions(res.data.data);
        setSummary(res.data.summary);
        setNextCursor(res.data.nextCursor);
        setError("");
      } catch (err) {
        console.error(err);
        if (!ignore) setError(err.response?.data?.message || "Failed to load wallet history");
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    fetchHistory();

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const res = await api.get("/wallet/transactions", { params: { cursor: nextCursor } });
      setTransactions((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...res.data.data.filter((t) => !seen.has(t.id))];
      });
      setNextCursor(res.data.nextCursor);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <p className="text-gray-500">Loading wallet...</p>;

  if (error && !summary) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Wallet</h2>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Summary label="Balance" value={summary.balance} className="text-gray-900" />
        <Summary label="Money in" value={summary.totalIn} className="text-green-600" />
        <Summary label="Money out" value={summary.totalOut} className="text-red-600" />
      </div>

      {canTransfer && (
        <TransferForm
          balance={summary.balance}
          ownVolunteerId={user.volunteerProfile.id}
          onTransferred={onWalletUpdated}
        />
      )}

      <h3 className="mt-8 font-semibold text-gray-900">History</h3>
      {transactions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No wallet activity yet.</p>
        </div>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-gray-100">
            {transactions.map((t) => (
              <HistoryRow key={t.id} transaction={t} />
            ))}
          </ul>
          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-4 w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function Summary({ label, value, className }) {
  return (
    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${className}`}>৳{value.toLocaleString()}</p>
    </div>
  );
}

function HistoryRow({ transaction }) {
  const credit = transaction.type === "CREDIT";
  const { title, party, detail } = describe(transaction);

  return (
    <li className="flex items-center gap-4 py-4">
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg font-semibold ${
          credit ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
        }`}
        aria-hidden="true"
      >
        {credit ? "↓" : "↑"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">
          {title}
          {party && (
            <>
              {" "}
              <Link to={party.to} className="hover:underline">
                {party.name}
              </Link>
            </>
          )}
        </p>
        {detail && <p className="text-sm text-gray-500 truncate">{detail}</p>}
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date(transaction.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>
      <p className={`font-semibold shrink-0 ${credit ? "text-green-600" : "text-red-600"}`}>
        {credit ? "+" : "−"}৳{transaction.amount.toLocaleString()}
      </p>
    </li>
  );
}
