import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function UnauthorizedPage() { const { profile } = useAuth(); return <main className="center-screen"><section className="state-panel"><h1>Akses ditolak</h1><p>Akun Anda tidak memiliki izin untuk membuka halaman ini.</p><Link className="button primary" to={profile?.role === "ADMIN" ? "/admin" : "/staff"}>Kembali ke ringkasan</Link></section></main>; }
export function NotFoundPage() { return <main className="center-screen"><section className="state-panel"><h1>Halaman tidak ditemukan</h1><p>Alamat yang dibuka tidak tersedia.</p><Link className="button primary" to="/">Kembali ke aplikasi</Link></section></main>; }
