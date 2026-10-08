import { useState, useEffect } from "react";
import api from "../services/api";
import Navbar from "../components/Navbar";
import CreatePost from "../components/feed/CreatePost";
import PostCard from "../components/feed/PostCard";
import ProfileSummaryCard from "../components/home/ProfileSummaryCard";
import CommunitySidebar from "../components/home/CommunitySidebar";

// value is sent to the backend as ?filter=
const FILTERS = [
  { value: "", label: "All Rescues" },
  { value: "open", label: "Needs a Volunteer" },
  { value: "fundraising", label: "Fundraising" },
  { value: "rescued", label: "Rescued" },
];

export default function Homepage() {
  const user = JSON.parse(localStorage.getItem("user") || "null");

  const [filter, setFilter] = useState("");
  const [posts, setPosts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await api.get("/home/summary");
        setSummary(res.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchSummary();
  }, []);

  useEffect(() => {
    // a slow response for an old filter must not overwrite the current one
    let ignore = false;

    const fetchPosts = async () => {
      try {
        const res = await api.get("/rescue-post", { params: { filter: filter || undefined } });
        if (ignore) return;
        setPosts(res.data.data);
        setNextCursor(res.data.nextCursor);
      } catch (err) {
        console.error(err);
        if (!ignore) setError(err.response?.data?.message || "Failed to load posts");
      } finally {
        if (!ignore) setLoading(false);
      }
    };
    fetchPosts();

    return () => {
      ignore = true;
    };
  }, [filter]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const res = await api.get("/rescue-post", {
        params: { cursor: nextCursor, filter: filter || undefined },
      });
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

  const changeFilter = (value) => {
    if (value === filter) return;
    setLoading(true);
    setError("");
    setFilter(value);
  };

  const handleCreated = (post) => {
    // a new post is open and unassigned, so it only belongs in these tabs
    if (filter === "" || filter === "open") setPosts((prev) => [post, ...prev]);
    setSummary((prev) =>
      prev?.me ? { ...prev, me: { ...prev.me, postCount: prev.me.postCount + 1 } } : prev
    );
  };

  const handleUpdated = (updated) => {
    setPosts((prev) => prev.map((post) => (post.id === updated.id ? updated : post)));
  };

  const handleDeleted = (postId) => {
    setPosts((prev) => prev.filter((post) => post.id !== postId));
    setSummary((prev) =>
      prev?.me ? { ...prev, me: { ...prev.me, postCount: Math.max(prev.me.postCount - 1, 0) } } : prev
    );
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6 items-start">
          {/* ── Left: who you are ── */}
          <aside className="col-span-12 lg:col-span-3 flex flex-col gap-5 lg:sticky lg:top-26 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto no-scrollbar lg:p-1 lg:-m-1">
            <ProfileSummaryCard user={user} me={summary?.me} />
          </aside>

          {/* ── Middle: the feed ── */}
          <main className="col-span-12 lg:col-span-6 flex flex-col gap-5">
            <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2 overflow-x-auto">
                {FILTERS.map((f) => {
                  const active = filter === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => changeFilter(f.value)}
                      aria-pressed={active}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] flex items-center gap-1 transition-colors ${
                        active
                          ? "bg-primary text-white font-semibold shadow-sm"
                          : "bg-surface-container-low text-on-surface-variant font-medium hover:bg-surface-container-high"
                      }`}
                    >
                      {active && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <CreatePost user={user} onCreated={handleCreated} />

            {loading ? (
              <p className="py-8 text-center text-on-surface-variant">Loading posts...</p>
            ) : error ? (
              <div className="p-4 bg-error-container border border-error/20 rounded-2xl">
                <p className="text-sm text-on-error-container">{error}</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 text-on-surface-variant">
                <p>
                  {filter
                    ? "No rescue posts match this filter."
                    : "No rescue posts yet. Be the first to post one."}
                </p>
              </div>
            ) : (
              <>
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    user={user}
                    onUpdated={handleUpdated}
                    onDeleted={handleDeleted}
                  />
                ))}

                {nextCursor && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="self-center px-4 py-2 text-sm font-semibold text-on-surface bg-surface-container-high rounded-xl hover:bg-surface-container-highest disabled:opacity-50 transition"
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </button>
                )}
              </>
            )}
          </main>

          {/* ── Right: community at a glance ── */}
          <aside className="col-span-12 lg:col-span-3 flex flex-col gap-5 lg:sticky lg:top-26 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto no-scrollbar lg:p-1 lg:-m-1">
            <CommunitySidebar summary={summary} user={user} />
          </aside>
        </div>
      </div>
    </div>
  );
}
