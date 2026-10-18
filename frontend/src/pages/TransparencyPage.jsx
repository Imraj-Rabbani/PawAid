import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Icon from "../components/Icon";
import FundDonateModal from "../components/transparency/FundDonateModal";

const taka = (amount) => `৳${(amount ?? 0).toLocaleString()}`;

// Public financial overview (PRD §19, §41): platform totals only, never individual donors
export default function TransparencyPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // bumped after an admin donates from the fund, so the totals refresh
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [reloadKey]);

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
          <Overview data={data} onFundChange={() => setReloadKey((k) => k + 1)} />
        )}
      </main>
    </div>
  );
}

function Overview({ data, onFundChange }) {
  const { donations, volunteers, rescues, marketplace, pawaidFund } = data;

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
        <ol className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
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
          <FlowStep step={5} icon="savings" title="Profit comes back" amount={pawaidFund.received} soon={!marketplace.live}>
            Marketplace profit fills the PawAid Fund, which donates it back to rescues.
          </FlowStep>
        </ol>
      </Panel>

      <PawAidFund fund={pawaidFund} onChange={onFundChange} />

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

        <Panel title="Marketplace" icon="storefront" soon={!marketplace.live}>
          {!marketplace.live && (
            <p className="mb-3 text-sm text-on-surface-variant">
              The marketplace is launching soon. Its profit will go into the PawAid Fund.
            </p>
          )}
          <Rows>
            <Row label="Revenue" value={taka(marketplace.revenue)} />
            <Row label="Orders delivered" value={marketplace.deliveredOrders.toLocaleString()} />
            <Row label="Profit paid into the PawAid Fund" value={taka(marketplace.profit)} strong />
          </Rows>
        </Panel>

        <Panel title="Rescue activity" icon="pets">
          <Rows>
            <Row label="Rescue requests posted" value={rescues.total.toLocaleString()} />
            <Row label="Waiting for a volunteer" value={rescues.awaitingVolunteer.toLocaleString()} />
            <Row label="Being handled by a volunteer" value={rescues.inProgress.toLocaleString()} />
            <Row label="Rescued" value={rescues.rescued.toLocaleString()} strong />
            <Row label="Rescues that received donations" value={rescues.funded.toLocaleString()} />
            <Row
              label={`Spent on rescues, with receipts (${rescues.expenseCount.toLocaleString()} ${rescues.expenseCount === 1 ? "expense" : "expenses"})`}
              value={taka(rescues.documentedExpenses)}
            />
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

// Marketplace profit collects here; admins donate it to volunteers and rescues
function PawAidFund({ fund, onChange }) {
  const isAdmin = JSON.parse(localStorage.getItem("user") || "null")?.role === "ADMIN";
  const [donating, setDonating] = useState(false);

  return (
    <section className="bg-surface-container-lowest rounded-2xl shadow-sm p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-on-surface">
            <Icon name="savings" className="text-[20px] text-primary" />
            PawAid Fund
          </h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            Every taka of marketplace profit goes into this fund once an order is delivered. PawAid donates it to
            volunteers and rescues, and every donation it makes is listed below.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setDonating(true)}
            disabled={fund.balance <= 0}
            title={fund.balance <= 0 ? "The fund is empty" : undefined}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-container shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="volunteer_activism" className="text-[18px]" />
            Donate from fund
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-primary text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/85">Available now</p>
            <p className="mt-1 font-display text-3xl sm:text-4xl font-bold">{taka(fund.balance)}</p>
          </div>
          <Rows>
            <Row label="Received from marketplace profit" value={taka(fund.received)} />
            <Row label="Donated to volunteers" value={taka(fund.toVolunteers)} />
            <Row label="Donated to rescue posts" value={taka(fund.toRescues)} />
            <Row
              label={`Donated in total (${fund.donationCount.toLocaleString()} ${fund.donationCount === 1 ? "donation" : "donations"})`}
              value={taka(fund.donated)}
              strong
            />
          </Rows>
        </div>

        <div className="lg:col-span-3 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Recent donations from the fund</p>
            {fund.recent.length > 0 && (
              <Link to="/donations" className="text-xs font-semibold text-primary hover:text-primary-container">
                All donations
              </Link>
            )}
          </div>
          {fund.recent.length === 0 ? (
            <p className="mt-3 py-8 text-center text-sm text-on-surface-variant bg-surface-container-low rounded-xl">
              The fund hasn't made any donations yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-surface-container-high">
              {fund.recent.map((d) => (
                <FundDonationRow key={d.id} donation={d} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {donating && (
        <FundDonateModal
          balance={fund.balance}
          onClose={() => setDonating(false)}
          onDonated={() => {
            setDonating(false);
            onChange();
          }}
        />
      )}
    </section>
  );
}

function FundDonationRow({ donation }) {
  const { amount, createdAt, rescuePost, volunteer } = donation;
  const toPost = donation.destinationType === "RESCUE_POST";

  return (
    <li className="flex items-center gap-3 py-2.5">
      {toPost ? (
        <span className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center shrink-0">
          <Icon name="pets" className="text-[18px] text-primary" />
        </span>
      ) : (
        <img
          src={volunteer?.user.profilePictureUrl || "/default-avatar.png"}
          alt=""
          className="w-9 h-9 rounded-full object-cover shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        {toPost ? (
          <p className="text-sm font-semibold text-on-surface truncate">Rescue: {rescuePost?.title ?? "Rescue post"}</p>
        ) : volunteer ? (
          <Link to={`/volunteers/${volunteer.id}`} className="block text-sm font-semibold text-on-surface truncate hover:text-primary">
            {volunteer.user.name}
          </Link>
        ) : (
          <p className="text-sm font-semibold text-on-surface">Volunteer</p>
        )}
        <p className="text-xs text-on-surface-variant">
          {new Date(createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>
      <p className="shrink-0 font-semibold text-on-surface tabular-nums">{taka(amount)}</p>
    </li>
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
