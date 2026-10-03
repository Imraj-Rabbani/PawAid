import WalletCard from "./WalletCard";

export default function Sidebar({
    user,
    preview,
    uploading,
    onFileChange,
    tabs,
    activeTab,
    onTabChange,
    isOwnProfile,
    onWalletUpdated,
  }) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative group">
            <img
              src={preview || "/default-avatar.png"}
              alt="Profile"
              className="w-28 h-28 rounded-full object-cover ring-4 ring-gray-100"
            />
            {isOwnProfile && (
              <label
                className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition cursor-pointer ${
                  uploading ? "opacity-100 cursor-wait" : ""
                }`}
              >
                <span className="text-white text-xs font-medium">
                  {uploading ? "Uploading..." : "Change"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            )}
          </div>
  
          <h3 className="mt-4 font-semibold text-gray-900">{user.name}</h3>
          <p className="text-sm text-gray-500">{user.email}</p>
          <span
            className={`mt-2 inline-block px-3 py-1 text-xs font-medium rounded-full capitalize ${
              user.role === "VOLUNTEER"
                ? "bg-green-100 text-green-700"
                : user.role === "ADMIN"
                ? "bg-purple-100 text-purple-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {user.role?.toLowerCase()}
          </span>
        </div>

        {user.volunteerProfile?.wallet && (
          <WalletCard
            wallet={user.volunteerProfile.wallet}
            canTopUp={isOwnProfile && user.volunteerProfile.status === "ACTIVE"}
            onToppedUp={onWalletUpdated}
          />
        )}

        {/* Tabs */}
        <nav className="mt-6 flex flex-col gap-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`text-left px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === tab
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>
    );
  }