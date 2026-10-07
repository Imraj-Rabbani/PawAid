import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { Avatar, Badge, Button, ListBody, Panel, SearchInput, SelectFilter, Toolbar } from "./ui";
import { ROLE, USER_STATUS, errorMessage, formatDate, optionsFrom, taka, useAdminList, useDebounced } from "./adminUtils";

export default function UsersTab({ currentUserId, onChange }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const debouncedSearch = useDebounced(search);

  const list = useAdminList("/admin/users", { search: debouncedSearch, role, status });
  const [busyId, setBusyId] = useState(null);

  const setUserStatus = async (user, next) => {
    const suspending = next === "SUSPENDED";
    if (
      suspending &&
      !confirm(`Suspend ${user.name}? They will be signed out and unable to use PawAid until reactivated.`)
    ) {
      return;
    }

    try {
      setBusyId(user.id);
      const res = await api.patch(`/admin/users/${user.id}/status`, { status: next });
      list.replaceItem(res.data.data);
      onChange();
    } catch (err) {
      console.error(err);
      alert(errorMessage(err, "Failed to update user"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel title="Users" description="Everyone with a PawAid account.">
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, email or phone" />
        <SelectFilter label="Role" value={role} onChange={setRole} options={optionsFrom(ROLE, "All roles")} />
        <SelectFilter label="Status" value={status} onChange={setStatus} options={optionsFrom(USER_STATUS, "All statuses")} />
      </Toolbar>

      <ListBody list={list} empty="No users match these filters.">
        <ul className="divide-y divide-surface-container-high">
          {list.items.map((user) => {
            // admins (including yourself) can't be suspended from here
            const manageable = user.role !== "ADMIN" && user.id !== currentUserId;
            const busy = busyId === user.id;

            return (
              <li key={user.id} className="py-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar user={user} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/profile/${user.id}`} className="font-semibold text-on-surface hover:text-primary truncate">
                        {user.name}
                      </Link>
                      <Badge status={ROLE[user.role]} />
                      {user.status !== "ACTIVE" && <Badge status={USER_STATUS[user.status]} />}
                      {user.id === currentUserId && (
                        <span className="text-[11px] font-semibold text-on-surface-variant">(You)</span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant truncate">
                      {user.email}
                      {user.phone && ` · ${user.phone}`}
                    </p>
                    <p className="mt-0.5 text-xs text-on-surface-variant">
                      Joined {formatDate(user.createdAt)} · {user._count.rescuePosts} posts · {user._count.donations} donations · Wallet {taka(user.wallet?.balance)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/profile/${user.id}`}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  >
                    View profile
                  </Link>
                  {manageable &&
                    (user.status === "SUSPENDED" ? (
                      <Button variant="success" icon="person_check" disabled={busy} onClick={() => setUserStatus(user, "ACTIVE")}>
                        Reactivate
                      </Button>
                    ) : (
                      <Button variant="danger" icon="person_off" disabled={busy} onClick={() => setUserStatus(user, "SUSPENDED")}>
                        Suspend
                      </Button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      </ListBody>
    </Panel>
  );
}
