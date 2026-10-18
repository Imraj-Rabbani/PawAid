import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Icon from "../components/Icon";
import RescueUpdates from "../components/feed/RescueUpdates";
import RescueExpenses from "../components/feed/RescueExpenses";
import EditPostModal from "../components/feed/EditPostModal";
import ReportPostModal from "../components/feed/ReportPostModal";
import PhotoGallery from "../components/rescue/PhotoGallery";
import DonationCard from "../components/rescue/DonationCard";
import VolunteerCard from "../components/rescue/VolunteerCard";
import RescueCommunity from "../components/rescue/RescueCommunity";
import { STATUS, UPDATABLE_STATUSES, timeAgo, fullTime, useUpvote } from "../components/feed/rescueUtils";

const caseNumber = (id) => id.slice(0, 8).toUpperCase();

// what the big photo says about where the rescue stands
function statusText(post) {
  const name = post.assignedVolunteer?.user.name;
  switch (post.status) {
    case "OPEN":
      return "Waiting for a volunteer to take this rescue on.";
    case "ASSIGNED":
      return `${name} has taken this rescue on.`;
    case "IN_PROGRESS":
      return `${name} is on the rescue right now.`;
    case "RESOLVED":
      return "This animal has been rescued.";
    default:
      return "This rescue is closed.";
  }
}

// A rescue's own page. Left: the story, photos, the volunteer's updates and where
// the money went. Right (sticky): donating, and the volunteer and their tools.
// Below: the comments.
export default function RescuePostPage() {
  const { postId } = useParams();
  const [result, setResult] = useState({ id: null, post: null, error: "" });

  const load = useCallback(
    (ignore = { current: false }) =>
      api
        .get(`/rescue-post/${postId}`)
        .then((res) => {
          if (!ignore.current) setResult({ id: postId, post: res.data.data, error: "" });
        })
        .catch((err) => {
          console.error(err);
          if (!ignore.current) {
            setResult({
              id: postId,
              post: null,
              error: err.response?.status === 404 ? "notFound" : err.response?.data?.message || "Failed to load rescue",
            });
          }
        }),
    [postId]
  );

  useEffect(() => {
    const ignore = { current: false };
    load(ignore);
    return () => {
      ignore.current = true;
    };
  }, [load]);

  const loading = result.id !== postId;
  const { post, error } = result;

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />
      {/* a thin accent line under the navbar, like the design */}
      <div className="w-full h-1.5 bg-linear-to-r from-primary via-tertiary to-secondary" />

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-6">
        {loading ? (
          <p className="py-16 text-center text-on-surface-variant">Loading rescue...</p>
        ) : error === "notFound" ? (
          <div className="mt-6 py-16 text-center bg-surface-container-lowest rounded-2xl">
            <Icon name="search_off" className="text-[48px] text-on-surface-variant/40" />
            <p className="mt-3 font-semibold text-on-surface">This rescue isn't available</p>
            <p className="mt-1 text-sm text-on-surface-variant">It may have been removed.</p>
            <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
              Back to rescues
            </Link>
          </div>
        ) : error ? (
          <div className="mt-6 p-4 bg-error-container border border-error/20 rounded-2xl">
            <p className="text-sm text-on-error-container">{error}</p>
          </div>
        ) : (
          <RescueDetails
            key={post.id}
            post={post}
            onChange={(updated) => setResult((prev) => ({ ...prev, post: { ...prev.post, ...updated } }))}
            onReload={() => load()}
          />
        )}
      </main>
    </div>
  );
}

