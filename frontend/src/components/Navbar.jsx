import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api, { authService } from "../services/api";
import Icon from "./Icon";
import { useCart } from "../context/cartContext";

const ROLE_LABELS = { USER: "Member", VOLUNTEER: "Volunteer", ADMIN: "Admin" };

export default function Navbar({ user: userProp }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [balance, setBalance] = useState(null);
  const { count: cartCount } = useCart();

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
    { label: "Marketplace", path: "/marketplace" },
    { label: "Transparency", path: "/transparency" },
    ...(user?.role === "ADMIN" ? [{ label: "Admin", path: "/admin" }] : []),
  ];

  const isActive = (path) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const goToProfile = () => {
    if (!user) return navigate("/signin");
    navigate(`/profile/${user.id}`);
  };

  const signOutWith = async (endSessions) => {
    try {
      await endSessions();
    } catch {
      // signed out locally either way; the cookie expires on its own
    }
    localStorage.removeItem("user");
    navigate("/signin");
  };

  const handleLogout = () => signOutWith(authService.signOut);

  const handleLogoutEverywhere = () => {
    if (!window.confirm("Log out on every device, including this one?")) return;
    signOutWith(authService.signOutEverywhere);
  };

  return (
    <nav className="sticky top-0 z-50 bg-surface-container-lowest/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* three columns from md up: the two sides share the width equally, so the
            links stay centred whatever is on the right (logged in, admin, ...) */}
        <div className="flex items-center justify-between gap-4 h-20 md:grid md:grid-cols-[1fr_auto_1fr]">
          {/* ── Logo ── */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 shrink-0 justify-self-start"
          >
            <img
              src="/logo.png"
              alt="PawAid logo"
              className="h-10 w-10 rounded-lg object-contain"
            />
            <span className="font-display font-bold text-xl tracking-tight text-on-surface">
              PawAid
            </span>
          </button>

          {/* ── Desktop nav links ── */}
          <div className="hidden md:flex items-center gap-1">
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
          <div className="flex items-center gap-2 lg:gap-3 shrink-0 justify-self-end">
            <button
              onClick={() => navigate("/cart")}
              aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
              title="Cart"
              className={`relative p-2 rounded-full transition ${location.pathname === "/cart"
                  ? "bg-primary-fixed text-primary"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
                }`}
            >
              <Icon name="shopping_cart" className="text-[22px]" />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold leading-none">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>

            {user ? (
              <>
                {balance !== null && (
                  // compact and only on wide screens, so the right side never pushes into the links
                  <button
                    onClick={goToProfile}
                    aria-label={`Wallet balance ৳${balance.toLocaleString()}`}
                    title="Wallet balance"
                    className="hidden lg:flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-full hover:bg-surface-container transition-colors"
                  >
                    <Icon name="account_balance_wallet" className="text-[18px] text-secondary" />
                    <span className="text-xs font-bold text-secondary">৳{balance.toLocaleString()}</span>
                  </button>
                )}

                <AccountMenu user={user} onProfile={goToProfile} onLogout={handleLogout} onLogoutEverywhere={handleLogoutEverywhere} />
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
              <p className="px-3 py-2 text-sm text-on-surface-variant">
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
          </div>
        </div>
      )}
    </nav>
  );
}

// The avatar opens a small menu with the profile link and logout
function AccountMenu({ user, onProfile, onLogout, onLogoutEverywhere }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // a click anywhere else or Escape closes it
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (action) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={menuRef} className="relative pl-3 sm:border-l border-surface-container-highest">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 group"
      >
        <img
          src={user.profilePictureUrl || "/default-avatar.png"}
          alt=""
          className={`w-8 h-8 rounded-full object-cover ring-1 transition ${open ? "ring-2 ring-primary" : "ring-outline-variant"}`}
        />
        <span className="hidden xl:flex flex-col text-left max-w-28">
          <span className="text-xs font-semibold text-on-surface leading-tight truncate group-hover:text-primary transition-colors">
            {user.name}
          </span>
          <span className="text-[11px] text-on-surface-variant leading-none">
            {ROLE_LABELS[user.role] || "Member"}
          </span>
        </span>
        <Icon
          name="expand_more"
          className={`text-[18px] text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-3 w-56 p-1.5 bg-surface-container-lowest rounded-2xl shadow-lg ring-1 ring-surface-container-high z-50 animate-pop-in"
        >
          <div className="px-3 py-2 border-b border-surface-container-high mb-1">
            <p className="text-sm font-semibold text-on-surface truncate">{user.name}</p>
            <p className="text-xs text-on-surface-variant">{ROLE_LABELS[user.role] || "Member"}</p>
          </div>
          <button
            role="menuitem"
            onClick={() => choose(onProfile)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-on-surface rounded-xl hover:bg-surface-container-low transition"
          >
            <Icon name="person" className="text-[20px] text-on-surface-variant" />
            My Profile
          </button>
          <button
            role="menuitem"
            onClick={() => choose(onLogout)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-error rounded-xl hover:bg-error-container/50 transition"
          >
            <Icon name="logout" className="text-[20px]" />
            Logout
          </button>
          <button
            role="menuitem"
            onClick={() => choose(onLogoutEverywhere)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-error rounded-xl hover:bg-error-container/50 transition"
          >
            <Icon name="devices" className="text-[20px]" />
            Log out of all devices
          </button>
        </div>
      )}
    </div>
  );
}
