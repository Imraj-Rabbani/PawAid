import Icon from "../Icon";
import { Panel } from "./ui";
import { POST_STATUS, REPORT_STATUS, ROLE, USER_STATUS, VOLUNTEER_STATUS, taka } from "./adminUtils";

export default function OverviewTab({ stats, onNavigate }) {
  const { users, volunteers, posts, reports, finance } = stats;
  const pendingReports = reports.byStatus.PENDING ?? 0;
  const openRescues = posts.byStatus.OPEN ?? 0;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Needs attention ── */}
      {(pendingReports > 0 || openRescues > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {pendingReports > 0 && (
            <AttentionCard
              icon="flag"
              text={`${pendingReports} ${pendingReports === 1 ? "report is" : "reports are"} waiting for review`}
              action="Review reports"
              onClick={() => onNavigate("reports")}
            />
          )}
          {openRescues > 0 && (
            <AttentionCard
              icon="pets"
              text={`${openRescues} ${openRescues === 1 ? "rescue has" : "rescues have"} no volunteer yet`}
              action="View posts"
              onClick={() => onNavigate("posts")}
            />
          )}
        </div>
      )}

      {/* ── Headline numbers ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon="group" label="Users" value={users.total} hint={`+${users.newThisWeek} this week`} />
        <StatTile
          icon="volunteer_activism"
          label="Active volunteers"
          value={volunteers.byStatus.ACTIVE ?? 0}
          hint={`${volunteers.total} total`}
        />
        <StatTile icon="pets" label="Rescue posts" value={posts.total} hint={`${posts.byStatus.RESOLVED ?? 0} rescued`} />
        <StatTile icon="location_on" label="Rescue areas" value={stats.areas} />
        <StatTile
          icon="payments"
          label="Donations"
          value={taka(finance.donationsTotal)}
          hint={`${finance.donationCount} donations`}
        />
        <StatTile
          icon="calendar_month"
          label="Donated this month"
          value={taka(finance.donationsThisMonth)}
          hint={`${finance.donationCountThisMonth} donations`}
        />
        <StatTile icon="add_card" label="Wallet top ups" value={taka(finance.topUpsTotal)} />
        <StatTile icon="account_balance_wallet" label="Held in wallets" value={taka(finance.walletBalanceTotal)} />
      </div>

      {/* ── Breakdowns ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Breakdown title="Rescue posts by status" map={POST_STATUS} counts={posts.byStatus} onMore={() => onNavigate("posts")} />
        <Breakdown title="Reports by status" map={REPORT_STATUS} counts={reports.byStatus} onMore={() => onNavigate("reports")} />
        <Breakdown title="Users by role" map={ROLE} counts={users.byRole} onMore={() => onNavigate("users")} />
        <Breakdown
          title="Account status"
          map={USER_STATUS}
          counts={users.byStatus}
          onMore={() => onNavigate("users")}
        />
        <Breakdown
          title="Volunteer status"
          map={VOLUNTEER_STATUS}
          counts={volunteers.byStatus}
          onMore={() => onNavigate("volunteers")}
        />
      </div>
    </div>
  );
}

function AttentionCard({ icon, text, action, onClick }) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary-fixed text-on-primary-fixed">
      <Icon name={icon} className="text-[22px] shrink-0" />
      <p className="flex-1 text-sm font-semibold">{text}</p>
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 text-xs font-bold underline underline-offset-2 hover:no-underline"
      >
        {action}
      </button>
    </div>
  );
}

function StatTile({ icon, label, value, hint }) {
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 sm:p-5 min-w-0">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon name={icon} className="text-[18px]" />
        <p className="text-xs font-semibold uppercase tracking-wide truncate">{label}</p>
      </div>
      <p className="mt-2 font-display text-2xl sm:text-3xl font-bold text-on-surface truncate">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-on-surface-variant">{hint}</p>}
    </div>
  );
}

// one row per status in the map, so statuses with no rows still show as 0
function Breakdown({ title, map, counts, onMore }) {
  return (
    <Panel
      title={title}
      actions={
        <button type="button" onClick={onMore} className="text-xs font-semibold text-primary hover:text-primary-container">
          Manage
        </button>
      }
    >
      <ul className="divide-y divide-surface-container-high">
        {Object.entries(map).map(([key, { label }]) => (
          <li key={key} className="flex items-center justify-between py-2 text-sm">
            <span className="text-on-surface-variant">{label}</span>
            <span className="font-semibold text-on-surface tabular-nums">{counts[key] ?? 0}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
