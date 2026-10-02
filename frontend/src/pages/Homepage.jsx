import { useState, useEffect } from "react";
import api from "../services/api";
import Navbar from "../components/Navbar";
import CreatePost from "../components/feed/CreatePost";
import PostCard from "../components/feed/PostCard";

export default function Homepage() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await api.get("/rescue-post");
        setPosts(res.data.data);
        setNextCursor(res.data.nextCursor);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || "Failed to load posts");
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const res = await api.get("/rescue-post", { params: { cursor: nextCursor } });
      // a post created since the last fetch can come back again, skip those
      setPosts((prev) => {
        const seen = new Set(prev.map((post) => post.id));
        return [...prev, ...res.data.data.filter((post) => !seen.has(post.id))];
      });
      setNextCursor(res.data.nextCursor);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to load more posts");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-4">
        <CreatePost
          user={user}
          onCreated={(post) => setPosts((prev) => [post, ...prev])}
        />

        {loading ? (
          <p className="py-8 text-center text-gray-500">Loading posts...</p>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p>No rescue posts yet. Be the first to post one.</p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}

            {nextCursor && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="self-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                {loadingMore ? "Loading..." : "Load more"}
              </button>
            )}
          </>
        )}
      </main>
    </div>
  );
}
