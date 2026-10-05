import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";

const MAX_COMMENT_LENGTH = 1000;

export default function CommentSection({ postId, user, timeAgo, onCountChange }) {
  // kept newest first, the same order the API pages through them
  const [comments, setComments] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await api.get(`/rescue-post/${postId}/comments`);
        setComments(res.data.data);
        setNextCursor(res.data.nextCursor);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load comments");
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, [postId]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const res = await api.get(`/rescue-post/${postId}/comments`, {
        params: { cursor: nextCursor },
      });
      // a comment added since the last fetch can come back again, skip those
      setComments((prev) => {
        const seen = new Set(prev.map((comment) => comment.id));
        return [...prev, ...res.data.data.filter((comment) => !seen.has(comment.id))];
      });
      setNextCursor(res.data.nextCursor);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to load more comments");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || posting) return;

    try {
      setPosting(true);
      const res = await api.post(`/rescue-post/${postId}/comments`, { text });
      setComments((prev) => [res.data.data, ...prev]);
      setText("");
      onCountChange(1);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.errors?.text?.[0] || err.response?.data?.message || "Failed to add comment");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (commentId) => {
    if (!confirm("Delete this comment?")) return;

    try {
      await api.delete(`/comments/${commentId}`);
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      onCountChange(-1);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to delete comment");
    }
  };

  // show oldest at the top, like a conversation
  const shown = [...comments].reverse();

  return (
    <div className="border-t border-gray-100 px-4 sm:px-6 py-4 flex flex-col gap-3">
      {loading ? (
        <p className="text-sm text-gray-500">Loading comments...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <>
          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="self-start text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "View earlier comments"}
            </button>
          )}

          {shown.length === 0 && (
            <p className="text-sm text-gray-400">No comments yet.</p>
          )}

          {shown.map((comment) => {
            const canDelete = user && (user.id === comment.author.id || user.role === "ADMIN");

            return (
              <div key={comment.id} className="flex items-start gap-2">
                <Link to={`/profile/${comment.author.id}`} className="shrink-0">
                  <img
                    src={comment.author.profilePictureUrl || "/default-avatar.png"}
                    alt={comment.author.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="inline-block max-w-full bg-gray-100 rounded-2xl px-3 py-2">
                    <Link
                      to={`/profile/${comment.author.id}`}
                      className="text-sm font-semibold text-gray-900 hover:text-blue-700"
                    >
                      {comment.author.name}
                    </Link>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                      {comment.text}
                    </p>
                  </div>
                  <div className="mt-0.5 px-3 flex items-center gap-3 text-xs text-gray-500">
                    <span>{timeAgo(comment.createdAt)}</span>
                    {canDelete && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="font-medium hover:text-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {user ? (
        <form onSubmit={handleSubmit} className="flex items-start gap-2">
          <img
            src={user.profilePictureUrl || "/default-avatar.png"}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover shrink-0"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter posts, Shift+Enter adds a new line
              if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
            }}
            placeholder="Write a comment..."
            maxLength={MAX_COMMENT_LENGTH}
            rows={1}
            className="flex-1 min-w-0 px-3 py-1.5 text-sm bg-gray-100 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={posting || !text.trim()}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {posting ? "Posting..." : "Post"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-gray-700">
          <Link to="/signin" className="font-semibold text-blue-600 hover:text-blue-700">
            Sign in
          </Link>{" "}
          to join the conversation.
        </p>
      )}
    </div>
  );
}
