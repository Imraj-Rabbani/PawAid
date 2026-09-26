import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";

export default function ProfilePage() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get(`/profile/${userId}`);
        setUser(res.data);
        setPreview(res.data.profilePictureUrl);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [userId]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("profilePicture", file);

    try {
      setUploading(true);
      const res = await api.put("/users/profile-picture", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUser(res.data);
      setPreview(res.data.profilePictureUrl);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>User not found</p>;

  return (
    <div style={{ maxWidth: 320, margin: "40px auto", textAlign: "center" }}>
      <h2>Profile</h2>

      <img
        src={preview || "/default-avatar.png"}
        alt="Profile"
        style={{ width: 120, height: 120, borderRadius: "50%", objectFit: "cover" }}
      />

      <div style={{ marginTop: 12 }}>
        <label style={{ cursor: "pointer", color: "#2563eb" }}>
          {uploading ? "Uploading..." : "Change photo"}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
            style={{ display: "none" }}
          />
        </label>
      </div>

      <p style={{ marginTop: 16 }}>{user.name}</p>
      <p style={{ color: "#666" }}>{user.email}</p>
    </div>
  );
}