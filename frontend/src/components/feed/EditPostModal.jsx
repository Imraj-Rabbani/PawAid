import { useState, useEffect } from "react";
import api from "../../services/api";
import Icon from "../Icon";

const inputClass =
  "w-full px-3 py-2 bg-surface-container-low border border-transparent rounded-xl text-sm text-on-surface placeholder:text-on-surface-variant/70 focus:outline-none focus:ring-2 focus:ring-primary-container";
const labelClass = "text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-1 block";

// Creators can edit a post until a volunteer takes it on. Images stay as they are.
export default function EditPostModal({ post, raised, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: post.title,
    description: post.description,
    rescueAreaId: post.rescueArea.id,
    donationTarget: post.donationTarget ? String(post.donationTarget) : "",
  });
  const [areas, setAreas] = useState([post.rescueArea]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const res = await api.get("/area");
        setAreas(res.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAreas();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaving(true);
      setError("");
      const res = await api.put(`/rescue-post/${post.id}`, {
        ...form,
        donationTarget: form.donationTarget ? Number(form.donationTarget) : 0,
      });
      onSaved(res.data.data);
    } catch (err) {
      console.error(err);
      const fieldErrors = Object.values(err.response?.data?.errors || {}).flat();
      setError(fieldErrors[0] || err.response?.data?.message || "Failed to save changes");
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
        aria-labelledby="edit-post-title"
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface-container-lowest rounded-2xl shadow-lg p-6 flex flex-col gap-4 animate-pop-in"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="edit-post-title" className="font-display text-lg font-bold text-on-surface">
            Edit rescue post
          </h2>
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

        <div>
          <label htmlFor="edit-title" className={labelClass}>Title</label>
          <input
            id="edit-title"
            required
            minLength={3}
            maxLength={150}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="edit-description" className={labelClass}>Description</label>
          <textarea
            id="edit-description"
            required
            minLength={10}
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className={`${inputClass} resize-y`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="edit-area" className={labelClass}>Rescue area</label>
            <select
              id="edit-area"
              required
              value={form.rescueAreaId}
              onChange={(e) => setForm({ ...form, rescueAreaId: e.target.value })}
              className={inputClass}
            >
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-target" className={labelClass}>Donation target (৳)</label>
            <input
              id="edit-target"
              type="number"
              min={raised}
              max={10000000}
              step={1}
              value={form.donationTarget}
              onChange={(e) => setForm({ ...form, donationTarget: e.target.value })}
              placeholder="Optional"
              className={inputClass}
            />
            {raised > 0 && (
              <p className="mt-1 text-xs text-on-surface-variant">
                Already raised ৳{raised.toLocaleString()}, so the target can't go lower.
              </p>
            )}
          </div>
        </div>

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
            className="px-4 py-2 text-sm font-bold text-white bg-primary rounded-xl hover:bg-primary-container shadow-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
