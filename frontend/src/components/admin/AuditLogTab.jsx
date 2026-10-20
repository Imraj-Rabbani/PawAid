import { useState } from "react";
import { Avatar, Badge, Chips, ListBody, Panel, SearchInput, SelectFilter, Toolbar } from "./ui";
import { AUDIT_ACTION, AUDIT_TARGET, optionsFrom, useAdminList, useDebounced } from "./adminUtils";

const formatDateTime = (date) =>
  new Date(date).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const titleCase = (value) => value.toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// product fields as the admin knows them from the product form (details.changes)
const FIELD_LABELS = {
  name: "Name",
  description: "Description",
  categoryId: "Category",
  costPrice: "Cost price",
  sellingPrice: "Selling price",
  stockQty: "Stock",
  active: "Active",
  imageUrl: "Image",
};

// ids, urls and long text don't read well as before → after, so just say they changed
const NAME_ONLY = ["categoryId", "imageUrl", "description"];

const showValue = (value) => {
  if (value === null || value === undefined || value === "") return "none";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
};

const describeChange = (field, { from, to }) => {
  const label = FIELD_LABELS[field] || field;
  return NAME_ONLY.includes(field) ? `${label} changed` : `${label}: ${showValue(from)} → ${showValue(to)}`;
};

// Read only: entries are written alongside each admin action and can't be edited or removed
export default function AuditLogTab() {
  const [search, setSearch] = useState("");
  const [targetType, setTargetType] = useState("");
  const [action, setAction] = useState("");
  const debouncedSearch = useDebounced(search);

  const list = useAdminList("/admin/audit-logs", { search: debouncedSearch, targetType, action });

  return (
    <Panel title="Audit Log" description="Every action taken by an admin, newest first. Entries can't be edited or deleted.">
      <div className="mb-4">
        <Chips
          value={targetType}
          onChange={(value) => {
            setTargetType(value);
            setAction("");
          }}
          options={optionsFrom(AUDIT_TARGET, "All")}
        />
      </div>
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search actions or admin name" />
        <SelectFilter label="Action" value={action} onChange={setAction} options={optionsFrom(AUDIT_ACTION, "All actions")} />
      </Toolbar>

      <ListBody list={list} empty="No admin actions recorded yet.">
        <ul className="divide-y divide-surface-container-high">
          {list.items.map((log) => (
            <AuditRow key={log.id} log={log} />
          ))}
        </ul>
      </ListBody>
    </Panel>
  );
}

function AuditRow({ log }) {
  const changes = Object.entries(log.details?.changes ?? {});

  return (
    <li className="py-3 flex items-start gap-3">
      <Avatar user={log.admin} size="w-8 h-8" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge status={AUDIT_ACTION[log.action]} fallback={titleCase(log.action)} />
          <p className="text-sm font-semibold text-on-surface break-words">{log.summary}</p>
        </div>
        {changes.length > 0 && (
          <p className="mt-0.5 text-xs text-on-surface-variant flex flex-wrap gap-x-3">
            {changes.map(([field, change]) => (
              <span key={field}>{describeChange(field, change)}</span>
            ))}
          </p>
        )}
        <p className="mt-0.5 text-xs text-on-surface-variant">
          by <span className="font-semibold">{log.admin.name}</span> · {formatDateTime(log.createdAt)}
        </p>
      </div>
    </li>
  );
}
