import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Chips, ListBody, Panel } from "./ui";
import { TRANSACTION_TYPE, formatDate, taka, useAdminList } from "./adminUtils";

const STATUS_TONE = { PENDING: "warning", COMPLETED: "success", FAILED: "danger", CANCELLED: "neutral" };

const titleCase = (value) =>
  value ? value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "—";

// Read only ledger: admins can't edit balances, every change is a transaction (PRD §27)
export default function TransactionsTab() {
  const [type, setType] = useState("");
  const list = useAdminList("/admin/transactions", { type });
  const totals = list.body?.totals ?? [];

  return (
    <div className="flex flex-col gap-6">
      {totals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {totals.map((t) => (
            <div key={t.type} className="bg-surface-container-lowest rounded-2xl shadow-sm p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                {TRANSACTION_TYPE[t.type]?.label || titleCase(t.type)}
              </p>
              <p className="mt-1 font-display text-2xl font-bold text-on-surface">{taka(t.amount)}</p>
              <p className="text-xs text-on-surface-variant">{t.count} completed</p>
            </div>
          ))}
        </div>
      )}

      <Panel title="Transactions" description="Every money movement on the platform, newest first.">
        <div className="mb-4">
          <Chips
            value={type}
            onChange={setType}
            options={[
              { value: "", label: "All" },
              ...Object.entries(TRANSACTION_TYPE).map(([value, { label }]) => ({ value, label })),
            ]}
          />
        </div>

        <ListBody list={list} empty="No transactions yet.">
          <ul className="divide-y divide-surface-container-high">
            {list.items.map((t) => (
              <TransactionRow key={t.id} transaction={t} />
            ))}
          </ul>
        </ListBody>
      </Panel>
    </div>
  );
}

function TransactionRow({ transaction: t }) {
  return (
    <li className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge status={TRANSACTION_TYPE[t.type]} fallback={titleCase(t.type)} />
          <p className="text-sm font-semibold text-on-surface truncate">{t.reference || titleCase(t.type)}</p>
          {t.status !== "COMPLETED" && (
            <Badge status={{ label: titleCase(t.status), tone: STATUS_TONE[t.status] }} />
          )}
        </div>
        <p className="mt-0.5 text-xs text-on-surface-variant">
          {titleCase(t.source)} → {titleCase(t.destination)}
          {t.payment?.method && ` · via ${titleCase(t.payment.method)}`}
          {" · "}
          {formatDate(t.createdAt)}
        </p>
        <p className="mt-0.5 text-xs text-on-surface-variant flex flex-wrap gap-x-2">
          {t.relatedUser && (
            <span>
              User:{" "}
              <Link to={`/profile/${t.relatedUser.id}`} className="font-semibold hover:text-primary">
                {t.relatedUser.name}
              </Link>
            </span>
          )}
          {t.relatedVolunteer && (
            <span>
              Volunteer:{" "}
              <Link to={`/volunteers/${t.relatedVolunteer.id}`} className="font-semibold hover:text-primary">
                {t.relatedVolunteer.user.name}
              </Link>
            </span>
          )}
          {t.relatedPost && <span>Post: {t.relatedPost.title}</span>}
        </p>
      </div>
      <p className="font-display text-lg font-bold text-on-surface tabular-nums shrink-0">{taka(t.amount)}</p>
    </li>
  );
}
