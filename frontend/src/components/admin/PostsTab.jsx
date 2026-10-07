import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Icon from "../Icon";
import { Avatar, Badge, Button, ListBody, Panel, SearchInput, SelectFilter, Toolbar } from "./ui";
import { POST_STATUS, errorMessage, formatDate, optionsFrom, taka, useAdminList, useDebounced } from "./adminUtils";

// statuses an admin can move a post to, matching the checks in updatePostStatus
const statusChoices = (post) =>
  (post.assignedVolunteer
    ? ["ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED", "CANCELLED"]
    : ["OPEN", "RESOLVED", "CLOSED", "CANCELLED"]
  ).map((value) => ({ value, label: POST_STATUS[value].label }));

export default function PostsTab({ areas, onChange }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [areaId, setAreaId] = useState("");
  const [reported, setReported] = useState(false);
  const debouncedSearch = useDebounced(search);

  const list = useAdminList("/admin/posts", { search: debouncedSearch, status, areaId, reported });
  const [busyId, setBusyId] = useState(null);

  const changeStatus = async (post, next) => {
    if (next === post.status) return;
    if (next === "CANCELLED" && !confirm(`Take down "${post.title}"? It will be hidden from the feed and its open reports resolved.`)) {
      return;
    }

    try {
      setBusyId(post.id);
      const res = await api.patch(`/admin/posts/${post.id}/status`, { status: next });
      list.replaceItem(res.data.data);
      onChange();
    } catch (err) {
      console.error(err);
      alert(errorMessage(err, "Failed to update post"));
    } finally {
      setBusyId(null);
    }
  };

  // a taken down post goes back to the state its volunteer assignment implies
  const restore = (post) => changeStatus(post, post.assignedVolunteer ? "ASSIGNED" : "OPEN");

  return (
    <Panel title="Rescue posts" description="Moderate posts and keep rescue statuses accurate.">
      <Toolbar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, description or author" />
        <SelectFilter label="Status" value={status} onChange={setStatus} options={optionsFrom(POST_STATUS, "All statuses")} />
        <SelectFilter
          label="Area"
          value={areaId}
          onChange={setAreaId}
          options={[{ value: "", label: "All areas" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]}
        />
        <label className="flex items-center gap-2 px-3 py-2 text-sm text-on-surface bg-surface-container-low rounded-xl cursor-pointer">
          <input type="checkbox" checked={reported} onChange={(e) => setReported(e.target.checked)} className="accent-primary" />
          Open reports only
        </label>
      </Toolbar>

      <ListBody list={list} empty="No posts match these filters.">
        <ul className="divide-y divide-surface-container-high">
          {list.items.map((post) => (
            <PostRow
              key={post.id}
              post={post}
              busy={busyId === post.id}
              onStatus={(next) => changeStatus(post, next)}
              onRestore={() => restore(post)}
            />
          ))}
        </ul>
      </ListBody>
    </Panel>
  );
}

function PostRow({ post, busy, onStatus, onRestore }) {
  const thumb = post.images[0]?.imageUrl;
  const removed = post.status === "CANCELLED";

  return (
    <li className={`py-4 flex flex-col md:flex-row md:items-center gap-3 ${removed ? "opacity-70" : ""}`}>
      <div className="flex gap-3 min-w-0 flex-1">
        {thumb ? (
          <img src={thumb} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0">
            <Icon name="pets" className="text-[22px] text-on-surface-variant" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-on-surface truncate">{post.title}</p>
            <Badge status={POST_STATUS[post.status]} />
            {post._count.reports > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-error">
                <Icon name="flag" filled className="text-[14px]" />
                {post._count.reports}
              </span>
            )}
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-on-surface-variant">
            <span className="inline-flex items-center gap-1">
              <Avatar user={post.creator} size="w-4 h-4" />
              <Link to={`/profile/${post.creator.id}`} className="font-semibold hover:text-primary">
                {post.creator.name}
              </Link>
            </span>
            <span>· {post.rescueArea.name}</span>
            <span>· {formatDate(post.createdAt)}</span>
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-on-surface-variant">
            {post.assignedVolunteer ? (
              <span>
                Volunteer:{" "}
                <Link to={`/volunteers/${post.assignedVolunteer.id}`} className="font-semibold hover:text-primary">
                  {post.assignedVolunteer.user.name}
                </Link>
              </span>
            ) : (
              <span>No volunteer</span>
            )}
            {post.donationTarget > 0 && (
              <span>
                Raised {taka(post.donationReceived)} of {taka(post.donationTarget)}
              </span>
            )}
            <span>
              {post._count.upvotes} upvotes · {post._count.comments} comments
            </span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {removed ? (
          <Button variant="success" icon="restore" disabled={busy} onClick={onRestore}>
            Restore
          </Button>
        ) : (
          <>
            <SelectFilter label="Change status" value={post.status} onChange={onStatus} options={statusChoices(post)} />
            <Button variant="danger" icon="delete" disabled={busy} onClick={() => onStatus("CANCELLED")}>
              Take down
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
