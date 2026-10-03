import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import DonateCard from "../components/volunteer/DonateCard";

const STATUS_STYLES = {
  OPEN: "bg-blue-100 text-blue-700",
  ASSIGNED: "bg-yellow-100 text-yellow-700",
  IN_PROGRESS: "bg-orange-100 text-orange-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-100 text-red-700",
};

const formatDate = (date) =>
  new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const formatStatus = (status) => status.toLowerCase().replace("_", " ");

const formatMoney = (amount) => `৳${amount.toLocaleString()}`;

// TOP_UP -> "Top up"
const formatLabel = (value) =>
  value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");

export default function VolunteerProfilePage() {
  const { volunteerId } = useParams();
  const [volunteer, setVolunteer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchVolunteer = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/volunteer/${volunteerId}`);
        setVolunteer(res.data.data);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load volunteer");
      } finally {
        setLoading(false);
      }
    };
    fetchVolunteer();
  }, [volunteerId]);

  // after a donation, quietly reload so the balance and history update
  const refreshVolunteer = async () => {
    try {
      const res = await api.get(`/volunteer/${volunteerId}`);
      setVolunteer(res.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Link to="/volunteers" className="text-sm text-blue-600 hover:underline">
          ← Back to volunteers
        </Link>

        {loading ? (
          <p className="mt-6 text-gray-500">Loading volunteer...</p>
        ) : error ? (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <VolunteerProfile volunteer={volunteer} onDonated={refreshVolunteer} />
        )}
      </main>
    </div>
  );
}

function VolunteerProfile({ volunteer, onDonated }) {
  const { user, rescueArea, description, createdAt, assignedPosts, stats, wallet } = volunteer;

  return (
    <div className="mt-6 flex flex-col md:flex-row gap-6">
      {/* LEFT: identity */}
      <aside className="md:w-[35%] w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center">
          <img
            src={user.profilePictureUrl || "/default-avatar.png"}
            alt={user.name}
            className="w-28 h-28 mx-auto rounded-full object-cover ring-4 ring-gray-100"
          />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">{user.name}</h1>
          <span className="mt-2 inline-block px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
            {rescueArea?.name}
          </span>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <Stat label="Rescues" value={stats.totalRescues} />
            <Stat label="Resolved" value={stats.resolvedRescues} />
          </div>
        </div>

        {wallet && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Wallet Balance
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {formatMoney(wallet.balance)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <Stat label="Donations" value={formatMoney(stats.donationsReceived)} />
              <Stat label="Spent" value={formatMoney(wallet.totalSpent)} />
            </div>
            <p className="mt-3 text-xs text-center text-gray-400">
              {stats.donationCount} {stats.donationCount === 1 ? "donation" : "donations"} received
            </p>
          </div>
        )}

        {wallet && <DonateCard volunteer={volunteer} onDonated={onDonated} />}
      </aside>

      {/* RIGHT: details */}
      <section className="md:w-[65%] w-full space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">About</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">
            {description || "No description provided."}
          </p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Rescue area">{rescueArea?.name || "—"}</Field>
            <Field label="Status">
              <span className="capitalize">{volunteer.status.toLowerCase()}</span>
            </Field>
            <Field label="Volunteer since">{formatDate(createdAt)}</Field>
            <Field label="Member since">{formatDate(user.createdAt)}</Field>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent rescues</h2>
          {assignedPosts.length === 0 ? (
            <p className="text-sm text-gray-400">No rescues assigned yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {assignedPosts.map((post) => (
                <li key={post.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{post.title}</p>
                    <p className="text-xs text-gray-500">
                      {post.rescueArea?.name} · {formatDate(post.createdAt)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full capitalize ${
                      STATUS_STYLES[post.status] || "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {formatStatus(post.status)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {wallet && <WalletHistory transactions={wallet.transactions} />}
      </section>
    </div>
  );
}

function WalletHistory({ transactions }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Wallet history</h2>
      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400">No wallet activity yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {transactions.map((tx) => {
            const isCredit = tx.type === "CREDIT";
            const { source, destination, relatedPost } = tx.relatedTransaction || {};
            // money in shows where it came from, money out shows where it went
            const counterpart = isCredit ? source : destination;

            return (
              <li key={tx.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {tx.reference || (isCredit ? "Money received" : "Money spent")}
                  </p>
                  <p className="text-xs text-gray-500">
                    {counterpart && `${isCredit ? "From" : "To"} ${formatLabel(counterpart)} · `}
                    {relatedPost && `For "${relatedPost.title}" · `}
                    {formatDate(tx.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-semibold ${
                    isCredit ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isCredit ? "+" : "−"}
                  {formatMoney(tx.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-gray-50 py-3">
      <p className="text-xl font-semibold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-gray-900">{children}</p>
    </div>
  );
}
