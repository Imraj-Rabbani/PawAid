import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";

export default function AdminPage() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = user?.role === "ADMIN";

  const [stats, setStats] = useState(null);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [areaName, setAreaName] = useState("");
  const [adding, setAdding] = useState(false);
  const [areaError, setAreaError] = useState("");

  useEffect(() => {
    if (!isAdmin) return;

    const fetchDashboard = async () => {
      try {
        const [statsRes, areasRes] = await Promise.all([
          api.get("/admin/stats"),
          api.get("/area"),
        ]);
        setStats(statsRes.data.data);
        setAreas(areasRes.data.data);
      } catch (err) {
        console.error(err);
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            "Failed to load the admin panel"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, [isAdmin]);

  const handleAddArea = async (e) => {
    e.preventDefault();
    const name = areaName.trim();
    if (!name) return;

    try {
      setAdding(true);
      setAreaError("");
      const res = await api.post("/add-area", { area: name });
      setAreas((prev) =>
        [...prev, res.data.data].sort((a, b) => a.name.localeCompare(b.name))
      );
      setAreaName("");
    } catch (err) {
      console.error(err);
      setAreaError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to add area"
      );
    } finally {
      setAdding(false);
    }
  };

  if (!user) return <Navigate to="/signin" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-semibold text-gray-900">Admin Panel</h1>

        {loading ? (
          <p className="mt-6 text-gray-500">Loading...</p>
        ) : error ? (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <>
            {/* ── Stats ── */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Total Users" value={stats.users} />
              <StatCard label="Volunteers" value={stats.volunteers} />
              <StatCard label="Rescue Areas" value={areas.length} />
            </div>

            {/* ── Rescue areas ── */}
            <section className="mt-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
              <h2 className="text-xl font-semibold text-gray-900">Rescue Areas</h2>

              <form onSubmit={handleAddArea} className="mt-4 flex gap-3">
                <input
                  value={areaName}
                  onChange={(e) => {
                    setAreaName(e.target.value);
                    if (areaError) setAreaError("");
                  }}
                  className="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Area name, e.g. Mirpur"
                />
                <button
                  type="submit"
                  disabled={adding || !areaName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {adding ? "Adding..." : "Add Area"}
                </button>
              </form>
              {areaError && (
                <p className="mt-1.5 text-sm text-red-600">{areaError}</p>
              )}

              {areas.length === 0 ? (
                <p className="mt-6 text-sm text-gray-400">No areas added yet.</p>
              ) : (
                <ul className="mt-6 divide-y divide-gray-100">
                  {areas.map((area) => (
                    <li key={area.id} className="py-3 text-gray-900">
                      {area.name}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
    </div>
  );
}
