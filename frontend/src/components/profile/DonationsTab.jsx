import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

const PAYMENT_STYLES = {
  COMPLETED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
};

export default function DonationsTab({ isVolunteer }) {
  const [data, setData] = useState({ made: [], received: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("made"); // "made" | "received"

  useEffect(() => {
    const fetchDonations = async () => {
      try {
        const res = await api.get("/donations/me");
        setData(res.data.data);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load donations");
      } finally {
        setLoading(false);
      }
    };
    fetchDonations();
  }, []);

  if (loading) return <p className="text-gray-500">Loading donations...</p>;

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  const list = view === "made" ? data.made : data.received;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Donations</h2>
        {/* only volunteers can receive donations */}
        {isVolunteer && (
          <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
            <ToggleButton active={view === "made"} onClick={() => setView("made")}>
              Made ({data.made.length})
            </ToggleButton>
            <ToggleButton active={view === "received"} onClick={() => setView("received")}>
              Received ({data.received.length})
            </ToggleButton>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No {view} donations yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {list.map((d) => (
            <DonationRow key={d.id} donation={d} made={view === "made"} />
          ))}
        </ul>
      )}
    </div>
  );
}

function DonationRow({ donation, made }) {
  const { amount, createdAt, payment, rescuePost } = donation;
  // made: who/what it went to; received: who it came from
  const person = made ? donation.volunteer?.user : donation.donor;
  const title = made
    ? rescuePost
      ? `To rescue: ${rescuePost.title}`
      : `To ${person?.name}`
    : `From ${person?.name}`;

  return (
    <li className="flex items-center gap-4 py-4">
      <img
        src={person?.profilePictureUrl || "/default-avatar.png"}
        alt={person?.name || "Rescue post"}
        className="w-12 h-12 rounded-full object-cover"
      />
      <div className="flex-1 min-w-0">
        {made && !rescuePost && donation.volunteer ? (
          <Link
            to={`/volunteers/${donation.volunteer.id}`}
            className="font-medium text-gray-900 truncate hover:underline block"
          >
            {title}
          </Link>
        ) : (
          <p className="font-medium text-gray-900 truncate">{title}</p>
        )}
        {!made && rescuePost && (
          <p className="text-sm text-gray-500 truncate">For {rescuePost.title}</p>
        )}
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date(createdAt).toLocaleDateString()}
        </p>
      </div>
      <div className="text-right">
        <p className={`font-semibold ${made ? "text-red-600" : "text-green-600"}`}>
          {made ? "−" : "+"}৳{amount.toLocaleString()}
        </p>
        <span
          className={`text-xs px-2 py-0.5 rounded-full capitalize ${
            PAYMENT_STYLES[payment.status] || "bg-red-100 text-red-700"
          }`}
        >
          {payment.status.toLowerCase()}
        </span>
      </div>
    </li>
  );
}

function ToggleButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-md transition ${
        active ? "bg-white shadow-sm text-blue-700 font-medium" : "text-gray-600"
      }`}
    >
      {children}
    </button>
  );
}
