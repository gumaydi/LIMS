import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertMessage } from "../components/AlertMessage";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types";

export function StaffDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Profile | null>(null);
  const [form, setForm] = useState({ username: "", display_name: "" });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    void supabase.from("profiles").select("id,username,display_name,role,is_active").eq("id", id).single().then(({ data, error }) => {
      if (error) setMessage({ type: "error", text: "Akun Staff tidak dapat dimuat." });
      else {
        const row = data as Profile;
        setStaff(row);
        setForm({ username: row.username, display_name: row.display_name });
      }
      setLoading(false);
    });
  }, [id]);

  async function update(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await apiRequest("/api/v1/staff", { method: "PUT", body: JSON.stringify({ staff_id: id, ...form }) });
      setMessage({ type: "success", text: "Identitas Staff berhasil diperbarui." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Profil tidak dapat diperbarui." });
    }
  }

  async function toggleActive() {
    if (!staff) return;
    setMessage(null);
    setShowDeactivateConfirm(false);
    try {
      await apiRequest("/api/v1/staff", { method: "PATCH", body: JSON.stringify({ staff_id: staff.id, is_active: !staff.is_active }) });
      setStaff({ ...staff, is_active: !staff.is_active });
      setMessage({
        type: "success",
        text: `Akun @${staff.username} telah ${staff.is_active ? "dinonaktifkan" : "diaktifkan kembali"}.`,
      });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Status akun tidak dapat diubah." });
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      await apiRequest("/api/v1/staff-password", { method: "POST", body: JSON.stringify({ staff_id: id, temporary_password: password }) });
      setPassword("");
      setMessage({ type: "success", text: "Password sementara berhasil diterapkan." });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Password tidak dapat diubah." });
    }
  }

  if (loading) return <div className="state-panel loading-panel"><LoadingIndicator label="Memuat akun Staff..." /></div>;
  if (!staff) return (
    <section className="state-panel">
      <h1>Akun tidak ditemukan</h1>
      <button className="button secondary" type="button" onClick={() => navigate("/staff-management")}>
        Kembali ke kelola Staff
      </button>
    </section>
  );

  return (
    <section className="page-stack narrow">
      <header className="page-header">
        <div>
          <p className="context-label">Administrasi akun</p>
          <h1>{staff.display_name}</h1>
          <p>
            Status akun saat ini:{" "}
            <span className={`status ${staff.is_active ? "active" : "archived"}`}>
              {staff.is_active ? "Aktif" : "Nonaktif"}
            </span>
          </p>
        </div>
      </header>

      {message && (
        <AlertMessage
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      <form className="panel form-grid" onSubmit={update}>
        <h2>Identitas Staff</h2>
        <label htmlFor="detail-name">Nama tampilan</label>
        <input
          id="detail-name"
          required
          minLength={2}
          value={form.display_name}
          onChange={(event) => setForm({ ...form, display_name: event.target.value })}
        />
        <label htmlFor="detail-username">Username</label>
        <input
          id="detail-username"
          required
          pattern="[a-z0-9._-]{3,32}"
          value={form.username}
          onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })}
        />
        <button className="button primary" type="submit">
          Simpan identitas
        </button>
      </form>

      <form className="panel form-grid" onSubmit={resetPassword}>
        <h2>Atur password sementara</h2>
        <label htmlFor="temporary-password">Password baru</label>
        <input
          id="temporary-password"
          type="password"
          required
          minLength={12}
          maxLength={128}
          placeholder="Minimal 12 karakter"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button className="button secondary" type="submit">
          Terapkan password
        </button>
      </form>

      <section className="panel danger-zone">
        <h2>Akses akun</h2>
        <p>
          {staff.is_active
            ? "Menonaktifkan akun akan langsung menghentikan sesi login dan hak akses ke database tanpa menghapus data peminjaman yang pernah dicatat."
            : "Aktifkan kembali akun ini agar petugas dapat masuk dan mencatat transaksi inventaris."}
        </p>
        <button
          className={staff.is_active ? "button danger" : "button primary"}
          type="button"
          onClick={() => {
            if (staff.is_active) {
              setShowDeactivateConfirm(true);
            } else {
              void toggleActive();
            }
          }}
        >
          {staff.is_active ? "Nonaktifkan akun" : "Aktifkan akun"}
        </button>
      </section>

      <Link className="button text-button" to="/staff-management">
        Kembali ke daftar Staff
      </Link>

      <ConfirmDialog
        isOpen={showDeactivateConfirm}
        title="Nonaktifkan Akun Staff"
        description={`Apakah Anda yakin ingin menonaktifkan akun @${staff.username} (${staff.display_name})? Petugas tidak akan dapat masuk kembali sampai diaktifkan oleh Admin.`}
        confirmLabel="Ya, Nonaktifkan"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={() => void toggleActive()}
        onCancel={() => setShowDeactivateConfirm(false)}
      />
    </section>
  );
}
