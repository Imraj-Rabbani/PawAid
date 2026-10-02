import { useState } from "react";
import { Link } from "react-router-dom";

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

export default function PostCard({ post }) {
  const [expanded, setExpanded] = useState(false);

  const { creator, rescueArea, images } = post;
  const status = STATUS[post.status] || STATUS.OPEN;
  const isLong = post.description.length > LONG_DESCRIPTION;
  const shownImages = images.slice(0, MAX_IMAGES_SHOWN);
  const hiddenCount = images.length - shownImages.length;
  const progress = post.donationTarget
    ? Math.min(100, Math.round((post.donationReceived / post.donationTarget) * 100))
    : 0;

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
    </article>
  );
}
