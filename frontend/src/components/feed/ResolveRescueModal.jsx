import { useState, useEffect } from "react";
import api from "../../services/api";
import Icon from "../Icon";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB, same as the backend limit

// The assigned volunteer marks their rescue as rescued, with an optional closing
// note and photo shown on the post
export default function ResolveRescueModal({ post, onClose, onResolved }) {
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState(null); // { file, url }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // free the preview when it changes or the modal closes
  useEffect(() => () => photo && URL.revokeObjectURL(photo.url), [photo]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_IMAGE_SIZE) {
      setError("The photo must be 5MB or smaller.");
      return;
    }
    setError("");
    setPhoto({ file, url: URL.createObjectURL(file) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData();
    formData.append("status", "RESOLVED");
    if (note.trim()) formData.append("note", note.trim());
    if (photo) formData.append("photo", photo.file);

    try {
      setSaving(true);
      setError("");
      const res = await api.patch(`/rescue-post/${post.id}/progress`, formData);
      onResolved(res.data.data);
    } catch (err) {
      console.error(err);
      const fieldErrors = Object.values(err.response?.data?.errors || {}).flat();
      setError(fieldErrors[0] || err.response?.data?.message || "Failed to update rescue");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 animate-fade-in"
      onClick={() => !saving && onClose()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolve-rescue-title"
        className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-surface-container-lowest rounded-2xl shadow-lg p-6 flex flex-col gap-4 animate-pop-in"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="resolve-rescue-title" className="font-display text-lg font-bold text-on-surface">
              Mark as rescued
            </h2>
            <p className="text-sm text-on-surface-variant truncate">{post.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="p-1 -m-1 rounded-full text-on-surface-variant hover:bg-surface-container-high"
          >
            <Icon name="close" className="text-[22px]" />
          </button>
        </div>

        <p className="text-sm text-on-surface-variant">
          Let supporters know how it went. Both fields are optional. This can't be undone.
        </p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="e.g. She's safe at the shelter, eating well and getting treatment."
          aria-label="Rescue update"
          className="w-full px-3 py-2 text-sm bg-surface-container-low text-on-surface rounded-xl border border-transparent resize-none focus:outline-none focus:ring-2 focus:ring-primary-container"
        />

        {photo ? (
          <div className="relative">
            <img src={photo.url} alt="Rescue update" className="w-full max-h-64 object-cover rounded-xl" />
            <button
              type="button"
              onClick={() => setPhoto(null)}
              aria-label="Remove photo"
              className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <Icon name="close" className="text-[18px]" />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 px-3 py-6 rounded-xl border-2 border-dashed border-outline-variant text-sm font-semibold text-on-surface-variant cursor-pointer hover:bg-surface-container-low">
            <Icon name="add_a_photo" className="text-[20px]" />
            Add a photo
            <input type="file" accept="image/*" onChange={handleFile} className="sr-only" />
          </label>
        )}

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-semibold text-on-surface bg-surface-container-high rounded-xl hover:bg-surface-container-highest disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-secondary rounded-xl hover:opacity-90 shadow-sm disabled:opacity-50"
          >
            <Icon name="check_circle" className="text-[18px]" />
            {saving ? "Saving..." : "Mark rescued"}
          </button>
        </div>
      </form>
    </div>
  );
}
