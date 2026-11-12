import { useCallback, useMemo, useState } from "react";
import { DataState } from "../components/DataState";
import { useSupabaseList } from "../hooks/useSupabaseList";
import { supabase } from "../lib/supabase";
import type { Borrowing } from "../types";
import { formatDate, formatDateTime } from "../lib/format";

export function HistoryPage() {
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");

  const loader = useCallback(async () => {
    const { data, error } = await supabase.from("borrowings").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data as Borrowing[];
  }, []);
  const state = useSupabaseList(loader, { cacheKey: "borrowing-history" });

  const visible = useMemo(() => {
    if (state.status !== "success") return [];
    return state.data.filter((row) => {
      const matchesStatus = status === "ALL" || row.status === status;
      if (!matchesStatus) return false;
      const haystack = `${row.borrower_name} ${row.item_code_snapshot} ${row.item_name_snapshot} ${row.created_by_username_snapshot}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });
  }, [state, status, query]);

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="context-label">Jejak transaksi</p>
          <h1>Riwayat</h1>
          <p>Daftar lengkap peminjaman dan pengembalian sesuai hak akses akun Anda.</p>
        </div>
      </header>

      <div className="toolbar">
        <div>
          <label htmlFor="history-search">Cari riwayat</label>
          <input
            id="history-search"
            type="search"
            placeholder="Cari peminjam, kode, atau barang"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div style={{ display: "grid", gap: "0.25rem" }}>
          <label htmlFor="history-status">Status</label>
          <select
            id="history-status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="ALL">Semua Transaksi</option>
            <option value="BORROWED">Sedang Dipinjam</option>
            <option value="RETURNED">Sudah Dikembalikan</option>
          </select>
        </div>
      </div>

      <DataState
        state={state}
        emptyTitle="Riwayat masih kosong"
        emptyText="Transaksi yang tersimpan akan muncul di sini."
        onRetry={state.reload}
      >
        {() => visible.length === 0 ? (
          <div className="state-panel">
            <h2>Tidak ada hasil</h2>
            <p>
              {query
                ? `Tidak ada transaksi yang cocok dengan "${query}".`
                : "Tidak ada transaksi dengan status yang dipilih."}
            </p>
            {(query || status !== "ALL") && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setQuery("");
                  setStatus("ALL");
                }}
              >
                Reset filter & pencarian
              </button>
            )}
          </div>
        ) : (
          <div className="record-list panel">
            {visible.map((row) => (
              <article key={row.id} className="record-row transaction-row history-row">
                <div className="transaction-identity">
                  <strong>{row.borrower_name}</strong>
                  <span>{row.item_code_snapshot} · {row.item_name_snapshot}</span>
                  <small>{row.item_category_snapshot}</small>
                </div>
                <div className="transaction-details">
                  <span><b>Tanggal pinjam</b>{formatDate(row.borrowed_on)}</span>
                  <span><b>Dicatat</b>{formatDateTime(row.created_at)}</span>
                  <span><b>Petugas pinjam</b>@{row.created_by_username_snapshot}</span>
                  {row.returned_at && (
                    <span><b>Dikembalikan</b>{formatDateTime(row.returned_at)}</span>
                  )}
                  {row.returned_at && (
                    <span><b>Yang mengembalikan</b>{row.returner_name ?? "Tidak dicatat (data lama)"}</span>
                  )}
                  {row.returned_by_username_snapshot && (
                    <span><b>Petugas penerima</b>@{row.returned_by_username_snapshot}</span>
                  )}
                </div>
                <div className="transaction-actions">
                  <span className={`status ${row.status.toLowerCase()}`}>
                    {row.status === "BORROWED" ? "Dipinjam" : "Dikembalikan"}
                  </span>
                  <span className="meta-chip">{row.quantity} unit</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </DataState>
    </section>
  );
}
