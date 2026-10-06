import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";

export default function DonationsPage() {
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDonations = async () => {
      try {
        const res = await api.get("/donations");
        setDonations(res.data.data);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load donations");
      } finally {
        setLoading(false);
      }
    };
    fetchDonations();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Donations</h1>
        {!loading && !error && (
          <p className="mt-1 text-sm text-gray-500">
            {donations.length} {donations.length === 1 ? "donation" : "donations"}
          </p>
        )}

        {loading ? (
          <p className="mt-6 text-gray-500">Loading donations...</p>
        ) : error ? (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : donations.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>No donations yet.</p>
          </div>
        ) : (
          <ul className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 divide-y divide-gray-100">
            {donations.map((d) => (
              <DonationRow key={d.id} donation={d} />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function DonationRow({ donation }) {
  const { amount, createdAt, donor, volunteer, rescuePost } = donation;

  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-6 py-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Party label="From" user={donor} />
        <svg
          className="w-5 h-5 text-gray-400 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5-5 5M6 12h12" />
        </svg>
        {volunteer ? (
          <Party label="To" user={volunteer.user} to={`/volunteers/${volunteer.id}`} />
        ) : (
          <Party label="To rescue" name={rescuePost?.title || "Rescue post"} />
        )}
      </div>

      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 shrink-0">
        <p className="font-semibold text-green-600">৳{amount.toLocaleString()}</p>
        <p className="text-xs text-gray-400">{new Date(createdAt).toLocaleDateString()}</p>
      </div>
    </li>
  );
}

function Party({ label, user, name, to }) {
  const displayName = user?.name || name;

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <img
        src={user?.profilePictureUrl || "/default-avatar.png"}
        alt={displayName}
        className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100 shrink-0"
      />
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        {to ? (
          <Link to={to} className="block text-sm font-medium text-gray-900 truncate hover:underline">
            {displayName}
          </Link>
        ) : (
          <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
        )}
      </div>
    </div>
  );
}
