import { useState, useEffect } from "react";
import api from "../services/api";
import Navbar from "../components/Navbar";

export default function VolunteersPage() {
  const [volunteers, setVolunteers] = useState([]);
  const [areas, setAreas] = useState([]);
  const [areaId, setAreaId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchVolunteers = async () => {
      try {
        const [volunteersRes, areasRes] = await Promise.all([
          api.get("/volunteer"),
          api.get("/area"),
        ]);
        setVolunteers(volunteersRes.data.data);
        setAreas(areasRes.data.data);
      } catch (err) {
        console.error(err);
        setError(
          err.response?.data?.message ||
            "Failed to load volunteers"
        );
      } finally {
        setLoading(false);
      }
    };
    fetchVolunteers();
  }, []);

  const list = areaId
    ? volunteers.filter((v) => v.rescueArea?.id === areaId)
    : volunteers;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Volunteers</h1>
            {!loading && !error && (
              <p className="mt-1 text-sm text-gray-500">
                {list.length} {list.length === 1 ? "volunteer" : "volunteers"}
              </p>
            )}
          </div>

          <select
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            aria-label="Filter by rescue area"
            className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All areas</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="mt-6 text-gray-500">Loading volunteers...</p>
        ) : error ? (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>{areaId ? "No volunteers in this area yet." : "No volunteers yet."}</p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((volunteer) => (
              <VolunteerCard key={volunteer.id} volunteer={volunteer} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function VolunteerCard({ volunteer }) {
  const { user, rescueArea, description } = volunteer;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-4">
        <img
          src={user.profilePictureUrl || "/default-avatar.png"}
          alt={user.name}
          className="w-14 h-14 rounded-full object-cover ring-2 ring-gray-100 shrink-0"
        />
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{user.name}</h3>
          <span className="mt-1 inline-block px-3 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
            {rescueArea?.name}
          </span>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-500 line-clamp-3 whitespace-pre-wrap">
        {description || "No description provided."}
      </p>
    </div>
  );
}
