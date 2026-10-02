import { useState, useEffect } from "react";
import api from "../../services/api";

export default function VolunteerForm({
  initialData = null,
  editing = true,
  user = null,
  onSuccess,
  onCancel,
}) {
  const isEditMode = !!initialData && editing;
  const readOnly = !!initialData && !editing;
  const [form, setForm] = useState({
    rescueAreaId: initialData?.rescueAreaId || "",
    nid: initialData?.nid || "",
    description: initialData?.description || "",
    phone: user?.phone || "",
    address: user?.address || "",
  });
  const [areas, setAreas] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (readOnly) return;

    const fetchAreas = async () => {
      try {
        const res = await api.get("/area");
        setAreas(res.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchAreas();
  }, [readOnly]);

  // Read-only view when volunteer exists but not editing
  if (readOnly) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase mb-1">Rescue Area</p>
          <p className="text-gray-900">{initialData.rescueArea?.name || "—"}</p>
        </div>
        {initialData.nid && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">NID</p>
            <p className="text-gray-900">{initialData.nid}</p>
          </div>
        )}
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
      const { phone, address, ...volunteerFields } = form;
      const res = isEditMode
        ? await api.put("/volunteer/profile", volunteerFields)
        : await api.post("/volunteer/apply", { ...volunteerFields, phone, address });

      onSuccess?.(res.data);
    } catch (err) {
      console.error(err);
      alert(
        err.response?.data?.message ||
          "Something went wrong"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
          Rescue Area
        </label>
        <select
          required
          value={form.rescueAreaId}
          onChange={(e) => setForm({ ...form, rescueAreaId: e.target.value })}
          className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select an area</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
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
      {!isEditMode && (
        <>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
              Phone
            </label>
            <input
              required
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Phone number"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase mb-1 block">
              Address
            </label>
            <input
              required
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Street, City"
            />
          </div>
        </>
      )}
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
