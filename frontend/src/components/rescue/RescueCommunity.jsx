import { useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon";
import useComments from "../feed/useComments";
import { timeAgo, fullTime } from "../feed/rescueUtils";

const MAX_COMMENT_LENGTH = 1000;

// The bottom of the rescue page: a box to comment and the rescue at a glance on
// one side, the conversation (newest first) on the other.
export default function RescueCommunity({ post, user, stats }) {
  const [commentCount, setCommentCount] = useState(post._count?.comments ?? 0);
  const { comments, nextCursor, loading, loadingMore, error, posting, loadMore, addComment, deleteComment } =
    useComments(post.id, (delta) => setCommentCount((n) => n + delta));
  const [text, setText] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (await addComment(text)) setText("");
  };

  // label the people the conversation is about
  const roleOf = (author) => {
    if (author.id === post.assignedVolunteer?.user.id) return { label: "Rescue volunteer", tone: "bg-secondary-fixed text-on-secondary-container" };
    if (author.id === post.creator.id) return { label: "Posted this rescue", tone: "bg-primary-fixed text-on-primary-fixed" };
    return null;
  };

  return (
    <section className="mt-10 pt-6 border-t border-surface-container-high/60 flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Icon name="forum" className="text-[24px] text-primary" />
          <h2 className="font-display text-2xl sm:text-[28px] font-bold text-on-surface">Community</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface text-[11px] font-bold">
            {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </span>
        </div>
        <p className="mt-1 text-[15px] text-on-surface-variant">
          Questions, offers of help and encouragement for the people on this rescue.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* composer + stats: below the thread on mobile, beside it on desktop */}
        <div className="lg:col-span-4 order-2 lg:order-1 flex flex-col gap-3">
          <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-on-surface">
              <Icon name="favorite_border" className="text-[18px] text-primary" />
              Join the conversation
            </h3>
            {user ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <img src={user.profilePictureUrl || "/default-avatar.png"} alt="" className="w-7 h-7 rounded-full object-cover" />
                  <span className="text-[11px] text-on-surface-variant">
                    Posting as <strong className="text-on-surface">{user.name}</strong>
                  </span>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  maxLength={MAX_COMMENT_LENGTH}
                  rows={3}
                  placeholder="Ask a question, offer help, or send some encouragement..."
                  className="w-full p-3 bg-surface-container-low rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <button
                  type="submit"
                  disabled={posting || !text.trim()}
                  className="self-end py-2 px-4 rounded-xl bg-secondary text-white text-sm font-bold shadow-sm hover:opacity-90 disabled:opacity-50"
                >
                  {posting ? "Posting..." : "Post Comment"}
                </button>
              </form>
            ) : (
              <p className="text-sm text-on-surface-variant">
                <Link to="/signin" className="font-semibold text-primary hover:underline">
                  Sign in
                </Link>{" "}
                to join the conversation.
              </p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-surface-container-lowest shadow-sm flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-wider text-on-surface-variant font-bold">This rescue at a glance</span>
            {stats.map(({ label, value, accent }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-[13px] text-on-surface-variant">{label}</span>
                <span className={`text-xs font-bold ${accent ? "text-secondary" : "text-on-surface"}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-8 order-1 lg:order-2 flex flex-col gap-3">
          {loading ? (
            <p className="text-sm text-on-surface-variant">Loading comments...</p>
          ) : error ? (
            <p className="text-sm text-error">{error}</p>
          ) : comments.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-2xl p-8 shadow-sm text-center">
              <Icon name="chat_bubble" className="text-[36px] text-on-surface-variant/40" />
              <p className="mt-2 text-sm text-on-surface-variant">No comments yet. Be the first to say something.</p>
            </div>
          ) : (
            comments.map((comment) => {
              const role = roleOf(comment.author);
              const canDelete = user && (user.id === comment.author.id || user.role === "ADMIN");

              return (
                <article key={comment.id} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <Link to={`/profile/${comment.author.id}`} className="shrink-0">
                      <img
                        src={comment.author.profilePictureUrl || "/default-avatar.png"}
                        alt={comment.author.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    </Link>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link to={`/profile/${comment.author.id}`} className="text-sm font-bold text-on-surface hover:text-primary">
                          {comment.author.name}
                        </Link>
                        {role && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${role.tone}`}>{role.label}</span>}
                      </div>
                      <time dateTime={comment.createdAt} title={fullTime(comment.createdAt)} className="text-[11px] text-on-surface-variant">
                        {timeAgo(comment.createdAt)}
                      </time>
                    </div>
                  </div>
                  <p className="text-[15px] text-on-surface whitespace-pre-wrap wrap-break-word">{comment.text}</p>
                  {canDelete && (
                    <div className="pt-2 border-t border-surface-container-high/40">
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-on-surface-variant hover:text-error"
                      >
                        <Icon name="delete" className="text-[16px]" />
                        Delete
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}

          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold transition disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load older comments"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
