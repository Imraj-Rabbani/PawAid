import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import Icon from "../Icon";
import { IMAGE_ACCEPT, IMAGE_TYPE_ERROR, isAllowedImage } from "../../services/images";
import ImageLightbox from "./ImageLightbox";
import { fullTime } from "./rescueUtils";

const MAX_IMAGES = 4; // same as the route's upload.array limit
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB, same as the backend limit
const MAX_NOTE_LENGTH = 1000;

// the timeline's dots cycle through the palette, like the design's case notes
const DOTS = [
  "bg-primary ring-primary-fixed",
  "bg-secondary ring-secondary-fixed",
  "bg-tertiary ring-tertiary-fixed",
];

// The rescue's timeline of updates, oldest at the top and newest at the bottom.
// The volunteer handling it (canPost) gets a box below them to post a note and photos;
// each time focusSignal goes up, that box takes focus.
export default function RescueUpdates({ postId, canPost, focusSignal = 0, timeAgo, onCountChange }) {
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
    onCountChange?.(1);
  };

  // show oldest at the top, so the story reads down to the latest
  const shown = [...updates].reverse();

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-surface-container-high/60">
        <div className="flex items-center gap-2">
          <Icon name="campaign" className="text-[24px] text-primary" />
          <h2 className="font-display text-xl font-semibold text-on-surface">Rescue Updates</h2>
        </div>
        {updates.length > 0 && (
          <span className="text-xs text-on-surface-variant">
            Latest {timeAgo(updates[0].createdAt).toLowerCase()}
          </span>
        )}
      </div>

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
        <ol className="relative pl-6 flex flex-col gap-6 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container-high">
          {shown.map((update, i) => (
            <UpdateItem
              key={update.id}
              update={update}
              dot={DOTS[i % DOTS.length]}
              timeAgo={timeAgo}
              onOpenImage={(index) => setLightbox({ images: update.images, index })}
            />
          ))}
        </ol>
      )}

      {canPost && <UpdateComposer postId={postId} focusSignal={focusSignal} onPosted={handlePosted} />}

      {lightbox && (
        <ImageLightbox images={lightbox.images} startIndex={lightbox.index} alt="Rescue update photo" onClose={closeLightbox} />
      )}
    </div>
  );
}

// one entry on the timeline: a dot on the line, then who posted it and what they said
function UpdateItem({ update, dot, timeAgo, onOpenImage }) {
  const { volunteer } = update;

  return (
    <li className="relative">
      <span className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full ring-4 ${dot}`} />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <time dateTime={update.createdAt} title={fullTime(update.createdAt)} className="text-sm font-bold text-on-surface">
          {fullTime(update.createdAt)}
        </time>
        <Link
          to={`/volunteers/${volunteer.id}`}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-low text-[11px] font-semibold text-on-surface-variant hover:text-secondary"
        >
          <img src={volunteer.user.profilePictureUrl || "/default-avatar.png"} alt="" className="w-4 h-4 rounded-full object-cover" />
          {volunteer.user.name}
        </Link>
        <span className="text-xs text-on-surface-variant">{timeAgo(update.createdAt)}</span>
      </div>

      {update.note && (
        <p className="mt-1.5 text-[15px] leading-relaxed text-on-surface-variant whitespace-pre-wrap wrap-break-word">{update.note}</p>
      )}

      {update.images.length > 0 && (
        <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
          {update.images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => onOpenImage(index)}
              aria-label={`View photo ${index + 1} of ${update.images.length}`}
              className="block rounded-xl overflow-hidden bg-surface-container-high cursor-zoom-in shadow-sm"
            >
              <img src={image.imageUrl} alt="" loading="lazy" className="w-full h-24 object-cover hover:scale-[1.03] transition-transform" />
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function UpdateComposer({ postId, focusSignal, onPosted }) {
  const noteRef = useRef(null);
  const [note, setNote] = useState("");
  const [images, setImages] = useState([]); // [{ file, url }]
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (focusSignal) noteRef.current?.focus({ preventScroll: true });
  }, [focusSignal]);

  const handleFiles = (e) => {
    const selected = Array.from(e.target.files);
    e.target.value = "";

    if (!selected.every(isAllowedImage)) {
      setError(IMAGE_TYPE_ERROR);
      return;
    }
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-4 rounded-xl bg-surface-container-low">
      <p className="text-sm font-bold text-on-surface">Post an update</p>
      <textarea
        value={note}
        ref={noteRef}
        onChange={(e) => setNote(e.target.value)}
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
            accept={IMAGE_ACCEPT}
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
