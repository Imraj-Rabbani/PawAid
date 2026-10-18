import { useState } from "react";
import { Link } from "react-router-dom";
import useComments from "./useComments";

const MAX_COMMENT_LENGTH = 1000;

export default function CommentSection({ postId, user, timeAgo, onCountChange }) {
  const { comments, nextCursor, loading, loadingMore, error, posting, loadMore, addComment, deleteComment } =
    useComments(postId, onCountChange);
  const [text, setText] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (await addComment(text)) setText("");
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
                    <p className="text-sm text-gray-700 whitespace-pre-wrap wrap-break-word">
                      {comment.text}
                    </p>
                  </div>
                  <div className="mt-0.5 px-3 flex items-center gap-3 text-xs text-gray-500">
                    <span>{timeAgo(comment.createdAt)}</span>
                    {canDelete && (
                      <button
                        onClick={() => deleteComment(comment.id)}
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
