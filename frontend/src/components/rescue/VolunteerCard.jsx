import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Icon from "../Icon";
import ResolveRescueModal from "../feed/ResolveRescueModal";
import { UPDATABLE_STATUSES, timeAgo } from "../feed/rescueUtils";

// Who is handling the rescue. Before anyone is, volunteers can claim it here; the
// volunteer on it gets their tools: start, post an update, log an expense, mark rescued.
// onCompose("update" | "expense") asks the page to open that form.
export default function VolunteerCard({ post, user, onUpdated, onCompose }) {
  const [busy, setBusy] = useState(false);
  const [showResolve, setShowResolve] = useState(false);

  const volunteer = post.assignedVolunteer;
  const handlingIt = volunteer && volunteer.user.id === user?.id;
  // the server checks the volunteer is still active, this only decides what to show
  const canClaim = user?.role === "VOLUNTEER" && post.status === "OPEN" && !volunteer;
  const canStart = handlingIt && post.status === "ASSIGNED";
  const canResolve = handlingIt && ["ASSIGNED", "IN_PROGRESS"].includes(post.status);
  const canWrite = handlingIt && UPDATABLE_STATUSES.includes(post.status);

  const claim = async () => {
    if (!confirm("Take responsibility for this rescue? Any donations it has raised will move to your wallet.")) return;

    try {
      setBusy(true);
      const res = await api.post(`/rescue-post/${post.id}/assign`);
      onUpdated(res.data.data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to assign rescue");
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    try {
      setBusy(true);
      const res = await api.patch(`/rescue-post/${post.id}/progress`, { status: "IN_PROGRESS" });
      onUpdated(res.data.data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update rescue");
    } finally {
      setBusy(false);
    }
  };

  const toolClass =
    "py-2.5 px-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50";

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Icon name="diversity_1" className="text-[22px] text-secondary" />
        <h2 className="font-display text-lg font-semibold text-on-surface">
          {handlingIt ? "Your Rescue" : volunteer ? "Volunteer on This Rescue" : "Volunteer Needed"}
        </h2>
      </div>

      {volunteer ? (
        <Link
          to={`/volunteers/${volunteer.id}`}
          className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition"
        >
          <img
            src={volunteer.user.profilePictureUrl || "/default-avatar.png"}
            alt=""
            className="w-11 h-11 rounded-full object-cover ring-2 ring-surface-container-lowest shadow-sm"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1 font-bold text-on-surface truncate">
              {volunteer.user.name}
              <Icon name="verified" filled className="text-[16px] text-secondary shrink-0" />
            </p>
            <p className="text-xs text-on-surface-variant">
              {post.status === "RESOLVED"
                ? `Rescued ${post.resolvedAt ? timeAgo(post.resolvedAt).toLowerCase() : ""}`
                : handlingIt
                  ? "You're handling this rescue"
                  : "Handling this rescue"}
            </p>
          </div>
          <Icon name="chevron_right" className="ml-auto text-[20px] text-on-surface-variant" />
        </Link>
      ) : (
        <p className="text-sm text-on-surface-variant">
          Nobody has taken this rescue on yet. A volunteer who claims it takes responsibility for the animal, and any
          donations it has raised move to their wallet.
        </p>
      )}

      {canClaim && (
        <button
          onClick={claim}
          disabled={busy}
          className={`${toolClass} bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed`}
        >
          <Icon name="handshake" className="text-[18px]" />
          {busy ? "Claiming..." : "Claim This Rescue"}
        </button>
      )}
      {!volunteer && !user && (
        <Link to="/signin" className="text-sm font-semibold text-secondary hover:underline">
          Sign in as a volunteer to claim it
        </Link>
      )}

      {(canStart || canResolve || canWrite) && (
        <div className="grid grid-cols-2 gap-2">
          {canStart && (
            <button
              onClick={start}
              disabled={busy}
              className={`${toolClass} col-span-2 bg-secondary-container text-on-secondary-container hover:bg-secondary-fixed`}
            >
              <Icon name="directions_run" className="text-[18px]" />
              {busy ? "Updating..." : "Start Rescue"}
            </button>
          )}
          {canWrite && (
            <>
              <button onClick={() => onCompose("update")} className={`${toolClass} bg-surface-container-low text-on-surface hover:bg-surface-container`}>
                <Icon name="edit_note" className="text-[18px] text-secondary" />
                Post Update
              </button>
              <button onClick={() => onCompose("expense")} className={`${toolClass} bg-surface-container-low text-on-surface hover:bg-surface-container`}>
                <Icon name="receipt_long" className="text-[18px] text-secondary" />
                Log Expense
              </button>
            </>
          )}
          {canResolve && (
            <button
              onClick={() => setShowResolve(true)}
              disabled={busy}
              className={`${toolClass} col-span-2 bg-secondary text-white shadow-sm hover:opacity-90`}
            >
              <Icon name="check_circle" className="text-[18px]" />
              Mark Rescued
            </button>
          )}
        </div>
      )}

      {showResolve && (
        <ResolveRescueModal
          post={post}
          onClose={() => setShowResolve(false)}
          onResolved={(updated) => {
            setShowResolve(false);
            onUpdated(updated);
          }}
        />
      )}
    </div>
  );
}
