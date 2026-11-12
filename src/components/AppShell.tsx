import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const commonLinks = [
  ["/inventory", "Inventaris"], ["/borrowings/new", "Peminjaman"], ["/returns", "Pengembalian"], ["/history", "Riwayat"],
] as const;
const adminLinks = [["/staff-management", "Kelola Staff"], ["/activity", "Aktivitas"]] as const;

export function AppShell() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") ?? "light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  const links = profile?.role === "ADMIN" ? [...commonLinks, ...adminLinks] : commonLinks;
  const home = profile?.role === "ADMIN" ? "/admin" : "/staff";
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Lewati ke konten</a>
      <header className="topbar">
        <NavLink className="brand" to={home} onClick={() => setMenuOpen(false)}>Inventaris Laboratorium</NavLink>
        <div className="topbar-actions">
          <button type="button" className="button text-button" onClick={() => setTheme((value) => value === "light" ? "dark" : "light")}>
            Tema {theme === "light" ? "gelap" : "terang"}
          </button>
          <button
            type="button"
            className="button menu-button"
            aria-expanded={menuOpen}
            aria-controls="main-navigation"
            aria-label={menuOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
            onClick={() => setMenuOpen((value) => !value)}
          >
            Menu
          </button>
        </div>
      </header>
      <div
        className={`sidebar-backdrop ${menuOpen ? "open" : ""}`}
        aria-hidden="true"
        onClick={() => setMenuOpen(false)}
      />
      <aside className={menuOpen ? "sidebar open" : "sidebar"} id="main-navigation">
        <nav aria-label="Navigasi utama">
          <NavLink to={home} onClick={() => setMenuOpen(false)}>Ringkasan</NavLink>
          {links.map(([to, label]) => <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}>{label}</NavLink>)}
        </nav>
        <div className="account-block">
          <span>{profile?.display_name}</span>
          <small>{profile?.role === "ADMIN" ? "Admin" : "Staff"} · @{profile?.username}</small>
          <button type="button" className="button secondary mobile-theme-button" onClick={() => setTheme((value) => value === "light" ? "dark" : "light")}>
            Tema {theme === "light" ? "gelap" : "terang"}
          </button>
          <button type="button" className="button secondary" onClick={() => void logout().then(() => navigate("/login"))}>Keluar</button>
        </div>
      </aside>
      <main id="main-content" className="main-content">
        <div className="route-transition" key={location.pathname}><Outlet /></div>
      </main>
    </div>
  );
}
