import { useState } from "react";
import api, { updateStoredUser } from "../../services/api";
import VolunteerForm from "./VolunteerForm";

export default function ProfileTab({ user, setUser, isOwnProfile }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: user.name || "",
    phone: user.phone || "",
  });
  const [showVolunteerForm, setShowVolunteerForm] = useState(false);
  const [editingVolunteer, setEditingVolunteer] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await api.put("/profile/update", form);
      setUser((prev) => ({ ...prev, ...res.data }));
      updateStoredUser({ name: res.data.name, phone: res.data.phone });
      setEditing(false);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
        {isOwnProfile && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
          >
            Edit
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Name">
          {editing ? (
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <p className="text-gray-900">{user.name}</p>
          )}
        </Field>

        {user.email && (
          <Field label="Email">
            <p className="text-gray-900">{user.email}</p>
          </Field>
        )}

        {(isOwnProfile || user.phone) && (
          <Field label="Phone">
            {editing ? (
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-900">{user.phone || "—"}</p>
            )}
          </Field>
        )}

        <Field label="Role">
          <p className="text-gray-900 capitalize">{user.role?.toLowerCase()}</p>
        </Field>
      </div>

      {editing && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setForm({ name: user.name, phone: user.phone || "" });
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Volunteer Section */}
      {user.role === "USER" && isOwnProfile && (
        <div className="mt-10 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Become a Volunteer</h3>
          <p className="text-sm text-gray-500 mb-4">
            Help animals in need by joining our volunteer network.
          </p>
          {!showVolunteerForm ? (
            <button
              onClick={() => setShowVolunteerForm(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
            >
              Apply to be a Volunteer
            </button>
          ) : (
            <VolunteerForm
              user={user}
              onCancel={() => setShowVolunteerForm(false)}
              onSuccess={(profile) => {
                const { user: updatedUser, ...volunteerProfile } = profile;
                setUser((prev) => ({ ...prev, ...updatedUser, volunteerProfile }));
                updateStoredUser(updatedUser);
                setShowVolunteerForm(false);
              }}
            />
          )}
        </div>
      )}

      {user.role === "VOLUNTEER" && user.volunteerProfile && (
        <div className="mt-10 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Volunteer Information</h3>
            {isOwnProfile && !editingVolunteer && (
              <button
                onClick={() => setEditingVolunteer(true)}
                className="px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50"
              >
                Edit
              </button>
            )}
          </div>
          <VolunteerForm
            initialData={user.volunteerProfile}
            editing={editingVolunteer}
            onCancel={() => setEditingVolunteer(false)}
            onSuccess={(updated) => {
              setUser((prev) => ({
                ...prev,
                volunteerProfile: { ...prev.volunteerProfile, ...updated },
              }));
              setEditingVolunteer(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      {children}
    </div>
  );
}