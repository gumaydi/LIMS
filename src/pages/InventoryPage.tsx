import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AlertMessage } from "../components/AlertMessage";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DataState } from "../components/DataState";
import { useSupabaseList } from "../hooks/useSupabaseList";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabase";
import { getItemImageUrl } from "../lib/itemImage";
import type { Item } from "../types";

export function InventoryPage() {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "AVAILABLE" | "DEPLETED" | "ARCHIVED">("ALL");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingArchiveItem, setPendingArchiveItem] = useState<Item | null>(null);

  const loader = useCallback(async () => {
    const { data, error } = await supabase.from("items").select("*").order("code");
    if (error) throw error;
    return data as Item[];
  }, []);
  const state = useSupabaseList(loader, { cacheKey: "inventory" });

  const filtered = useMemo(() => {
    if (state.status !== "success") return [];
    return state.data.filter((item) => {
      const matchesQuery = `${item.code} ${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase());
      if (!matchesQuery) return false;
      if (statusFilter === "AVAILABLE") return !item.is_archived && item.available_stock > 0;
      if (statusFilter === "DEPLETED") return !item.is_archived && item.available_stock === 0;
      if (statusFilter === "ARCHIVED") return item.is_archived;
      return true;
    });
  }, [state, query, statusFilter]);

  async function handleConfirmArchive() {
    if (!pendingArchiveItem) return;
    const item = pendingArchiveItem;
    setPendingArchiveItem(null);
    setMessage(null);
    try {
      await apiRequest("/api/v1/items", { method: "DELETE", body: JSON.stringify({ item_id: item.id }) });
      setMessage({ type: "success", text: `Barang ${item.code} (${item.name}) berhasil diarsipkan.` });
      state.reload();
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Barang tidak dapat diarsipkan." });
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="context-label">Stok laboratorium</p>
          <h1>Inventaris</h1>
          <p>Cari barang berdasarkan kode, nama, atau kategori.</p>
        </div>
        {profile?.role === "ADMIN" && (
          <Link className="button primary" to="/inventory/new">
            Tambah barang
          </Link>
        )}
      </header>

      <div className="toolbar">
        <div>
          <label htmlFor="inventory-search">Cari inventaris</label>
          <input
            id="inventory-search"
            type="search"
            placeholder="Contoh: BR008 atau Mikrokontroler"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="filter-tabs" role="group" aria-label="Filter status stok">
          <button
            type="button"
            className={`filter-tab ${statusFilter === "ALL" ? "active" : ""}`}
            onClick={() => setStatusFilter("ALL")}
          >
            Semua
          </button>
          <button
            type="button"
            className={`filter-tab ${statusFilter === "AVAILABLE" ? "active" : ""}`}
            onClick={() => setStatusFilter("AVAILABLE")}
          >
            Tersedia
          </button>
          <button
            type="button"
            className={`filter-tab ${statusFilter === "DEPLETED" ? "active" : ""}`}
            onClick={() => setStatusFilter("DEPLETED")}
          >
            Stok Habis
          </button>
          {profile?.role === "ADMIN" && (
            <button
              type="button"
              className={`filter-tab ${statusFilter === "ARCHIVED" ? "active" : ""}`}
              onClick={() => setStatusFilter("ARCHIVED")}
            >
              Diarsipkan
            </button>
          )}
        </div>
      </div>

      {message && (
        <AlertMessage
          type={message.type}
          message={message.text}
          onDismiss={() => setMessage(null)}
        />
      )}

      <DataState
        state={state}
        emptyTitle="Inventaris masih kosong"
        emptyText={profile?.role === "ADMIN" ? "Tambahkan barang agar Staff dapat mencatat peminjaman." : "Admin belum menambahkan barang aktif."}
        onRetry={state.reload}
      >
        {() => filtered.length === 0 ? (
          <div className="state-panel">
            <h2>Barang tidak ditemukan</h2>
            <p>
              {query
                ? `Tidak ada hasil yang sesuai dengan "${query}".`
                : "Tidak ada barang pada kategori filter ini."}
            </p>
            {(query || statusFilter !== "ALL") && (
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setQuery("");
                  setStatusFilter("ALL");
                }}
              >
                Reset pencarian & filter
              </button>
            )}
          </div>
        ) : (
          <div className="inventory-grid">
            {filtered.map((item) => {
              const isDepleted = !item.is_archived && item.available_stock === 0;
              const isLow = !item.is_archived && item.available_stock > 0 && item.available_stock <= 2;
              const imageUrl = getItemImageUrl(item.image_path);
              return (
                <article
                  className={`inventory-card ${isDepleted ? "depleted" : ""}`}
                  key={item.id}
                >
                  <div className="inventory-image-wrap">
                    {imageUrl ? (
                      <img
                        className="inventory-image"
                        src={imageUrl}
                        alt={`Foto ${item.name}`}
                        loading="lazy"
                        width="640"
                        height="400"
                      />
                    ) : (
                      <div className="inventory-image-placeholder" aria-label={`Belum ada foto untuk ${item.name}`}>
                        <span>{item.code}</span>
                      </div>
                    )}
                  </div>
                  <div className="inventory-card-header">
                    <span className="item-code">{item.code}</span>
                    {item.is_archived ? (
                      <span className="status archived">Diarsipkan</span>
                    ) : isDepleted ? (
                      <span className="status out-of-stock">Stok Habis</span>
                    ) : isLow ? (
                      <span className="status low-stock">Sisa {item.available_stock}</span>
                    ) : null}
                  </div>
                  <h2>{item.name}</h2>
                  <p>{item.category}</p>
                  <dl>
                    <div>
                      <dt>Tersedia</dt>
                      <dd>{item.available_stock}</dd>
                    </div>
                    <div>
                      <dt>Total</dt>
                      <dd>{item.total_stock}</dd>
                    </div>
                  </dl>
                  {profile?.role === "ADMIN" && (
                    <div className="card-actions">
                      <Link className="button secondary" to={`/inventory/${item.id}/edit`}>
                        Ubah
                      </Link>
                      {!item.is_archived && (
                        <button
                          className="button danger"
                          type="button"
                          onClick={() => setPendingArchiveItem(item)}
                        >
                          Arsipkan
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </DataState>

      <ConfirmDialog
        isOpen={Boolean(pendingArchiveItem)}
        title="Arsipkan Barang Inventaris"
        description={
          pendingArchiveItem
            ? `Apakah Anda yakin ingin mengarsipkan ${pendingArchiveItem.code} (${pendingArchiveItem.name})? Barang yang diarsipkan tidak dapat dipinjam oleh Staff.`
            : ""
        }
        confirmLabel="Ya, Arsipkan"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={() => void handleConfirmArchive()}
        onCancel={() => setPendingArchiveItem(null)}
      />
    </section>
  );
}
