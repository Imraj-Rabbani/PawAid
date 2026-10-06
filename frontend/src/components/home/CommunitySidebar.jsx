import { Link } from "react-router-dom";
import Icon from "../Icon";

const money = (n) => `৳${(n ?? 0).toLocaleString()}`;
const RANK_STYLES = [
  "bg-primary-fixed text-on-primary-fixed",
  "bg-secondary-container text-on-secondary-container",
  "bg-surface-container-high text-on-surface-variant",
];

export default function CommunitySidebar({ summary, user }) {
  if (!summary) return null;

  const { pool, topVolunteers, discover } = summary;
  const monthName = new Date().toLocaleString("default", { month: "long" });

  return (
    <>
      {/* ── Transparency pool ── */}
      <Card>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-secondary-container text-on-secondary-container flex">
            <Icon name="shield" className="text-[20px]" />
          </div>
          <div>
            <h3 className="font-display text-[17px] font-semibold text-on-surface">Transparency Pool</h3>
            <p className="text-[11px] font-medium text-on-surface-variant">Live donation ledger</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Metric label="Donations This Month" value={money(pool.donationsThisMonth)} icon="payments" />
          <Metric label="Donated All Time" value={money(pool.totalDonated)} icon="savings" valueClass="text-secondary" />
          <div className="grid grid-cols-2 gap-2">
            <SmallMetric label="Rescues Funded" value={pool.rescuesFunded} />
            <SmallMetric label="Rescued" value={pool.rescuesResolved} valueClass="text-primary" />
          </div>
        </div>

        <Link
          to="/donations"
          className="py-2 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-semibold text-secondary flex items-center justify-center gap-1.5 transition"
        >
          View Full Donation Ledger
          <Icon name="arrow_forward" className="text-[16px]" />
        </Link>
      </Card>

      {/* ── Top volunteers this month ── */}
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[17px] font-semibold text-on-surface flex items-center gap-1.5">
            <Icon name="military_tech" className="text-[20px] text-tertiary" />
            Top Volunteers
          </h3>
          <span className="text-[11px] font-medium text-on-surface-variant">{monthName}</span>
        </div>

        {topVolunteers.length === 0 ? (
          <p className="text-[13px] text-on-surface-variant">No donations to volunteers yet this month.</p>
        ) : (
          <div className="flex flex-col divide-y divide-surface-container-low">
            {topVolunteers.map((v, i) => {
              const isMe = v.user?.id === user?.id;
              return (
                <Link
                  key={v.id}
                  to={`/volunteers/${v.id}`}
                  className={`py-2.5 flex items-center justify-between gap-2 hover:opacity-80 ${
                    isMe ? "bg-surface-container-low/50 -mx-2 px-2 rounded-lg" : ""
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${RANK_STYLES[i]}`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-on-surface truncate">
                        {v.user?.name}
                        {isMe && <span className="ml-1 text-[11px] font-normal text-secondary">(You)</span>}
                      </p>
                      <p className="text-[11px] text-on-surface-variant">
                        {v.rescues} {v.rescues === 1 ? "Rescue" : "Rescues"} • {money(v.raised)} raised
                      </p>
                    </div>
                  </div>
                  <Icon name="verified" className={`text-[18px] shrink-0 ${i === 0 ? "text-tertiary" : i === 1 ? "text-secondary" : "text-on-surface-variant"}`} />
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Volunteers to discover ── */}
      {discover.volunteers.length > 0 && (
        <Card>
          <h3 className="font-display text-[17px] font-semibold text-on-surface flex items-center gap-1.5">
            <Icon name="near_me" className="text-[20px] text-secondary" />
            {discover.inYourArea ? "Volunteers Near You" : "New Volunteers"}
          </h3>

          <div className="flex flex-col gap-3">
            {discover.volunteers.map((v) => (
              <div key={v.id} className="flex items-start justify-between gap-2 p-2 rounded-xl bg-surface-container-low/70">
                <div className="flex items-start gap-2 min-w-0">
                  <img
                    src={v.user.profilePictureUrl || "/default-avatar.png"}
                    alt={v.user.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">{v.user.name}</p>
                    {v.description && (
                      <p className="text-[11px] font-medium text-secondary line-clamp-1">{v.description}</p>
                    )}
                    <p className="text-[11px] text-on-surface-variant flex items-center gap-0.5 mt-0.5">
                      <Icon name="location_on" className="text-[12px]" />
                      {v.rescueArea.name}
                    </p>
                  </div>
                </div>
                <Link
                  to={`/volunteers/${v.id}`}
                  className="mt-1 px-3 py-1 bg-surface-container-lowest hover:bg-surface-container-high text-on-surface text-[11px] font-bold rounded-lg shadow-xs transition shrink-0"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function Card({ children }) {
  return (
    <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-4">{children}</div>
  );
}

function Metric({ label, value, icon, valueClass = "text-on-surface" }) {
  return (
    <div className="flex items-center justify-between bg-surface-container-low p-3 rounded-xl">
      <div>
        <p className="text-[11px] font-medium text-on-surface-variant">{label}</p>
        <p className={`font-display text-xl font-bold ${valueClass}`}>{value}</p>
      </div>
      <Icon name={icon} className="text-[24px] text-secondary" />
    </div>
  );
}

function SmallMetric({ label, value, valueClass = "text-on-surface" }) {
  return (
    <div className="bg-surface-container-low p-2.5 rounded-xl">
      <p className="text-[11px] font-medium text-on-surface-variant">{label}</p>
      <p className={`mt-1 font-display text-xl font-bold ${valueClass}`}>{value.toLocaleString()}</p>
    </div>
  );
}
