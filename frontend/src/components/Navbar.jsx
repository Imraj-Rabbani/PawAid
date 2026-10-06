import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import Icon from "./Icon";

const ROLE_LABELS = { USER: "Member", VOLUNTEER: "Volunteer", ADMIN: "Admin" };

export default function Navbar({ user: userProp }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [balance, setBalance] = useState(null);

  const user =
    userProp || JSON.parse(localStorage.getItem("user") || "null");
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;

    const fetchWallet = async () => {
      try {
        const res = await api.get("/wallet/me");
        setBalance(res.data.data.balance);
      } catch (err) {
        console.error(err);
      }
    };
    fetchWallet();
  }, [userId]);

  const links = [
    { label: "Community", path: "/" },
    { label: "Volunteers", path: "/volunteers" },
    { label: "Donations", path: "/donations" },
    ...(user?.role === "ADMIN" ? [{ label: "Admin", path: "/admin" }] : []),
  ];

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const goToProfile = () => {
    if (!user) return navigate("/signin");
    navigate(`/profile/${user.id}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/signin");
  };

  return (
    <nav className="sticky top-0 z-50 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 h-20">
          {/* ── Logo ── */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 shrink-0"
          >
            <img
              src="/logo.png"
              alt="PawAid logo"
              className="h-10 w-10 rounded-lg object-contain"
            />
            <span className="font-display font-bold text-xl tracking-tight text-on-surface">
              PawAid
            </span>
            <span className="hidden lg:inline-flex ml-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[11px] font-semibold uppercase tracking-wider">
              Rescue Network
            </span>
          </button>

          {/* ── Desktop nav links ── */}
          <div className="hidden md:flex items-center gap-1 ml-auto">
            {links.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className={`px-3 py-2 text-sm rounded-lg transition ${isActive(link.path)
                    ? "bg-primary-container text-white font-semibold shadow-sm"
                    : "font-semibold text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                  }`}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* ── Right side: user / auth ── */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <>
                {balance !== null && (
                  <button
                    onClick={goToProfile}
                    className="hidden sm:flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-full hover:bg-surface-container transition-colors"
                  >
                    <Icon name="account_balance_wallet" className="text-[18px] text-secondary" />
                    <span className="text-xs font-semibold text-on-surface">
                      Wallet: <span className="text-secondary font-bold">৳{balance.toLocaleString()}</span>
                    </span>
                  </button>
                )}

                <button
                  onClick={goToProfile}
                  className="flex items-center gap-2 pl-3 sm:border-l border-surface-container-highest group"
                >
                  <img
                    src={user.profilePictureUrl || "/default-avatar.png"}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-outline-variant"
                  />
                  <span className="hidden lg:flex flex-col text-left">
                    <span className="text-xs font-semibold text-on-surface leading-tight group-hover:text-primary transition-colors">
                      {user.name}
                    </span>
                    <span className="text-[11px] text-on-surface-variant leading-none">
                      {ROLE_LABELS[user.role] || "Member"}
                    </span>
                  </span>
                </button>

                {/* Logout (desktop only) */}
                <button
                  onClick={handleLogout}
                  aria-label="Logout"
                  title="Logout"
                  className="hidden md:flex p-2 rounded-full text-on-surface-variant hover:text-error hover:bg-error-container/50 transition"
                >
                  <Icon name="logout" className="text-[20px]" />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("/signin")}
                  className="text-sm font-semibold text-on-surface-variant hover:text-on-surface"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate("/signup")}
                  className="text-sm font-semibold text-white bg-primary hover:bg-primary-container px-4 py-2 rounded-xl shadow-sm transition"
                >
                  Sign Up
                </button>
              </>
            )}

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg hover:bg-surface-container-high"
              aria-label="Toggle menu"
            >
              <Icon name={mobileOpen ? "close" : "menu"} className="text-[24px] text-on-surface" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile dropdown ── */}
      {mobileOpen && (
        <div className="md:hidden border-t border-surface-container-high bg-surface-container-lowest">
          <div className="px-4 py-3 flex flex-col gap-1">
            {user && balance !== null && (
              <p className="sm:hidden px-3 py-2 text-sm text-on-surface-variant">
                Wallet: <span className="font-bold text-secondary">৳{balance.toLocaleString()}</span>
              </p>
            )}
            {links.map((link) => (
              <button
                key={link.path}
                onClick={() => {
                  navigate(link.path);
                  setMobileOpen(false);
                }}
                className={`text-left px-3 py-2 text-sm font-semibold rounded-lg transition ${isActive(link.path)
                    ? "bg-primary-container text-white"
                    : "text-on-surface-variant hover:bg-surface-container-low"
                  }`}
              >
                {link.label}
              </button>
            ))}

            {user && (
              <button
                onClick={handleLogout}
                className="text-left px-3 py-2 text-sm font-semibold text-error hover:bg-error-container/50 rounded-lg"
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
