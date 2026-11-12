import { type FormEvent, useCallback, useState } from "react";
import { AlertMessage } from "../components/AlertMessage";
import { DataState } from "../components/DataState";
import { useSupabaseList } from "../hooks/useSupabaseList";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabase";
import type { Item } from "../types";

export function BorrowingFormPage() {
  const loader = useCallback(async () => {
    const { data, error } = await supabase.from("items").select("*").eq("is_archived", false).gt("available_stock", 0).order("code");
    if (error) throw error;
    return data as Item[];
  }, []);
  const state = useSupabaseList(loader, { cacheKey: "borrowable-items" });
  const [form, setForm] = useState({ borrower_name: "", item_id: "", quantity: 1, borrowed_on: new Date().toISOString().slice(0, 10) });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const selectedItem = state.status === "success" ? state.data.find((item) => item.id === form.item_id) : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (selectedItem && form.quantity > selectedItem.available_stock) {
      setMessage({
        type: "error",
        text: `Jumlah melebihi stok yang tersedia (${selectedItem.available_stock} unit).`,
      });
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest("/api/v1/borrowings", { method: "POST", body: JSON.stringify({ ...form, client_request_id: crypto.randomUUID() }) });
      setMessage({ type: "success", text: "Peminjaman tersimpan dan stok telah diperbarui." });
      setForm({ ...form, borrower_name: "", item_id: "", quantity: 1 });
      state.reload();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Peminjaman tidak dapat disimpan." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="context-label">Transaksi</p>
          <h1>Catat peminjaman</h1>
          <p>Satu formulir mencatat satu jenis barang. Stok berkurang setelah transaksi berhasil.</p>
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
        emptyTitle="Tidak ada stok tersedia"
        emptyText="Semua barang aktif sedang habis atau belum ada inventaris."
        onRetry={state.reload}
      >
        {(items) => (
          <form className="panel form-grid transaction-form" onSubmit={submit}>
            <label htmlFor="borrower">Nama peminjam</label>
            <input
              id="borrower"
              required
              minLength={2}
              maxLength={120}
              placeholder="Nama lengkap peminjam"
              value={form.borrower_name}
              onChange={(event) => setForm({ ...form, borrower_name: event.target.value })}
            />

            <label htmlFor="item">Barang</label>
            <select
              id="item"
              required
              value={form.item_id}
              onChange={(event) => {
                const nextId = event.target.value;
                const nextItem = items.find((i) => i.id === nextId);
                const nextQty = nextItem && form.quantity > nextItem.available_stock ? nextItem.available_stock : form.quantity;
                setForm({ ...form, item_id: nextId, quantity: nextQty || 1 });
              }}
            >
              <option value="">Pilih barang laboratorium</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} · {item.name} ({item.category}) [Tersedia: {item.available_stock} unit]
                </option>
              ))}
            </select>

            {selectedItem && (
              <dl className="selection-summary" aria-label="Ringkasan barang terpilih">
                <div><dt>Kode</dt><dd>{selectedItem.code}</dd></div>
                <div><dt>Kategori</dt><dd>{selectedItem.category}</dd></div>
                <div><dt>Stok tersedia</dt><dd>{selectedItem.available_stock} unit</dd></div>
                <div><dt>Total stok</dt><dd>{selectedItem.total_stock} unit</dd></div>
              </dl>
            )}

            <label htmlFor="quantity">Jumlah</label>
            <input
              id="quantity"
              type="number"
              min="1"
              max={selectedItem ? selectedItem.available_stock : undefined}
              required
              value={form.quantity}
              onChange={(event) => setForm({ ...form, quantity: Number(event.target.value) })}
            />
            {selectedItem && (
              <small className="helper-text">
                Setelah transaksi, stok tersedia menjadi <strong>{Math.max(0, selectedItem.available_stock - form.quantity)} unit</strong>.
              </small>
            )}

            <label htmlFor="borrowed-on">Tanggal pinjam</label>
            <input
              id="borrowed-on"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              required
              value={form.borrowed_on}
              onChange={(event) => setForm({ ...form, borrowed_on: event.target.value })}
            />

            <button
              className="button primary"
              disabled={submitting || (Boolean(selectedItem) && form.quantity > (selectedItem?.available_stock ?? 0))}
              type="submit"
              aria-busy={submitting}
            >
              {submitting && <span className="button-spinner" aria-hidden="true" />}
              {submitting ? "Menyimpan..." : "Simpan peminjaman"}
            </button>
          </form>
        )}
      </DataState>
    </section>
  );
}
