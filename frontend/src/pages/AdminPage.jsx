import { useState, useEffect, useCallback } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Icon from "../components/Icon";
import OverviewTab from "../components/admin/OverviewTab";
import ReportsTab from "../components/admin/ReportsTab";
import PostsTab from "../components/admin/PostsTab";
import UsersTab from "../components/admin/UsersTab";
import VolunteersTab from "../components/admin/VolunteersTab";
import AreasTab from "../components/admin/AreasTab";
import TransactionsTab from "../components/admin/TransactionsTab";
import { errorMessage } from "../components/admin/adminUtils";

const TABS = [
  { value: "overview", label: "Overview", icon: "dashboard" },
  { value: "reports", label: "Reports", icon: "flag" },
  { value: "posts", label: "Posts", icon: "pets" },
  { value: "users", label: "Users", icon: "group" },
  { value: "volunteers", label: "Volunteers", icon: "volunteer_activism" },
  { value: "areas", label: "Areas", icon: "location_on" },
  { value: "transactions", label: "Transactions", icon: "receipt_long" },
];

export default function AdminPage() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const isAdmin = user?.role === "ADMIN";

  // the tab lives in the URL so a refresh or shared link opens the same view
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === searchParams.get("tab")) ? searchParams.get("tab") : "overview";

  const [stats, setStats] = useState(null);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // stats feed the overview and the tab badges; bumped after every admin action
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!isAdmin) return;
    let ignore = false;

    const fetchDashboard = async () => {
      try {
        const [statsRes, areasRes] = await Promise.all([api.get("/admin/stats"), api.get("/area")]);
        if (ignore) return;
        setStats(statsRes.data.data);
        setAreas(areasRes.data.data);
        setError("");
      } catch (err) {
        console.error(err);
        if (!ignore) setError(errorMessage(err, "Failed to load the admin panel"));
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    fetchDashboard();

    return () => {
      ignore = true;
    };
  }, [isAdmin, reloadKey]);

  const openTab = (value) => {
    setSearchParams(value === "overview" ? {} : { tab: value });
    window.scrollTo({ top: 0 });
  };

  if (!user) return <Navigate to="/signin" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const pendingReports = stats?.reports.byStatus.PENDING ?? 0;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary text-white flex items-center justify-center shrink-0">
            <Icon name="admin_panel_settings" className="text-[24px]" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-on-surface">Admin Panel</h1>
            <p className="text-sm text-on-surface-variant">Moderate the community and keep PawAid running.</p>
          </div>
        </div>

        {/* ── Tabs ── */}
        <nav className="mt-6 bg-surface-container-lowest p-2 rounded-2xl shadow-sm">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {TABS.map((t) => {
              const active = tab === t.value;
              const badge = t.value === "reports" ? pendingReports : 0;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => openTab(t.value)}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                    active
                      ? "bg-primary-container text-white font-semibold shadow-sm"
                      : "text-on-surface-variant font-semibold hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <Icon name={t.icon} className="text-[18px]" />
                  {t.label}
                  {badge > 0 && (
                    <span
                      className={`min-w-5 px-1.5 rounded-full text-[11px] font-bold ${
                        active ? "bg-white text-primary" : "bg-error text-white"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="mt-6">
          {loading ? (
            <p className="py-10 text-center text-on-surface-variant">Loading...</p>
          ) : error && !stats ? (
            <div className="p-4 bg-error-container rounded-2xl">
              <p className="text-sm text-on-error-container">{error}</p>
            </div>
          ) : (
            <>
              {tab === "overview" && <OverviewTab stats={stats} onNavigate={openTab} />}
              {tab === "reports" && <ReportsTab counts={stats.reports.byStatus} onChange={refresh} />}
              {tab === "posts" && <PostsTab areas={areas} onChange={refresh} />}
              {tab === "users" && <UsersTab currentUserId={user.id} onChange={refresh} />}
              {tab === "volunteers" && <VolunteersTab areas={areas} onChange={refresh} />}
              {tab === "areas" && <AreasTab onChange={refresh} />}
              {tab === "transactions" && <TransactionsTab />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
