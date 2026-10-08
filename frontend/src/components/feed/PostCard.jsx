import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import CommentSection from "./CommentSection";
import ReportPostModal from "./ReportPostModal";
import DonatePostModal from "./DonatePostModal";
import EditPostModal from "./EditPostModal";
import ResolveRescueModal from "./ResolveRescueModal";
import ImageLightbox from "./ImageLightbox";
import Icon from "../Icon";

const STATUS = {
  OPEN: { label: "Awaiting Volunteer", className: "bg-error-container text-on-error-container" },
  ASSIGNED: { label: "Assigned", className: "bg-secondary-container text-on-secondary-container" },
  IN_PROGRESS: { label: "In Progress", className: "bg-secondary-container text-on-secondary-container" },
  RESOLVED: { label: "Rescued", className: "bg-secondary-container text-on-secondary-container" },
  CLOSED: { label: "Closed", className: "bg-surface-container-high text-on-surface-variant" },
  CANCELLED: { label: "Cancelled", className: "bg-surface-container-high text-on-surface-variant" },
};

// keep in sync with DONATABLE_STATUSES in backend/src/modules/donation/donation.controller.js
const DONATABLE_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS"];

const MAX_IMAGES_SHOWN = 4;
const LONG_DESCRIPTION = 280;

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function PostCard({ post, user, onUpdated, onDeleted }) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  // stable so the lightbox doesn't redo its setup on every render
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  // status and volunteer change in place when a volunteer takes the rescue
  const [assignment, setAssignment] = useState({
    status: post.status,
    assignedVolunteer: post.assignedVolunteer,
  });
  const [assigning, setAssigning] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post._count?.comments ?? 0);
  const [upvoted, setUpvoted] = useState(Boolean(post.upvoted));
  const [upvoteCount, setUpvoteCount] = useState(post._count?.upvotes ?? 0);
  const [upvoting, setUpvoting] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reported, setReported] = useState(false);
  const [raised, setRaised] = useState(post.donationReceived);
  const [showDonate, setShowDonate] = useState(false);
  const [thanks, setThanks] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [progressing, setProgressing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  const { creator, rescueArea, images } = post;
  const status = STATUS[assignment.status] || STATUS.OPEN;
  const { assignedVolunteer } = assignment;
  // the server checks the volunteer is still active, this only decides whether to show the button
  const canAssign =
    user?.role === "VOLUNTEER" && assignment.status === "OPEN" && !assignedVolunteer;
  const isLong = post.description.length > LONG_DESCRIPTION;
  const shownImages = images.slice(0, MAX_IMAGES_SHOWN);
  const hiddenCount = images.length - shownImages.length;
  const progress = post.donationTarget
    ? Math.min(100, Math.round((raised / post.donationTarget) * 100))
    : 0;

  const isOwnPost = user?.id === creator.id;
  const fullyFunded = progress >= 100;
  const handlingIt = assignedVolunteer && assignedVolunteer.user.id === user?.id;
  // the volunteer on the rescue moves it forward; the server re-checks they're still active
  const canStart = handlingIt && assignment.status === "ASSIGNED";
  const canResolve = handlingIt && ["ASSIGNED", "IN_PROGRESS"].includes(assignment.status);
  // creators can change their post until a volunteer takes it on
  const canEdit = isOwnPost && assignment.status === "OPEN" && !assignedVolunteer;
  // fundraising rescues take donations on the post, before or after a volunteer takes them
  const canDonate =
    post.donationTarget > 0 && DONATABLE_STATUSES.includes(assignment.status) && !isOwnPost && !handlingIt;
  // a rescue without a target can still be supported through its volunteer
  const canDonateToVolunteer = !canDonate && assignedVolunteer && !handlingIt && !post.donationTarget;

  const toggleUpvote = async () => {
    if (!user) {
      navigate("/signin");
      return;
    }
    if (upvoting) return;

    // update right away, then settle on the count the server returns
    const next = !upvoted;
    setUpvoted(next);
    setUpvoteCount((n) => n + (next ? 1 : -1));

    try {
      setUpvoting(true);
      const res = next
        ? await api.post(`/rescue-post/${post.id}/upvote`)
        : await api.delete(`/rescue-post/${post.id}/upvote`);
      setUpvoted(res.data.data.upvoted);
      setUpvoteCount(res.data.data.upvoteCount);
    } catch (err) {
      console.error(err);
      setUpvoted(!next);
      setUpvoteCount((n) => n + (next ? -1 : 1));
      alert(err.response?.data?.message || "Failed to update upvote");
    } finally {
      setUpvoting(false);
    }
  };

  const assignToMe = async () => {
    if (!confirm("Take responsibility for this rescue? Any donations it has raised will move to your wallet.")) {
      return;
    }

    try {
      setAssigning(true);
      const res = await api.post(`/rescue-post/${post.id}/assign`);
      setAssignment({
        status: res.data.data.status,
        assignedVolunteer: res.data.data.assignedVolunteer,
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to assign rescue");
    } finally {
      setAssigning(false);
    }
  };

  // the server sends back the whole post after a change; keep this card and the feed in step
  const applyUpdate = (updated) => {
    setAssignment({ status: updated.status, assignedVolunteer: updated.assignedVolunteer });
    onUpdated?.(updated);
  };

  const startRescue = async () => {
    try {
      setProgressing(true);
      const res = await api.patch(`/rescue-post/${post.id}/progress`, { status: "IN_PROGRESS" });
      applyUpdate(res.data.data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update rescue");
    } finally {
      setProgressing(false);
    }
  };

  const deletePost = async () => {
    if (!confirm("Delete this rescue post? This can't be undone.")) return;

    try {
      setDeleting(true);
      await api.delete(`/rescue-post/${post.id}`);
      onDeleted?.(post.id);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to delete post");
      setDeleting(false);
    }
  };

  const openDonate = () => {
    if (!user) {
      navigate("/signin");
      return;
    }
    setThanks("");
    setShowDonate(true);
  };

  const handleDonated = ({ donation, post: updated }) => {
    setRaised(updated.donationReceived);
    setShowDonate(false);
    setThanks(`Thank you! You donated ৳${donation.amount.toLocaleString()} to this rescue.`);
  };

  const openReport = () => {
    if (!user) {
      navigate("/signin");
      return;
    }
    setShowReport(true);
  };

  return (
    <article className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 sm:p-6 flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to={`/profile/${creator.id}`} className="shrink-0">
            <img
              src={creator.profilePictureUrl || "/default-avatar.png"}
              alt={creator.name}
              className="w-11 h-11 rounded-full object-cover ring-2 ring-surface-container-high"
            />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Link
                to={`/profile/${creator.id}`}
                className="font-display text-[17px] font-semibold text-on-surface hover:text-primary truncate"
              >
                {creator.name}
              </Link>
              {creator.role === "VOLUNTEER" && (
                <Icon name="verified" filled className="text-[16px] text-secondary shrink-0" />
              )}
              {isOwnPost && (
                <span className="shrink-0 px-1.5 rounded bg-surface-container-high text-on-surface-variant text-[11px] font-semibold">
                  You
                </span>
              )}
            </div>
            <p className="flex items-center gap-2 text-[13px] text-on-surface-variant">
              <span className="shrink-0">{timeAgo(post.createdAt)}</span>
              <span>•</span>
              <span className="flex items-center gap-0.5 min-w-0">
                <Icon name="location_on" className="text-[14px]" />
                <span className="truncate">{rescueArea.name}</span>
              </span>
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-full ${status.className}`}
        >
          {assignment.status === "OPEN" ? (
            <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
          ) : (
            <Icon name="check_circle" className="text-[14px]" />
          )}
          {status.label}
        </span>
      </div>

      {/* ── Body ── */}
      <div>
        <h3 className="font-display text-xl font-semibold text-on-surface wrap-break-word">{post.title}</h3>
        <p
          className={`mt-2 text-[15px] leading-relaxed text-on-surface-variant whitespace-pre-wrap wrap-break-word ${
            isLong && !expanded ? "line-clamp-4" : ""
          }`}
        >
          {post.description}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-sm font-semibold text-primary hover:text-primary-container"
          >
            {expanded ? "See less" : "See more"}
          </button>
        )}
      </div>

      {/* ── Volunteer ── */}
      {assignedVolunteer && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-container-low">
          <img
            src={assignedVolunteer.user.profilePictureUrl || "/default-avatar.png"}
            alt={assignedVolunteer.user.name}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-secondary-container shrink-0"
          />
          <p className="text-sm text-on-surface-variant min-w-0">
            <Link
              to={`/volunteers/${assignedVolunteer.id}`}
              className="font-semibold text-on-surface hover:text-secondary"
            >
              {assignedVolunteer.user.name}
            </Link>{" "}
            is handling this rescue
          </p>
          <Icon name="verified_user" className="ml-auto text-[18px] text-secondary shrink-0" />
        </div>
      )}

      {/* ── Rescue update ── */}
      {assignment.status === "RESOLVED" && (post.rescueNote || post.rescuePhotoUrl) && (
        <div className="rounded-xl bg-secondary-container/40 p-3 flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-on-secondary-container">
            <Icon name="celebration" className="text-[16px]" />
            Rescue update
            {post.resolvedAt && (
              <span className="font-medium normal-case tracking-normal text-on-surface-variant">
                · {timeAgo(post.resolvedAt)}
              </span>
            )}
          </p>
          {post.rescueNote && (
            <p className="text-[15px] text-on-surface whitespace-pre-wrap wrap-break-word">{post.rescueNote}</p>
          )}
          {post.rescuePhotoUrl && (
            <img
              src={post.rescuePhotoUrl}
              alt={`${post.title} after the rescue`}
              loading="lazy"
              className="w-full max-h-96 object-cover rounded-lg"
            />
          )}
        </div>
      )}

      {/* ── Images ── */}
      {shownImages.length > 0 && (
        <div
          className={`grid gap-1 rounded-xl overflow-hidden ${shownImages.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {shownImages.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setLightboxIndex(index)}
              aria-label={`View image ${index + 1} of ${images.length}`}
              className={`relative block bg-surface-container-high overflow-hidden cursor-zoom-in group ${
                shownImages.length === 3 && index === 0 ? "col-span-2" : ""
              }`}
            >
              <img
                src={image.imageUrl}
                alt={post.title}
                loading="lazy"
                className={`w-full object-cover group-hover:scale-[1.02] transition-transform duration-500 ${
                  shownImages.length === 1 ? "max-h-128" : "h-56"
                }`}
              />
              {hiddenCount > 0 && index === shownImages.length - 1 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xl font-semibold">
                  +{hiddenCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          startIndex={lightboxIndex}
          alt={post.title}
          onClose={closeLightbox}
        />
      )}

      {/* ── Donation progress ── */}
      {post.donationTarget > 0 && (
        <div className="bg-surface-container-low p-4 rounded-xl flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-baseline gap-1 flex-wrap">
              <span className={`font-display text-xl font-bold ${fullyFunded ? "text-secondary" : "text-primary"}`}>
                ৳{raised.toLocaleString()}
              </span>
              <span className="text-[13px] text-on-surface-variant">
                raised of ৳{post.donationTarget.toLocaleString()} target
              </span>
            </p>
            <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-secondary">
              {fullyFunded && <Icon name="verified" className="text-[16px]" />}
              {progress}% Funded
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${fullyFunded ? "bg-secondary" : "bg-primary"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {thanks && (
        <p className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary-container text-on-secondary-container text-sm font-semibold">
          <Icon name="favorite" filled className="text-[18px]" />
          {thanks}
        </p>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {(canAssign || canDonate || canDonateToVolunteer || canStart || canResolve) && (
          <div className="flex flex-wrap items-center gap-2">
            {canStart && (
              <button
                onClick={startRescue}
                disabled={progressing}
                className="flex-1 sm:flex-none bg-surface-container-low hover:bg-surface-container-high text-secondary px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Icon name="directions_run" className="text-[18px]" />
                {progressing ? "Updating..." : "Start Rescue"}
              </button>
            )}
            {canResolve && (
              <button
                onClick={() => setShowResolve(true)}
                disabled={progressing}
                className="flex-1 sm:flex-none bg-secondary hover:opacity-90 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Icon name="check_circle" className="text-[18px]" />
                Mark Rescued
              </button>
            )}
            {canDonate && (
              <button
                onClick={openDonate}
                className="flex-1 sm:flex-none bg-primary hover:bg-primary-container text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition flex items-center justify-center gap-2"
              >
                <Icon name="volunteer_activism" className="text-[18px]" />
                Donate
              </button>
            )}
            {canDonateToVolunteer && (
              <Link
                to={`/volunteers/${assignedVolunteer.id}`}
                className="flex-1 sm:flex-none bg-primary hover:bg-primary-container text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition flex items-center justify-center gap-2"
              >
                <Icon name="volunteer_activism" className="text-[18px]" />
                Donate to {assignedVolunteer.user.name.split(" ")[0]}
              </Link>
            )}
            {canAssign && (
              <button
                onClick={assignToMe}
                disabled={assigning}
                className="flex-1 sm:flex-none bg-surface-container-low hover:bg-surface-container-high text-secondary px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Icon name="handshake" className="text-[18px]" />
                {assigning ? "Claiming..." : "Claim Case as Volunteer"}
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-1 text-xs font-medium text-on-surface-variant sm:ml-auto self-end sm:self-center">
          <button
            onClick={toggleUpvote}
            aria-pressed={upvoted}
            aria-label={upvoted ? "Remove upvote" : "Upvote"}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-surface-container-low transition ${
              upvoted ? "text-primary" : "hover:text-on-surface"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-4.5 h-4.5"
              fill={upvoted ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 4l8 9h-5v7H9v-7H4z" />
            </svg>
            {upvoteCount}
          </button>

          <button
            onClick={() => setShowComments((v) => !v)}
            aria-expanded={showComments}
            aria-label="Comments"
            className={`flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-surface-container-low transition ${
              showComments ? "text-on-surface" : "hover:text-on-surface"
            }`}
          >
            <Icon name="mode_comment" filled={showComments} className="text-[18px]" />
            {commentCount}
          </button>

          {canEdit && (
            <>
              <button
                onClick={() => setShowEdit(true)}
                aria-label="Edit post"
                title="Edit post"
                className="flex items-center px-2 py-1 rounded-lg hover:bg-surface-container-low hover:text-on-surface transition"
              >
                <Icon name="edit" className="text-[18px]" />
              </button>
              <button
                onClick={deletePost}
                disabled={deleting}
                aria-label="Delete post"
                title="Delete post"
                className="flex items-center px-2 py-1 rounded-lg hover:bg-surface-container-low hover:text-error transition disabled:opacity-50"
              >
                <Icon name="delete" className="text-[18px]" />
              </button>
            </>
          )}

          {!isOwnPost && (
            <button
              onClick={openReport}
              disabled={reported}
              aria-label={reported ? "Reported" : "Report post"}
              title={reported ? "Reported" : "Report post"}
              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-surface-container-low hover:text-error transition disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
            >
              <Icon name="flag" filled={reported} className="text-[18px]" />
              {reported && "Reported"}
            </button>
          )}
        </div>
      </div>

      {showComments && (
        <div className="-mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
          <CommentSection
            postId={post.id}
            user={user}
            timeAgo={timeAgo}
            onCountChange={(delta) => setCommentCount((n) => n + delta)}
          />
        </div>
      )}
      {showEdit && (
        <EditPostModal
          post={post}
          raised={raised}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setShowEdit(false);
            applyUpdate(updated);
          }}
        />
      )}
      {showResolve && (
        <ResolveRescueModal
          post={post}
          onClose={() => setShowResolve(false)}
          onResolved={(updated) => {
            setShowResolve(false);
            applyUpdate(updated);
          }}
        />
      )}
      {showDonate && (
        <DonatePostModal
          post={{ ...post, assignedVolunteer }}
          user={user}
          raised={raised}
          onClose={() => setShowDonate(false)}
          onDonated={handleDonated}
        />
      )}
      {showReport && (
        <ReportPostModal
          postId={post.id}
          onClose={() => setShowReport(false)}
          onReported={() => {
            setShowReport(false);
            setReported(true);
          }}
        />
      )}
    </article>
  );
}
