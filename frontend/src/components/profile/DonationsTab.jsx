import { useState, useEffect } from "react";
import api from "../../services/api";

export default function DonationsTab() {
  const [data, setData] = useState({ made: [], received: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("made"); // "made" | "received"

  useEffect(() => {
    const fetchDonations = async () => {
      try {
        const res = await api.get("/profile/donations/me");
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDonations();
  }, []);

  if (loading) return <p className="text-gray-500">Loading donations...</p>;

  const list = view === "made" ? data.made : data.received;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Donations</h2>
        <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
          <button
            onClick={() => setView("made")}
            className={`px-3 py-1.5 text-sm rounded-md transition ${
              view === "made" ? "bg-white shadow-sm text-blue-700 font-medium" : "text-gray-600"
            }`}
          >
            Made ({data.made.length})
          </button>
          <button
            onClick={() => setView("received")}
            className={`px-3 py-1.5 text-sm rounded-md transition ${
              view === "received"
                ? "bg-white shadow-sm text-blue-700 font-medium"
                : "text-gray-600"
            }`}
          >
            Received ({data.received.length})
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>No {view} donations yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {list.map((d) => {
            const other = view === "made" ? d.receiver : d.donor;
            return (
              <li key={d.id} className="flex items-center gap-4 py-4">
                <img
                  src={other?.profilePictureUrl || "/default-avatar.png"}
                  alt={other?.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {view === "made" ? `To ${other?.name}` : `From ${other?.name}`}
                  </p>
                  {d.message && (
                    <p className="text-sm text-gray-500 truncate">{d.message}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      view === "made" ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {view === "made" ? "-" : "+"}
                    {d.amount} {d.currency}
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      d.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : d.status === "pending"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {d.status}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}