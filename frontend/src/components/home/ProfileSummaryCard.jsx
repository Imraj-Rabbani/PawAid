import { Link } from "react-router-dom";
import Icon from "../Icon";

const money = (n) => `৳${(n ?? 0).toLocaleString()}`;

export default function ProfileSummaryCard({ user, me }) {
  if (!user) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
        <div className="h-20 bg-linear-to-r from-primary-fixed via-tertiary-fixed to-secondary-fixed opacity-90" />
        <div className="p-5 -mt-8">
          <div className="w-14 h-14 rounded-full bg-surface-container-lowest shadow-md flex items-center justify-center">
            <Icon name="pets" className="text-[28px] text-primary" />
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold text-on-surface">Join PawAid</h2>
          <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
            Report animals in need, fund rescues and follow every taka from donor to volunteer.
          </p>
          <Link
            to="/signup"
            className="mt-4 block text-center py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-sm font-bold shadow-sm transition"
          >
            Create an account
          </Link>
          <Link
            to="/signin"
            className="mt-2 block text-center py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-sm font-semibold transition"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  const volunteer = me?.volunteer;
  const isActiveVolunteer = volunteer?.status === "ACTIVE";
  const spentShare =
    volunteer?.donationsReceived > 0
      ? Math.round((volunteer.totalSpent / volunteer.donationsReceived) * 100)
      : null;

  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="h-20 bg-linear-to-r from-primary-fixed via-tertiary-fixed to-secondary-fixed opacity-90" />

      <div className="px-5 pb-5 -mt-10 flex flex-col">
        <Link to={`/profile/${user.id}`} className="relative w-16 h-16 mb-3">
          <img
            src={user.profilePictureUrl || "/default-avatar.png"}
            alt={user.name}
            className="w-16 h-16 rounded-full object-cover shadow-md ring-4 ring-surface-container-lowest"
          />
          {isActiveVolunteer && (
            <span className="absolute bottom-0 right-0 bg-secondary text-white rounded-full p-0.5 flex shadow-sm">
              <Icon name="check" className="text-[14px]" />
            </span>
          )}
        </Link>

        <Link
          to={`/profile/${user.id}`}
          className="font-display text-xl font-semibold text-on-surface hover:text-primary transition-colors"
        >
          {user.name}
        </Link>

        {volunteer && (
          <span
            className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-md self-start text-[11px] font-semibold ${
              isActiveVolunteer
                ? "bg-secondary-container/50 text-on-secondary-container"
                : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            <Icon name="shield_person" className="text-[14px]" />
            {isActiveVolunteer ? "Verified Volunteer" : "Volunteer application pending"}
            {volunteer.areaName && ` • ${volunteer.areaName}`}
          </span>
        )}

        {volunteer?.description && (
          <p className="mt-3 text-[13px] leading-relaxed text-on-surface-variant line-clamp-3">
            {volunteer.description}
          </p>
        )}

        {/* ── Money in and out ── */}
        {me && (
          <div className="mt-4 flex flex-col gap-2.5 bg-surface-container-low/60 rounded-xl p-3">
            {volunteer ? (
              <>
                <Row label="Donations Received" value={money(volunteer.donationsReceived)} />
                <Row
                  label="Amount Spent"
                  value={
                    <>
                      {money(volunteer.totalSpent)}
                      {spentShare !== null && (
                        <span className="ml-1 text-[11px] font-bold text-secondary">({spentShare}%)</span>
                      )}
                    </>
                  }
                />
              </>
            ) : (
              <Row
                label={`Donated (${me.donationCount})`}
                value={money(me.donatedTotal)}
              />
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[13px] text-on-surface-variant">Wallet Balance</span>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold">
                {money(me.walletBalance)}
              </span>
            </div>
          </div>
        )}

        {/* ── Shortcuts ── */}
        <nav className="mt-4 flex flex-col gap-1">
          <NavItem to={`/profile/${user.id}`} icon="pets" iconClass="text-tertiary" label="My Rescue Posts" count={me?.postCount} />
          {volunteer && isActiveVolunteer && (
            <NavItem
              to={`/volunteers/${volunteer.id}`}
              icon="volunteer_activism"
              iconClass="text-secondary"
              label="Rescues I'm Handling"
              count={volunteer.assignedCount}
            />
          )}
          <NavItem to="/donations" icon="account_balance" iconClass="text-primary" label="Donation Ledger" />
        </nav>

        {!volunteer && (
          <Link
            to={`/profile/${user.id}`}
            className="mt-4 py-2 px-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-sm font-semibold text-on-surface flex items-center justify-center gap-1.5 transition"
          >
            <Icon name="handshake" className="text-[16px]" />
            Become a Volunteer
          </Link>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] text-on-surface-variant">{label}</span>
      <span className="text-sm font-semibold text-on-surface text-right">{value}</span>
    </div>
  );
}

function NavItem({ to, icon, iconClass, label, count }) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between py-2 px-2.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors"
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <Icon name={icon} className={`text-[18px] ${iconClass}`} />
        {label}
      </span>
      {count !== undefined ? (
        <span className="bg-surface-container-high px-2 py-0.5 rounded-full text-[11px] font-bold">{count}</span>
      ) : (
        <Icon name="chevron_right" className="text-[16px]" />
      )}
    </Link>
  );
}
