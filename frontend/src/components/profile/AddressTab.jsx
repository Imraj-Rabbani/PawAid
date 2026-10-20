import { useState } from "react";
import api from "../../services/api";

export default function AddressTab({ user, setUser }) {
  const [editing, setEditing] = useState(!user.address);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [address, setAddress] = useState(user.address || "");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);

    try {
      // Only the address is sent, so name and phone stay as set on the Profile tab
      const res = await api.put("/profile/update", { address });
      setUser((previous) => ({ ...previous, ...res.data }));
      setAddress(res.data.address || "");
      setEditing(false);
      setSaved(true);
    } catch (requestError) {
      const fieldErrors = Object.values(requestError.response?.data?.errors || {}).flat();
      setError(fieldErrors[0] || requestError.response?.data?.message || "Failed to save your address.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setAddress(user.address || "");
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
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm">
            <p className="font-medium text-gray-900">{user.name}</p>
            <p className="mt-0.5 text-gray-600">{user.phone || "No phone number"}</p>
            <p className="mt-2 text-xs text-gray-500">Name and phone are managed on the Profile tab.</p>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-700">Street address and area</span>
            <textarea
              required
              maxLength={500}
              rows={4}
              autoComplete="street-address"
              placeholder="House or building, street, area, city"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <span className="mt-1 block text-right text-xs text-gray-500">{address.length}/500</span>
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
