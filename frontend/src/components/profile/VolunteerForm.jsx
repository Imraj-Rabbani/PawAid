import { useState } from "react";
import api from "../../services/api";

export default function VolunteerForm({
  initialData = null,
  editing = true,
  onSuccess,
  onCancel,
}) {
  const isEditMode = !!initialData && editing;
  const [form, setForm] = useState({
    location: initialData?.location || "",
    nid: initialData?.nid || "",
    description: initialData?.description || "",
  });
  const [saving, setSaving] = useState(false);

  // Read-only view when volunteer exists but not editing
  if (initialData && !editing) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Location</p>
          <p className="text-gray-900">{initialData.location}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">NID</p>
          <p className="text-gray-900">{initialData.nid}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Description</p>
          <p className="text-gray-900 whitespace-pre-wrap">
            {initialData.description || "—"}
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = isEditMode
        ? await api.put("/profile/volunteer/profile", form)
        : await api.post("/profile/volunteer/apply", form);

      onSuccess?.(res.data);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
          Location
        </label>
        <input
          required
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="City, Country"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">NID</label>
        <input
          required
          value={form.nid}
          onChange={(e) => setForm({ ...form, nid: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="National ID number"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
          Description
        </label>
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Tell us about your experience, availability, etc."
        />
      </div>

      <div className="sm:col-span-2 flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : isEditMode ? "Update" : "Submit Application"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}