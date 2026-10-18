import { useState, useEffect } from "react";
import api from "../../services/api";

// A post's comments, newest first (the order the API pages through them), and
// the actions on them. Shared by the feed's comment box and the rescue page.
export default function useComments(postId, onCountChange) {
  const [comments, setComments] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
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

  // resolves true once posted, so the form knows to clear itself
  const addComment = async (text) => {
    if (!text.trim() || posting) return false;

    try {
      setPosting(true);
      const res = await api.post(`/rescue-post/${postId}/comments`, { text });
      setComments((prev) => [res.data.data, ...prev]);
      onCountChange?.(1);
      return true;
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.errors?.text?.[0] || err.response?.data?.message || "Failed to add comment");
      return false;
    } finally {
      setPosting(false);
    }
  };

  const deleteComment = async (commentId) => {
    if (!confirm("Delete this comment?")) return;

    try {
      await api.delete(`/comments/${commentId}`);
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      onCountChange?.(-1);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to delete comment");
    }
  };

  return { comments, nextCursor, loading, loadingMore, error, posting, loadMore, addComment, deleteComment };
}
