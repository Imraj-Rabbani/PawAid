import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { Avatar, Badge, Button, ListBody, Panel, SearchInput, SelectFilter, Toolbar } from "./ui";
import {
  USER_STATUS, VOLUNTEER_STATUS, errorMessage, formatDate, optionsFrom, taka, useAdminList, useDebounced,
} from "./adminUtils";

export default function VolunteersTab({ areas, onChange }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [areaId, setAreaId] = useState("");
  const debouncedSearch = useDebounced(search);

  const list = useAdminList("/admin/volunteers", { search: debouncedSearch, status, areaId });
  const [busyId, setBusyId] = useState(null);

  const setVolunteerStatus = async (volunteer, next) => {
    if (
      next === "SUSPENDED" &&
      !confirm(`Revoke ${volunteer.user.name}'s volunteer status? They will lose volunteer actions straight away. Their wallet is kept.`)
    ) {
      return;
    }

    try {
      setBusyId(volunteer.id);
      const res = await api.patch(`/admin/volunteers/${volunteer.id}/status`, { status: next });
      list.replaceItem(res.data.data);
      onChange();
    } catch (err) {
      console.error(err);
      alert(errorMessage(err, "Failed to update volunteer"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel title="Volunteers" description="Revoke or restore volunteer status. Wallets are read only.">
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or NID" />
        <SelectFilter label="Status" value={status} onChange={setStatus} options={optionsFrom(VOLUNTEER_STATUS, "All statuses")} />
        <SelectFilter
          label="Area"
          value={areaId}
          onChange={setAreaId}
          options={[{ value: "", label: "All areas" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
        />
      </Toolbar>

      <ListBody list={list} empty="No volunteers match these filters.">
        <ul className="divide-y divide-surface-container-high">
          {list.items.map((volunteer) => {
            const { user } = volunteer;
            const active = volunteer.status === "ACTIVE";
            const busy = busyId === volunteer.id;

            return (
              <li key={volunteer.id} className="py-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar user={user} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/profile/${user.id}`} className="font-semibold text-on-surface hover:text-primary truncate">
                        {user.name}
                      </Link>
                      <Badge status={VOLUNTEER_STATUS[volunteer.status]} />
                      {user.status !== "ACTIVE" && <Badge status={{ ...USER_STATUS[user.status], label: `Account ${USER_STATUS[user.status]?.label.toLowerCase()}` }} />}
                    </div>
                    <p className="text-xs text-on-surface-variant truncate">
                      {user.email}
                      {user.phone && ` · ${user.phone}`}
                    </p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      {volunteer.rescueArea.name} · NID {volunteer.nid || "—"} · Since {formatDate(volunteer.createdAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      Wallet <span className="font-semibold text-secondary">{taka(user.wallet?.balance)}</span> ·{" "}
                      {volunteer._count.assignedPosts} rescues · {volunteer._count.donations} donations received
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {active && (
                    <Link
                      to={`/volunteers/${volunteer.id}`}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                    >
                      Public profile
                    </Link>
                  )}
                  {active ? (
                    <Button variant="danger" icon="remove_moderator" disabled={busy} onClick={() => setVolunteerStatus(volunteer, "SUSPENDED")}>
                      Revoke
                    </Button>
                  ) : (
                    <Button variant="success" icon="verified_user" disabled={busy} onClick={() => setVolunteerStatus(volunteer, "ACTIVE")}>
                      {volunteer.status === "PENDING" ? "Approve" : "Restore"}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </ListBody>
    </Panel>
  );
}
