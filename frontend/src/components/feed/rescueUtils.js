import { useState } from "react";
import api from "../../services/api";

// Shared by the feed card and the rescue page

export const STATUS = {
  OPEN: { label: "Awaiting Volunteer", className: "bg-error-container text-on-error-container" },
  ASSIGNED: { label: "Assigned", className: "bg-secondary-container text-on-secondary-container" },
  IN_PROGRESS: { label: "In Progress", className: "bg-secondary-container text-on-secondary-container" },
  RESOLVED: { label: "Rescued", className: "bg-secondary-container text-on-secondary-container" },
  CLOSED: { label: "Closed", className: "bg-surface-container-high text-on-surface-variant" },
  CANCELLED: { label: "Cancelled", className: "bg-surface-container-high text-on-surface-variant" },
};

// keep in sync with DONATABLE_STATUSES in backend/src/modules/donation/donation.controller.js
export const DONATABLE_STATUSES = ["OPEN", "ASSIGNED", "IN_PROGRESS"];
// keep in sync with UPDATABLE_STATUSES in backend/src/modules/rescue/rescue.controller.js
export const UPDATABLE_STATUSES = ["ASSIGNED", "IN_PROGRESS", "RESOLVED"];

export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export const fullTime = (date) =>
  new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

// Upvote state for one post: flips right away, then settles on the server's count.
// onSignedOut runs instead when there's nobody signed in.
export function useUpvote(post, user, onSignedOut) {
  const [upvoted, setUpvoted] = useState(Boolean(post.upvoted));
  const [count, setCount] = useState(post._count?.upvotes ?? 0);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!user) {
      onSignedOut();
      return;
    }
    if (busy) return;

    const next = !upvoted;
    setUpvoted(next);
    setCount((n) => n + (next ? 1 : -1));

    try {
      setBusy(true);
      const res = next
        ? await api.post(`/rescue-post/${post.id}/upvote`)
        : await api.delete(`/rescue-post/${post.id}/upvote`);
      setUpvoted(res.data.data.upvoted);
      setCount(res.data.data.upvoteCount);
    } catch (err) {
      console.error(err);
      setUpvoted(!next);
      setCount((n) => n + (next ? -1 : 1));
      alert(err.response?.data?.message || "Failed to update upvote");
    } finally {
      setBusy(false);
    }
  };

  return { upvoted, count, toggle };
}
