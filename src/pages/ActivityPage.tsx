import { useCallback } from "react";
import { DataState } from "../components/DataState";
import { useSupabaseList } from "../hooks/useSupabaseList";
import { supabase } from "../lib/supabase";
import type { Activity } from "../types";

const actionLabels: Record<string, string> = {
  STAFF_CREATED: "Membuat akun Staff",
  STAFF_UPDATED: "Memperbarui akun Staff",
  STAFF_ACTIVATED: "Mengaktifkan akun Staff",
  STAFF_DEACTIVATED: "Menonaktifkan akun Staff",
  STAFF_PASSWORD_RESET: "Mengatur ulang password Staff",
  STAFF_PROVISION_FAILED: "Provisioning akun Staff gagal",
  ITEM_CREATED: "Menambah barang baru",
  ITEM_UPDATED: "Memperbarui barang",
  ITEM_ARCHIVED: "Mengarsipkan barang",
  BORROWING_CREATED: "Mencatat peminjaman",
  BORROWING_RETURNED: "Mencatat pengembalian",
};

export function ActivityPage() {
  const loader = useCallback(async () => {
    const { data, error } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return data as Activity[];
  }, []);
  const state = useSupabaseList(loader, { cacheKey: "activity" });

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="context-label">Audit operasional</p>
          <h1>Aktivitas</h1>
          <p>Log terpusat dari seluruh transaksi database dan tidak dapat diubah oleh pengguna.</p>
        </div>
      </header>
      <DataState
        state={state}
        emptyTitle="Belum ada aktivitas"
        emptyText="Perubahan inventaris, akun, dan transaksi akan tercatat di sini."
        onRetry={state.reload}
      >
        {(rows) => (
          <div className="record-list panel">
            {rows.map((row) => {
              const meta = row.metadata as Record<string, unknown> | undefined;
              const detailNote = meta?.code
                ? `Kode: ${String(meta.code)}`
                : meta?.username
                ? `Akun: @${String(meta.username)}`
                : meta?.quantity
                ? `Kuantitas: ${String(meta.quantity)} unit`
                : null;

              return (
                <article key={row.id} className="record-row">
                  <div>
                    <strong>{actionLabels[row.action] ?? row.action}</strong>
                    <span>Pelaku: @{row.actor_username_snapshot} ({row.actor_role_snapshot === "ADMIN" ? "Admin" : "Staff"})</span>
                  </div>
                  <div>
                    {detailNote && <span className="meta-chip">{detailNote}</span>}
                  </div>
                  <div>
                    <small>{new Date(row.created_at).toLocaleString("id-ID")}</small>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </DataState>
    </section>
  );
}
