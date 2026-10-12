import { useState } from "react";
import api, { updateStoredUser } from "../../services/api";

export default function AddressTab({ user, setUser }) {
  const [editing, setEditing] = useState(!user.address);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: user.name || "",
    phone: user.phone || "",
    address: user.address || "",
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);

    try {
      const res = await api.put("/profile/update", form);
      setUser((previous) => ({ ...previous, ...res.data }));
      updateStoredUser({ name: res.data.name, phone: res.data.phone, address: res.data.address });
      setForm({ name: res.data.name || "", phone: res.data.phone || "", address: res.data.address || "" });
      setEditing(false);
      setSaved(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Failed to save your address.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({ name: user.name || "", phone: user.phone || "", address: user.address || "" });
    setError("");
    setSaved(false);
    setEditing(false);
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-5">
        <div>
          <p className="text-sm font-medium text-blue-700">PROFILE</p>
          <h2 className="mt-1 text-xl font-semibold text-gray-900">Delivery address</h2>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Edit address
          </button>
        )}
      </div>

      {saved && <p role="status" className="mt-4 text-sm font-medium text-green-700">Address saved.</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}

      {editing ? (
        <form onSubmit={handleSubmit} className="mt-6 max-w-2xl space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Recipient name</span>
            <input
              required
              minLength={3}
              maxLength={100}
              autoComplete="name"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Phone number</span>
            <input
              required
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Street address and area</span>
            <textarea
              required
              maxLength={500}
              rows={4}
              autoComplete="street-address"
              placeholder="House or building, street, area, city"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
              className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <span className="mt-1 block text-right text-xs text-gray-500">{form.address.length}/500</span>
          </label>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save address"}
            </button>
            {user.address && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="mt-6 max-w-2xl">
          <p className="text-sm font-medium text-gray-500">SAVED FOR DELIVERIES</p>
          <div className="mt-3 border-l-2 border-blue-600 pl-4">
            <p className="font-semibold text-gray-900">{user.name}</p>
            <p className="mt-1 text-sm text-gray-600">{user.phone || "No phone number"}</p>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-700">{user.address}</p>
          </div>
        </div>
      )}
    </section>
  );
}