function RescueDetails({ post, onChange, onReload }) {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  // bumped to focus a form after the volunteer clicks Post Update / Log Expense
  const [focus, setFocus] = useState({ update: 0, expense: 0 });
  const [showEdit, setShowEdit] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reported, setReported] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const { upvoted, count: upvoteCount, toggle: toggleUpvote } = useUpvote(post, user, () => navigate("/signin"));
  const updatesRef = useRef(null);
  const expensesRef = useRef(null);

  const { creator, rescueArea, assignedVolunteer } = post;
  const status = STATUS[post.status] || STATUS.OPEN;
  const isOwnPost = user?.id === creator.id;
  const handlingIt = assignedVolunteer && assignedVolunteer.user.id === user?.id;
  // the server re-checks they're the active volunteer on it
  const canWrite = handlingIt && UPDATABLE_STATUSES.includes(post.status);
  // creators can change their post until a volunteer takes it on
  const canEdit = isOwnPost && post.status === "OPEN" && !assignedVolunteer;
  // nothing to follow until a volunteer takes the rescue on
  const showProgress = assignedVolunteer || post._count?.updates > 0 || post._count?.expenses > 0;

  const handleCompose = (kind) => {
    const section = kind === "update" ? updatesRef : expensesRef;
    section.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFocus((prev) => ({ ...prev, [kind]: prev[kind] + 1 }));
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this link to share the rescue:", window.location.href);
    }
  };

  const deletePost = async () => {
    if (!confirm("Delete this rescue post? This can't be undone.")) return;

    try {
      setDeleting(true);
      await api.delete(`/rescue-post/${post.id}`);
      navigate("/");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to delete post");
      setDeleting(false);
    }
  };

  const openReport = () => {
    if (!user) {
      navigate("/signin");
      return;
    }
    setShowReport(true);
  };

  const stats = [
    { label: "Upvotes", value: upvoteCount.toLocaleString() },
    { label: "Donors", value: (post.donorCount ?? 0).toLocaleString() },
    { label: "Updates from the volunteer", value: (post._count?.updates ?? 0).toLocaleString() },
    { label: "Expenses recorded", value: (post._count?.expenses ?? 0).toLocaleString(), accent: true },
  ];

  return (
    <>
      {/* breadcrumb + case details */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 min-w-0 text-xs font-semibold text-on-surface-variant">
          <Link to="/" className="flex items-center gap-1 hover:text-primary transition-colors shrink-0">
            <Icon name="home" className="text-[16px]" />
            Community
          </Link>
          <span className="text-outline-variant">/</span>
          <span className="shrink-0">{rescueArea.name}</span>
          <span className="text-outline-variant">/</span>
          <span className="flex items-center gap-1.5 min-w-0 text-on-surface">
            <span className={`w-2 h-2 rounded-full shrink-0 ${post.status === "OPEN" ? "bg-primary animate-pulse" : "bg-secondary"}`} />
            <span className="truncate">Case #{caseNumber(post.id)}</span>
          </span>
        </nav>
        <button
          type="button"
          onClick={share}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-surface-container-low text-on-surface hover:bg-surface-container transition-colors text-xs font-semibold"
        >
          <Icon name={copied ? "check" : "share"} className="text-[16px] text-secondary" />
          {copied ? "Link copied" : "Share Rescue"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: the story */}
        <section className="lg:col-span-7 flex flex-col gap-6 min-w-0">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide shadow-sm ${status.className}`}>
                <Icon name={post.status === "OPEN" ? "emergency" : "check_circle"} className="text-[14px]" />
                {status.label}
              </span>
              {post.donationTarget > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-[11px] font-semibold">
                  <Icon name="volunteer_activism" className="text-[14px]" />
                  Raising ৳{post.donationTarget.toLocaleString()}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant text-[11px]">
                <Icon name="location_on" className="text-[14px] text-tertiary" />
                {rescueArea.name}
              </span>
            </div>

            <h1 className="mt-1 font-display text-2xl sm:text-[32px] sm:leading-10 font-bold tracking-tight text-on-surface wrap-break-word">
              {post.title}
            </h1>

            <Link to={`/profile/${creator.id}`} className="self-start flex items-center gap-2 text-sm text-on-surface-variant hover:text-on-surface">
              <img src={creator.profilePictureUrl || "/default-avatar.png"} alt="" className="w-6 h-6 rounded-full object-cover" />
              <span>
                Posted by <span className="font-semibold text-on-surface">{creator.name}</span>
                {creator.role === "VOLUNTEER" && <Icon name="verified" filled className="ml-0.5 text-[14px] text-secondary align-[-2px]" />}
              </span>
              <span>·</span>
              <time dateTime={post.createdAt} title={fullTime(post.createdAt)}>
                {timeAgo(post.createdAt)}
              </time>
            </Link>

            <p className="mt-1 text-[15px] leading-relaxed text-on-surface-variant whitespace-pre-wrap wrap-break-word">
              {post.description}
            </p>
          </div>

          <PhotoGallery images={post.images} title={post.title} statusText={statusText(post)} />

          {post.status === "RESOLVED" && (post.rescueNote || post.rescuePhotoUrl) && (
            <div className="bg-secondary-container/40 rounded-2xl p-5 sm:p-6 flex flex-col gap-3">
              <p className="flex items-center gap-2 font-display text-lg font-semibold text-on-surface">
                <Icon name="celebration" className="text-[22px] text-secondary" />
                Rescued!
                {post.resolvedAt && <span className="text-xs font-medium font-sans text-on-surface-variant">{timeAgo(post.resolvedAt)}</span>}
              </p>
              {post.rescueNote && <p className="text-[15px] text-on-surface whitespace-pre-wrap wrap-break-word">{post.rescueNote}</p>}
              {post.rescuePhotoUrl && (
                <img src={post.rescuePhotoUrl} alt={`${post.title} after the rescue`} loading="lazy" className="w-full max-h-96 object-cover rounded-xl" />
              )}
            </div>
          )}

          {showProgress && (
            <>
              <div ref={updatesRef} className="scroll-mt-24">
                <RescueUpdates postId={post.id} canPost={canWrite} focusSignal={focus.update} timeAgo={timeAgo} />
              </div>
              <div ref={expensesRef} className="scroll-mt-24">
                <RescueExpenses
                  postId={post.id}
                  raised={post.donationReceived}
                  canRecord={canWrite}
                  user={user}
                  focusSignal={focus.expense}
                  timeAgo={timeAgo}
                />
              </div>
            </>
          )}
        </section>

        {/* RIGHT: donating and the volunteer, kept in view */}
        <aside className="lg:col-span-5 flex flex-col gap-4 lg:sticky lg:top-24">
          <DonationCard post={post} user={user} onDonated={onReload} />
          <VolunteerCard post={post} user={user} onUpdated={onChange} onCompose={handleCompose} />

          <div className="p-3 rounded-2xl bg-surface-container-low flex flex-wrap items-center gap-1 text-xs font-semibold text-on-surface-variant">
            <button
              onClick={toggleUpvote}
              aria-pressed={upvoted}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-surface-container transition ${upvoted ? "text-primary" : "hover:text-on-surface"}`}
            >
              <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill={upvoted ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 4l8 9h-5v7H9v-7H4z" />
              </svg>
              {upvoted ? "Upvoted" : "Upvote"} · {upvoteCount}
            </button>
            {canEdit && (
              <>
                <button onClick={() => setShowEdit(true)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-surface-container hover:text-on-surface transition">
                  <Icon name="edit" className="text-[16px]" />
                  Edit
                </button>
                <button
                  onClick={deletePost}
                  disabled={deleting}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-surface-container hover:text-error transition disabled:opacity-50"
                >
                  <Icon name="delete" className="text-[16px]" />
                  Delete
                </button>
              </>
            )}
            {!isOwnPost && (
              <button
                onClick={openReport}
                disabled={reported}
                className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg hover:bg-surface-container hover:text-error transition disabled:hover:bg-transparent disabled:hover:text-on-surface-variant"
              >
                <Icon name="flag" filled={reported} className="text-[16px]" />
                {reported ? "Reported" : "Report"}
              </button>
            )}
          </div>
        </aside>
      </div>

      <RescueCommunity post={post} user={user} stats={stats} />

      {showEdit && (
        <EditPostModal
          post={post}
          raised={post.donationReceived}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setShowEdit(false);
            onChange(updated);
          }}
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
    </>
  );
}
