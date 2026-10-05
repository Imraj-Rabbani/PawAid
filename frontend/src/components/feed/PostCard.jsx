import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import CommentSection from "./CommentSection";
import ReportPostModal from "./ReportPostModal";

const STATUS = {
  OPEN: { label: "Awaiting volunteer", className: "bg-yellow-100 text-yellow-700" },
  ASSIGNED: { label: "Assigned", className: "bg-blue-100 text-blue-700" },
  IN_PROGRESS: { label: "In progress", className: "bg-blue-100 text-blue-700" },
  RESOLVED: { label: "Rescued", className: "bg-green-100 text-green-700" },
  CLOSED: { label: "Closed", className: "bg-gray-100 text-gray-700" },
  CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-700" },
};

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

export default function PostCard({ post, user }) {
  const [expanded, setExpanded] = useState(false);
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
    ? Math.min(100, Math.round((post.donationReceived / post.donationTarget) * 100))
    : 0;

  const isOwnPost = user?.id === creator.id;

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

  const openReport = () => {
    if (!user) {
      navigate("/signin");
      return;
    }
    setShowReport(true);
  };

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-200">
      {/* ── Header ── */}
      <div className="flex items-start gap-3 p-4 sm:p-6 pb-0 sm:pb-0">
        <Link to={`/profile/${creator.id}`} className="shrink-0">
          <img
            src={creator.profilePictureUrl || "/default-avatar.png"}
            alt={creator.name}
            className="w-10 h-10 rounded-full object-cover ring-2 ring-gray-100"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            to={`/profile/${creator.id}`}
            className="font-semibold text-gray-900 hover:text-blue-700 truncate block"
          >
            {creator.name}
          </Link>
          <p className="text-xs text-gray-500">
            {timeAgo(post.createdAt)} · {rescueArea.name}
          </p>
        </div>
        <span
          className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {/* ── Body ── */}
      <div className="px-4 sm:px-6 py-4">
        <h3 className="font-semibold text-gray-900">{post.title}</h3>
        <p
          className={`mt-1 text-sm text-gray-700 whitespace-pre-wrap break-words ${
            isLong && !expanded ? "line-clamp-4" : ""
          }`}
        >
          {post.description}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {expanded ? "See less" : "See more"}
          </button>
        )}
      </div>

      {/* ── Volunteer ── */}
      {(assignedVolunteer || canAssign) && (
        <div className="mx-4 sm:mx-6 mb-4 flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50">
          {assignedVolunteer ? (
            <>
              <img
                src={assignedVolunteer.user.profilePictureUrl || "/default-avatar.png"}
                alt={assignedVolunteer.user.name}
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
              <p className="text-sm text-gray-700 min-w-0">
                <Link
                  to={`/volunteers/${assignedVolunteer.id}`}
                  className="font-semibold text-gray-900 hover:text-blue-700"
                >
                  {assignedVolunteer.user.name}
                </Link>{" "}
                is handling this rescue
              </p>
            </>
          ) : (
            <>
              <p className="flex-1 text-sm text-gray-700">No volunteer has taken this rescue yet.</p>
              <button
                onClick={assignToMe}
                disabled={assigning}
                className="shrink-0 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {assigning ? "Assigning..." : "Take this rescue"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Images ── */}
      {shownImages.length > 0 && (
        <div
          className={`grid gap-0.5 ${shownImages.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {shownImages.map((image, index) => (
            <a
              key={image.id}
              href={image.imageUrl}
              target="_blank"
              rel="noreferrer"
              className={`relative block bg-gray-100 ${
                shownImages.length === 3 && index === 0 ? "col-span-2" : ""
              }`}
            >
              <img
                src={image.imageUrl}
                alt={post.title}
                loading="lazy"
                className={`w-full object-cover ${
                  shownImages.length === 1 ? "max-h-[32rem]" : "h-56"
                }`}
              />
              {hiddenCount > 0 && index === shownImages.length - 1 && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-xl font-semibold">
                  +{hiddenCount}
                </span>
              )}
            </a>
          ))}
        </div>
      )}

      {/* ── Donation progress ── */}
      {post.donationTarget > 0 && (
        <div className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-900">
              ৳{post.donationReceived.toLocaleString()} raised
            </span>
            <span className="text-gray-500">
              of ৳{post.donationTarget.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="border-t border-gray-100 px-4 sm:px-6 py-2 flex items-center gap-1">
        <button
          onClick={toggleUpvote}
          aria-pressed={upvoted}
          className={`flex items-center gap-1.5 px-2 py-1 -ml-2 text-sm font-medium rounded-lg hover:bg-gray-50 ${
            upvoted ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-4 h-4"
            fill={upvoted ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          >
            <path d="M12 4l8 9h-5v7H9v-7H4z" />
          </svg>
          {upvoteCount > 0 ? upvoteCount : "Upvote"}
        </button>

        <button
          onClick={() => setShowComments((v) => !v)}
          className="px-2 py-1 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-50 hover:text-gray-900"
        >
          {commentCount === 0
            ? "Comment"
            : `${commentCount} ${commentCount === 1 ? "comment" : "comments"}`}
        </button>

        {!isOwnPost && (
          <button
            onClick={openReport}
            disabled={reported}
            className="ml-auto px-2 py-1 text-sm font-medium text-gray-500 rounded-lg hover:bg-gray-50 hover:text-red-600 disabled:hover:bg-transparent disabled:hover:text-gray-500"
          >
            {reported ? "Reported" : "Report"}
          </button>
        )}
      </div>
      {showComments && (
        <CommentSection
          postId={post.id}
          user={user}
          timeAgo={timeAgo}
          onCountChange={(delta) => setCommentCount((n) => n + delta)}
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
