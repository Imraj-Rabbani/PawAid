import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

export default function Navbar({ user: userProp }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);


  const user =
    userProp || JSON.parse(localStorage.getItem("user") || "null");

  const links = [
    { label: "Home", path: "/" },
    { label: "Rescues", path: "/rescues" },
    { label: "Volunteers", path: "/volunteers" },
    { label: "Donations", path: "/donations" },
    { label: "About", path: "/about" },
  ];

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const goToProfile = () => {
    if (!user) return navigate("/login");
    navigate(`/profile/${user.id}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token"); 
    navigate("/login");
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* ── Logo ── */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
              P
            </div>
            <span className="font-semibold text-gray-900 text-lg hidden sm:block">
              PawAid
            </span>
          </button>

          {/* ── Desktop nav links ── */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition ${
                  isActive(link.path)
                    ? "text-blue-700 bg-blue-50"
                    : "text-gray-700 hover:text-blue-700 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* ── Right side: user / auth ── */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                {/* Avatar button */}
                <button
                  onClick={goToProfile}
                  className="flex items-center gap-2 rounded-full hover:bg-gray-100 p-1 pr-3 transition"
                >
                  <img
                    src={user.profilePictureUrl || "/default-avatar.png"}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-gray-100"
                  />
                  <span className="hidden sm:block text-sm font-medium text-gray-700">
                    {user.name?.split(" ")[0]}
                  </span>
                </button>

                {/* Logout (desktop only) */}
                <button
                  onClick={handleLogout}
                  className="hidden md:block text-sm text-gray-500 hover:text-red-600 transition"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("/login")}
                  className="text-sm font-medium text-gray-700 hover:text-blue-700"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate("/register")}
                  className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition"
                >
                  Sign Up
                </button>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile dropdown ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 flex flex-col gap-1">
            {links.map((link) => (
              <button
                key={link.path}
                onClick={() => {
                  navigate(link.path);
                  setMobileOpen(false);
                }}
                className={`text-left px-3 py-2 text-sm font-medium rounded-lg transition ${
                  isActive(link.path)
                    ? "text-blue-700 bg-blue-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                {link.label}
              </button>
            ))}

            {user && (
              <button
                onClick={handleLogout}
                className="text-left px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}