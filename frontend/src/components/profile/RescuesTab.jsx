import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import PostCard from "../feed/PostCard";

// posted: rescue posts the user created; handling: rescues they took on as a volunteer
const VIEWS = [
  { value: "posted", label: "Posted" },
  { value: "handling", label: "Handling" },
];

export default function RescuesTab({ isVolunteer }) {
  // the signed in user, as the feed passes it to PostCard
  const currentUser = JSON.parse(localStorage.getItem("user") || "null");
  const [view, setView] = useState("posted");
  const [result, setResult] = useState({ key: null, posts: [], counts: null, nextCursor: null, error: "" });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let ignore = false;

    api
      .get("/rescue-post/mine", { params: { view } })
      .then((res) => {
        if (ignore) return;
        setResult({ key: view, posts: res.data.data, counts: res.data.counts, nextCursor: res.data.nextCursor, error: "" });
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) {
          setResult((prev) => ({ ...prev, key: view, error: err.response?.data?.message || "Failed to load your rescues" }));
        }
      });

    return () => {
      ignore = true;
    };
  }, [view]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const res = await api.get("/rescue-post/mine", { params: { view, cursor: result.nextCursor } });
      setResult((prev) => {
        const seen = new Set(prev.posts.map((p) => p.id));
        return {
          ...prev,
          posts: [...prev.posts, ...res.data.data.filter((p) => !seen.has(p.id))],
          nextCursor: res.data.nextCursor,
        };
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleUpdated = (updated) =>
    setResult((prev) => ({ ...prev, posts: prev.posts.map((p) => (p.id === updated.id ? updated : p)) }));

  const handleDeleted = (postId) =>
    setResult((prev) => ({
      ...prev,
      posts: prev.posts.filter((p) => p.id !== postId),
      counts: { ...prev.counts, [view]: Math.max(prev.counts[view] - 1, 0) },
    }));

  const { posts, counts, nextCursor, error } = result;
  const loading = result.key !== view;

  if (result.key === null) return <p className="text-gray-500">Loading rescues...</p>;

  if (error && !counts) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Rescues</h2>
        {/* only volunteers take on rescues */}
        {isVolunteer && (
          <div className="inline-flex rounded-lg border border-gray-200 p-1 bg-gray-50">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                onClick={() => setView(v.value)}
                aria-pressed={view === v.value}
                className={`px-3 py-1.5 text-sm rounded-md transition ${
                  view === v.value ? "bg-white shadow-sm text-blue-700 font-medium" : "text-gray-600"
                }`}
              >
                {v.label} ({counts[v.value]})
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {view === "posted" ? (
            <>
              <p>You haven't posted a rescue yet.</p>
              <Link to="/" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
                Report an animal in need
              </Link>
            </>
          ) : (
            <>
              <p>You aren't handling any rescues yet.</p>
              <Link to="/" className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline">
                Find rescues awaiting a volunteer
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} user={currentUser} onUpdated={handleUpdated} onDeleted={handleDeleted} />
          ))}
          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore || loading}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
