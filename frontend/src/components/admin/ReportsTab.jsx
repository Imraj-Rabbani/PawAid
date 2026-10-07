import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import { Avatar, Badge, Button, Chips, ListBody, Panel } from "./ui";
import { POST_STATUS, REPORT_STATUS, USER_STATUS, errorMessage, formatDate, useAdminList } from "./adminUtils";

const FILTERS = [
  { value: "PENDING", label: "Pending" },
  { value: "REVIEWED", label: "Reviewed" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "REJECTED", label: "Dismissed" },
  { value: "", label: "All" },
];

export default function ReportsTab({ counts, onChange }) {
  const [status, setStatus] = useState("PENDING");
  const list = useAdminList("/admin/reports", { status });
  const [busyId, setBusyId] = useState(null);

  // every action can move a report out of the current filter, so refetch afterwards
  const run = async (id, request) => {
    try {
      setBusyId(id);
      await request();
      list.reload();
      onChange();
    } catch (err) {
      console.error(err);
      alert(errorMessage(err, "Action failed"));
    } finally {
      setBusyId(null);
    }
  };

  const setReportStatus = (report, next) =>
    run(report.id, () => api.patch(`/admin/reports/${report.id}`, { status: next }));

  const takeDown = (report) => {
    if (!confirm(`Take down "${report.post.title}"? It will be hidden from the feed and all open reports on it will be resolved.`)) return;
    run(report.id, () => api.patch(`/admin/posts/${report.post.id}/status`, { status: "CANCELLED" }));
  };

  const suspendAuthor = (report) => {
    const author = report.post.creator;
    if (!confirm(`Suspend ${author.name}? They will be signed out and unable to use PawAid.`)) return;
    run(report.id, () => api.patch(`/admin/users/${author.id}/status`, { status: "SUSPENDED" }));
  };

  return (
    <Panel title="Reported posts" description="Review what the community has flagged.">
      <div className="mb-4">
        <Chips
          value={status}
          onChange={setStatus}
          options={FILTERS.map((f) => ({ ...f, count: f.value ? counts[f.value] ?? 0 : undefined }))}
        />
      </div>

      <ListBody list={list} empty={status === "PENDING" ? "No reports waiting. All clear!" : "No reports here."}>
        <ul className="flex flex-col gap-3">
          {list.items.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              busy={busyId === report.id}
              onStatus={(next) => setReportStatus(report, next)}
              onTakeDown={() => takeDown(report)}
              onSuspendAuthor={() => suspendAuthor(report)}
            />
          ))}
        </ul>
      </ListBody>
    </Panel>
  );
}

function ReportCard({ report, busy, onStatus, onTakeDown, onSuspendAuthor }) {
  const { post, reporter } = report;
  const open = report.status === "PENDING" || report.status === "REVIEWED";
  const thumb = post.images[0]?.imageUrl;

  return (
    <li className="border border-surface-container-high rounded-xl p-4 flex flex-col gap-3">
      {/* ── The report ── */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-on-surface">{report.reason}</p>
            <Badge status={REPORT_STATUS[report.status]} />
          </div>
          <p className="mt-0.5 text-xs text-on-surface-variant">
            Reported by{" "}
            <Link to={`/profile/${reporter.id}`} className="font-semibold hover:text-primary">
              {reporter.name}
            </Link>{" "}
            · {formatDate(report.createdAt)}
          </p>
        </div>
      </div>
      {report.description && (
        <p className="text-sm text-on-surface-variant whitespace-pre-wrap wrap-break-word bg-surface-container-low rounded-lg px-3 py-2">
          “{report.description}”
        </p>
      )}

      {/* ── The reported post ── */}
      <div className="flex gap-3 p-3 rounded-xl bg-surface">
        {thumb && <img src={thumb} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-on-surface truncate">{post.title}</p>
            <Badge status={POST_STATUS[post.status]} />
            {post._count.reports > 1 && (
              <span className="text-[11px] font-semibold text-error">{post._count.reports} reports</span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-on-surface-variant line-clamp-2 wrap-break-word">{post.description}</p>
          <div className="mt-2 flex items-center gap-2 text-xs text-on-surface-variant">
            <Avatar user={post.creator} size="w-5 h-5" />
            <Link to={`/profile/${post.creator.id}`} className="font-semibold hover:text-primary truncate">
              {post.creator.name}
            </Link>
            {post.creator.status !== "ACTIVE" && <Badge status={USER_STATUS[post.creator.status]} />}
            <span>· posted {formatDate(post.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-wrap gap-2">
        {report.status === "PENDING" && (
          <Button icon="visibility" disabled={busy} onClick={() => onStatus("REVIEWED")}>
            Mark reviewed
          </Button>
        )}
        {open && (
          <>
            <Button variant="success" icon="check" disabled={busy} onClick={() => onStatus("RESOLVED")}>
              Resolve
            </Button>
            <Button variant="ghost" icon="block" disabled={busy} onClick={() => onStatus("REJECTED")}>
              Dismiss
            </Button>
          </>
        )}
        {!open && (
          <Button variant="ghost" icon="undo" disabled={busy} onClick={() => onStatus("PENDING")}>
            Reopen
          </Button>
        )}
        <span className="flex-1" />
        {post.status !== "CANCELLED" && (
          <Button variant="danger" icon="delete" disabled={busy} onClick={onTakeDown}>
            Take down post
          </Button>
        )}
        {post.creator.status === "ACTIVE" && (
          <Button variant="danger" icon="person_off" disabled={busy} onClick={onSuspendAuthor}>
            Suspend author
          </Button>
        )}
      </div>
    </li>
  );
}
