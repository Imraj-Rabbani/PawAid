import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Icon from "../Icon";
import ImageLightbox from "./ImageLightbox";

const MAX_IMAGES = 4; // same as the route's upload.array limit
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB, same as the backend limit
const MAX_NOTE_LENGTH = 1000;

const fullTime = (date) =>
  new Date(date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

// The rescue's timeline of updates, oldest at the top and newest at the bottom.
// The volunteer handling it (canPost) gets a box below them to post a note and photos.
export default function RescueUpdates({ postId, canPost, focusComposer, timeAgo, onCountChange }) {
  // kept newest first, the same order the API pages through them
  const [updates, setUpdates] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState(null); // { images, index }
  const closeLightbox = useCallback(() => setLightbox(null), []);

  useEffect(() => {
    let ignore = false;

    api
      .get(`/rescue-post/${postId}/updates`)
      .then((res) => {
        if (ignore) return;
        setUpdates(res.data.data);
        setNextCursor(res.data.nextCursor);
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) setError(err.response?.data?.message || "Failed to load updates");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [postId]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const res = await api.get(`/rescue-post/${postId}/updates`, { params: { cursor: nextCursor } });
      // an update posted since the last fetch can come back again, skip those
      setUpdates((prev) => {
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...res.data.data.filter((u) => !seen.has(u.id))];
      });
      setNextCursor(res.data.nextCursor);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to load older updates");
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePosted = (update) => {
    setUpdates((prev) => [update, ...prev]);
    onCountChange(1);
  };

  // show oldest at the top, so the story reads down to the latest
  const shown = [...updates].reverse();

  return (
    <div className="border-t border-surface-container-high px-4 sm:px-6 py-4 flex flex-col gap-4">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-on-surface-variant">
        <Icon name="campaign" className="text-[16px] text-secondary" />
        Rescue updates
      </p>

      {nextCursor && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="self-start text-sm font-semibold text-on-surface-variant hover:text-on-surface disabled:opacity-50"
        >
          {loadingMore ? "Loading..." : "View earlier updates"}
        </button>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant">Loading updates...</p>
      ) : error ? (
        <p className="text-sm text-error">{error}</p>
      ) : updates.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          {canPost ? "No updates yet. Let supporters know how the rescue is going." : "The volunteer hasn't posted any updates yet."}
        </p>
      ) : (
        <ol className="flex flex-col">
          {shown.map((update, i) => (
            <UpdateItem
              key={update.id}
              update={update}
              last={i === shown.length - 1}
              timeAgo={timeAgo}
              onOpenImage={(index) => setLightbox({ images: update.images, index })}
            />
          ))}
        </ol>
      )}

      {canPost && <UpdateComposer postId={postId} autoFocus={focusComposer} onPosted={handlePosted} />}

      {lightbox && (
        <ImageLightbox images={lightbox.images} startIndex={lightbox.index} alt="Rescue update photo" onClose={closeLightbox} />
      )}
    </div>
  );
}

// one entry on the timeline: a dot and line on the left, the update on the right
function UpdateItem({ update, last, timeAgo, onOpenImage }) {
  const { volunteer } = update;

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-secondary ring-4 ring-secondary-container shrink-0" />
        {!last && <span className="w-0.5 flex-1 bg-surface-container-high my-1" />}
      </div>

      <div className={`min-w-0 flex-1 ${last ? "" : "pb-5"}`}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link
            to={`/volunteers/${volunteer.id}`}
            className="flex items-center gap-1.5 text-sm font-semibold text-on-surface hover:text-secondary"
          >
            <img
              src={volunteer.user.profilePictureUrl || "/default-avatar.png"}
              alt=""
              className="w-5 h-5 rounded-full object-cover"
            />
            {volunteer.user.name}
          </Link>
          <time dateTime={update.createdAt} title={fullTime(update.createdAt)} className="text-xs text-on-surface-variant">
            {fullTime(update.createdAt)} · {timeAgo(update.createdAt)}
          </time>
        </div>

        {update.note && (
          <p className="mt-1.5 text-[15px] text-on-surface whitespace-pre-wrap wrap-break-word">{update.note}</p>
        )}

        {update.images.length > 0 && (
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {update.images.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => onOpenImage(index)}
                aria-label={`View photo ${index + 1} of ${update.images.length}`}
                className="block rounded-lg overflow-hidden bg-surface-container-high cursor-zoom-in"
              >
                <img src={image.imageUrl} alt="" loading="lazy" className="w-full h-24 object-cover hover:scale-[1.03] transition-transform" />
              </button>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

function UpdateComposer({ postId, autoFocus, onPosted }) {
  const [note, setNote] = useState("");
  const [images, setImages] = useState([]); // [{ file, url }]
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files);
    e.target.value = "";

    if (selected.some((file) => file.size > MAX_IMAGE_SIZE)) {
      setError("Each photo must be 5MB or smaller.");
      return;
    }
    if (images.length + selected.length > MAX_IMAGES) {
      setError(`You can add up to ${MAX_IMAGES} photos.`);
      return;
    }

    setError("");
    setImages((prev) => [...prev, ...selected.map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const removeImage = (url) => {
    URL.revokeObjectURL(url);
    setImages((prev) => prev.filter((image) => image.url !== url));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (posting || (!note.trim() && images.length === 0)) return;

    const formData = new FormData();
    formData.append("note", note);
    images.forEach((image) => formData.append("images", image.file));

    try {
      setPosting(true);
      setError("");
      const res = await api.post(`/rescue-post/${postId}/updates`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      images.forEach((image) => URL.revokeObjectURL(image.url));
      setImages([]);
      setNote("");
      onPosted(res.data.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.errors?.note?.[0] || err.response?.data?.message || "Failed to post update");
    } finally {
      setPosting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-3 rounded-xl bg-surface-container-low">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        autoFocus={autoFocus}
        maxLength={MAX_NOTE_LENGTH}
        rows={3}
        placeholder="How is the rescue going? Vet visits, recovery, where the animal is now..."
        className="w-full px-3 py-2 text-sm bg-surface-container-lowest text-on-surface rounded-xl border border-transparent resize-y focus:outline-none focus:border-primary"
      />

      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {images.map((image) => (
            <div key={image.url} className="relative">
              <img src={image.url} alt="Selected" className="w-full h-16 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => removeImage(image.url)}
                aria-label="Remove photo"
                className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white text-xs hover:bg-black/80"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-error">{error}</p>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-on-surface-variant bg-surface-container-lowest rounded-xl hover:bg-surface-container-high cursor-pointer ${
            images.length >= MAX_IMAGES ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          <Icon name="photo_camera" className="text-[18px]" />
          Add Photos ({images.length}/{MAX_IMAGES})
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFiles}
            disabled={images.length >= MAX_IMAGES}
            className="hidden"
          />
        </label>
        <button
          type="submit"
          disabled={posting || (!note.trim() && images.length === 0)}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-white bg-secondary rounded-xl hover:opacity-90 shadow-sm disabled:opacity-50"
        >
          <Icon name="send" className="text-[16px]" />
          {posting ? "Posting..." : "Post Update"}
        </button>
      </div>
    </form>
  );
}
