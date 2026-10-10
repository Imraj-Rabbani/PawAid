import { useState, useEffect } from "react";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Icon from "../components/Icon";

const taka = (amount) => `৳${(amount ?? 0).toLocaleString()}`;

// Public financial overview (PRD §19, §41): platform totals only, never individual donors
export default function TransparencyPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await api.get("/transparency");
        setData(res.data.data);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load the financial overview");
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-8">
        <header className="max-w-2xl">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-secondary">
            <Icon name="visibility" className="text-[16px]" />
            Financial transparency
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-on-surface">Where the money goes</h1>
          <p className="mt-2 text-on-surface-variant">
            Every taka given on PawAid is recorded. These are live totals from our ledger. They are aggregated, so no
            individual donor is ever shown.
          </p>
        </header>

        {loading ? (
          <p className="py-16 text-center text-on-surface-variant">Loading...</p>
        ) : error ? (
          <div className="mt-8 p-4 bg-error-container rounded-2xl">
            <p className="text-sm text-on-error-container">{error}</p>
          </div>
        ) : (
          <Overview data={data} />
        )}
      </main>
    </div>
  );
}

function Overview({ data }) {
  const { donations, volunteers, rescues, marketplace, rescueFund } = data;

  return (
    <div className="mt-8 flex flex-col gap-6">
      {/* ── Headline numbers ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile
          icon="volunteer_activism"
          label="Total donations"
          value={taka(donations.total)}
          hint={`${donations.count.toLocaleString()} donations from ${donations.donors.toLocaleString()} donors`}
          accent
        />
        <Tile
          icon="calendar_month"
          label="Donated this month"
          value={taka(donations.thisMonth)}
          hint={`${donations.countThisMonth.toLocaleString()} donations`}
        />
        <Tile
          icon="account_balance_wallet"
          label="Volunteer funds"
          value={taka(volunteers.fundsHeld)}
          hint={`Held by ${volunteers.active.toLocaleString()} active volunteers`}
        />
        <Tile
          icon="pets"
          label="Animals rescued"
          value={rescues.rescued.toLocaleString()}
          hint={`of ${rescues.total.toLocaleString()} rescue requests`}
        />
      </div>

      {/* ── How money moves ── */}
      <Panel title="How money moves through PawAid">
        <ol className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FlowStep step={1} icon="add_card" title="Supporters add money" amount={data.walletTopUps}>
            Supporters top up their PawAid wallet.
          </FlowStep>
          <FlowStep step={2} icon="favorite" title="They donate" amount={donations.total}>
            To a rescue post, or straight to a volunteer.
          </FlowStep>
          <FlowStep step={3} icon="badge" title="Volunteers hold it" amount={volunteers.fundsHeld}>
            Rescue money sits in the wallet of the volunteer handling it.
          </FlowStep>
          <FlowStep step={4} icon="storefront" title="Spent on supplies" soon={!marketplace.live}>
            Volunteers buy food, medicine and gear in the PawAid marketplace.
          </FlowStep>
        </ol>
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel title="Donations" icon="favorite">
          <Rows>
            <Row label="Given to rescue posts" value={taka(donations.toRescues)} />
            <Row label="Given directly to volunteers" value={taka(donations.toVolunteers)} />
            <Row label="Average donation" value={taka(donations.averageDonation)} />
            <Row label="Unique donors" value={donations.donors.toLocaleString()} />
          </Rows>
        </Panel>

        <Panel title="Volunteer funds" icon="account_balance_wallet">
          <Rows>
            <Row label="Held in volunteer wallets" value={taka(volunteers.fundsHeld)} strong />
            <Row
              label="Raised by rescues and handed to their volunteer"
              value={taka(volunteers.movedFromRescues)}
            />
            <Row
              label="Raised by rescues still waiting for a volunteer"
              value={taka(volunteers.heldForUnassignedRescues)}
            />
            <Row label="Active volunteers" value={volunteers.active.toLocaleString()} />
          </Rows>
        </Panel>

        <Panel title="Marketplace & Rescue Fund" icon="storefront" soon={!marketplace.live}>
          {!marketplace.live && (
            <p className="mb-3 text-sm text-on-surface-variant">
              The marketplace is launching soon. Its profit will go into the Rescue Fund, which pays for rescue
              costs.
            </p>
          )}
          <Rows>
            <Row label="Marketplace revenue" value={taka(marketplace.revenue)} />
            <Row label="Marketplace profit" value={taka(marketplace.profit)} />
            <Row label="Contributed to the Rescue Fund" value={taka(rescueFund.contributed)} />
            <Row label="Rescue Fund used" value={taka(rescueFund.used)} />
            <Row label="Rescue Fund remaining" value={taka(rescueFund.remaining)} strong />
          </Rows>
        </Panel>

        <Panel title="Rescue activity" icon="pets">
          <Rows>
            <Row label="Rescue requests posted" value={rescues.total.toLocaleString()} />
            <Row label="Waiting for a volunteer" value={rescues.awaitingVolunteer.toLocaleString()} />
            <Row label="Being handled by a volunteer" value={rescues.inProgress.toLocaleString()} />
            <Row label="Rescued" value={rescues.rescued.toLocaleString()} strong />
            <Row label="Rescues that received donations" value={rescues.funded.toLocaleString()} />
          </Rows>
        </Panel>
      </div>

      <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
        <Icon name="lock" className="text-[14px]" />
        Updated {new Date(data.generatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.
        Totals only; individual donors are never shown on this page.
      </p>
    </div>
  );
}

function Tile({ icon, label, value, hint, accent = false }) {
  return (
    <div
      className={`rounded-2xl shadow-sm p-4 sm:p-5 min-w-0 ${
        accent ? "bg-primary text-white" : "bg-surface-container-lowest text-on-surface"
      }`}
    >
      <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${accent ? "text-white/85" : "text-on-surface-variant"}`}>
        <Icon name={icon} className="text-[18px]" />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-2 font-display text-2xl sm:text-3xl font-bold truncate">{value}</p>
      <p className={`mt-0.5 text-xs ${accent ? "text-white/85" : "text-on-surface-variant"}`}>{hint}</p>
    </div>
  );
}

function Panel({ title, icon, soon = false, children }) {
  return (
    <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-on-surface mb-4">
        {icon && <Icon name={icon} className="text-[20px] text-primary" />}
        {title}
        {soon && <SoonBadge />}
      </h2>
      {children}
    </section>
  );
}

function SoonBadge() {
  return (
    <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-bold">
      Coming soon
    </span>
  );
}

function Rows({ children }) {
  return <dl className="divide-y divide-surface-container-high">{children}</dl>;
}

function Row({ label, value, strong = false }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-sm text-on-surface-variant">{label}</dt>
      <dd className={`shrink-0 tabular-nums ${strong ? "font-display text-lg font-bold text-on-surface" : "font-semibold text-on-surface"}`}>
        {value}
      </dd>
    </div>
  );
}

function FlowStep({ step, icon, title, amount, soon = false, children }) {
  return (
    <li className="relative flex flex-col gap-1 p-4 rounded-xl bg-surface-container-low">
      <div className="flex items-center justify-between">
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-surface-container-lowest text-primary">
          <Icon name={icon} className="text-[20px]" />
        </span>
        <span className="text-xs font-bold text-on-surface-variant">Step {step}</span>
      </div>
      <p className="mt-2 font-semibold text-on-surface">{title}</p>
      {soon ? (
        <div>
          <SoonBadge />
        </div>
      ) : (
        <p className="font-display text-xl font-bold text-primary">{taka(amount)}</p>
      )}
      <p className="text-xs text-on-surface-variant">{children}</p>
    </li>
  );
}
