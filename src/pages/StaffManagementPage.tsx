import { type FormEvent, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { AlertMessage } from "../components/AlertMessage";
import { DataState } from "../components/DataState";
import { useSupabaseList } from "../hooks/useSupabaseList";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types";

export function StaffManagementPage() {
  const loader = useCallback(async () => {
    const { data, error } = await supabase.from("profiles").select("id,username,display_name,role,is_active").eq("role", "STAFF").order("username");
    if (error) throw error;
    return data as Profile[];
  }, []);
  const state = useSupabaseList(loader, { cacheKey: "staff-management" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", display_name: "", password: "" });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createStaff(event: FormEvent) {
    event.preventDefault(); setSubmitting(true); setMessage(null);
    try {
      await apiRequest("/api/v1/staff", { method: "POST", body: JSON.stringify(form) });
      setMessage({ type: "success", text: `Akun Staff @${form.username} berhasil dibuat.` });
      setForm({ username: "", display_name: "", password: "" });
      setOpen(false);
      state.reload();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Akun Staff tidak dapat dibuat." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="context-label">Administrasi akun</p>
          <h1>Kelola Staff</h1>
          <p>Buat akun petugas, perbarui identitas, dan nonaktifkan akses tanpa menghapus rekam jejak.</p>
        </div>
        <button className="button primary" type="button" onClick={() => setOpen((value) => !value)}>
          {open ? "Tutup formulir" : "Buat akun Staff"}
        </button>
      </header>

      {message && (
        <AlertMessage
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      {open && (
        <form className="panel form-grid narrow-panel" onSubmit={createStaff}>
          <h2>Akun Staff baru</h2>
          <label htmlFor="staff-name">Nama tampilan</label>
          <input
            id="staff-name"
            minLength={2}
            maxLength={100}
            required
            placeholder="Contoh: Budi Santoso"
            value={form.display_name}
            onChange={(event) => setForm({ ...form, display_name: event.target.value })}
          />

          <label htmlFor="staff-username">Username</label>
          <input
            id="staff-username"
            pattern="[a-z0-9._-]{3,32}"
            required
            placeholder="Contoh: budi.lab"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })}
          />

          <label htmlFor="staff-password">Password sementara</label>
          <input
            id="staff-password"
            type="password"
            minLength={12}
            maxLength={128}
            required
            placeholder="Minimal 12 karakter"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
          />
          <small className="helper-text">Password sementara hanya digunakan untuk pembuatan akun awal.</small>
          <button className="button primary" type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting && <span className="button-spinner" aria-hidden="true" />}
            {submitting ? "Membuat akun..." : "Simpan akun Staff"}
          </button>
        </form>
      )}

      <DataState
        state={state}
        emptyTitle="Belum ada akun Staff"
        emptyText="Buat akun Staff agar petugas dapat mencatat peminjaman dan pengembalian."
        onRetry={state.reload}
      >
        {(rows) => (
          <div className="record-list panel">
            {rows.map((staff) => (
              <article className="record-row" key={staff.id}>
                <div>
                  <strong>{staff.display_name}</strong>
                  <span>@{staff.username}</span>
                </div>
                <div>
                  <span className={`status ${staff.is_active ? "active" : "archived"}`}>
                    {staff.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <div>
                  <Link className="button secondary" to={`/staff-management/${staff.id}`}>
                    Kelola
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </DataState>
    </section>
  );
}
