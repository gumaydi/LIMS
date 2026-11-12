import { useCallback, useRef, useState } from "react";
import { AlertMessage } from "../components/AlertMessage";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataState } from "../components/DataState";
import { useSupabaseList } from "../hooks/useSupabaseList";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Borrowing } from "../types";
import { formatDate, formatDateTime } from "../lib/format";

export function ReturnsPage() {
  const loader = useCallback(async () => {
    const { data, error } = await supabase.from("borrowings").select("*").eq("status", "BORROWED").order("created_at", { ascending: false });
    if (error) throw error;
    return data as Borrowing[];
  }, []);
  const state = useSupabaseList(loader, { cacheKey: "active-returns" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingReturnRow, setPendingReturnRow] = useState<Borrowing | null>(null);
  const [returnerName, setReturnerName] = useState("");
  const returnerInputRef = useRef<HTMLInputElement>(null);

  async function handleConfirmReturn() {
    if (!pendingReturnRow) return;
    const row = pendingReturnRow;
    setPendingReturnRow(null);
    setBusy(row.id);
    setMessage(null);
    try {
      await apiRequest("/api/v1/returns", { method: "POST", body: JSON.stringify({ borrowing_id: row.id, returner_name: returnerName.trim() }) });
      setMessage({
        type: "success",
        text: `Pengembalian ${row.quantity} unit ${row.item_name_snapshot} oleh ${returnerName.trim()} berhasil disimpan. Stok dipulihkan.`,
      });
      setReturnerName("");
      state.reload();
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Pengembalian tidak dapat diproses.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="context-label">Transaksi aktif</p>
          <h1>Pengembalian</h1>
          <p>Pilih peminjaman yang sudah selesai untuk memulihkan stok laboratorium.</p>
        </div>
      </header>

      {message && (
        <AlertMessage
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      <DataState
        state={state}
        emptyTitle="Tidak ada barang yang perlu dikembalikan"
        emptyText="Semua peminjaman yang dapat Anda lihat sudah selesai."
        onRetry={state.reload}
      >
        {(rows) => (
          <div className="record-list panel">
            {rows.map((row) => (
              <article key={row.id} className="record-row transaction-row">
                <div className="transaction-identity">
                  <strong>{row.borrower_name}</strong>
                  <span>{row.item_code_snapshot} · {row.item_name_snapshot}</span>
                  <small>{row.item_category_snapshot}</small>
                </div>
                <div className="transaction-details">
                  <span><b>Tanggal pinjam</b>{formatDate(row.borrowed_on)}</span>
                  <span><b>Dicatat</b>{formatDateTime(row.created_at)}</span>
                  <span><b>Petugas</b>@{row.created_by_username_snapshot}</span>
                </div>
                <div className="transaction-actions">
                  <span className="meta-chip">{row.quantity} unit</span>
                  <button
                    className="button primary"
                    type="button"
                    disabled={busy === row.id}
                    aria-busy={busy === row.id}
                    onClick={() => {
                      setReturnerName(row.borrower_name);
                      setPendingReturnRow(row);
                    }}
                  >
                    {busy === row.id && <span className="button-spinner" aria-hidden="true" />}
                    {busy === row.id ? "Memproses..." : "Kembalikan"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </DataState>

      <ConfirmDialog
        isOpen={Boolean(pendingReturnRow)}
        title="Konfirmasi Pengembalian Barang"
        description={
          pendingReturnRow
            ? `Pastikan ${pendingReturnRow.quantity} unit ${pendingReturnRow.item_name_snapshot} (${pendingReturnRow.item_code_snapshot}) dari ${pendingReturnRow.borrower_name} telah diterima secara fisik dalam kondisi baik.`
            : ""
        }
        confirmLabel="Ya, Proses Pengembalian"
        cancelLabel="Batal"
        variant="primary"
        onConfirm={() => void handleConfirmReturn()}
        onCancel={() => {
          setPendingReturnRow(null);
          setReturnerName("");
        }}
        confirmDisabled={returnerName.trim().length < 2}
        initialFocusRef={returnerInputRef}
      >
        <div className="dialog-field">
          <label htmlFor="returner-name">Nama yang mengembalikan</label>
          <input
            ref={returnerInputRef}
            id="returner-name"
            minLength={2}
            maxLength={120}
            required
            value={returnerName}
            onChange={(event) => setReturnerName(event.target.value)}
          />
          <small>Isi nama orang yang menyerahkan barang, bukan nama petugas penerima.</small>
        </div>
      </ConfirmDialog>
    </section>
  );
}
