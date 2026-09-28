import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";
import Sidebar from "../components/profile/Sidebar";
import ProfileTab from "../components/profile/ProfileTab";
import DonationsTab from "../components/profile/DonationsTab";
import EmptyTab from "../components/profile/EmptyTab";
import Navbar from "../components/Navbar";


const TABS = ["Profile", "Donations", "Rescues", "Address", "Orders"];

export default function ProfilePage() {
  const { userId } = useParams();
  const [user, setUser] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Profile");

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
      setUser((prev) => ({ ...prev, ...res.data }));
      setPreview(res.data.profilePictureUrl);
    } catch (err) {
      console.error(err);
      alert("Upload failed");
      setPreview(user?.profilePictureUrl);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">User not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* LEFT 30% */}
            <aside className="md:w-[30%] w-full">
              <Sidebar
                user={user}
                preview={preview}
                uploading={uploading}
                onFileChange={handleFileChange}
                tabs={TABS}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            </aside>

            {/* RIGHT 70% */}
            <main className="md:w-[70%] w-full">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 min-h-125">
                {activeTab === "Profile" && (
                  <ProfileTab user={user} setUser={setUser} isOwnProfile />
                )}
                {activeTab === "Donations" && <DonationsTab />}
                {activeTab === "Rescues" && <EmptyTab title="Rescues" />}
                {activeTab === "Address" && <EmptyTab title="Address" />}
                {activeTab === "Orders" && <EmptyTab title="Orders" />}
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}