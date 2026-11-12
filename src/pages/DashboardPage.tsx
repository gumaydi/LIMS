import { useCallback } from "react";
import { Link } from "react-router-dom";
import { DataState } from "../components/DataState";
import { useAuth } from "../hooks/useAuth";
import { useSupabaseList } from "../hooks/useSupabaseList";
import { formatDateTime } from "../lib/format";
import { supabase } from "../lib/supabase";
import type { Borrowing, Item } from "../types";

type DashboardItem = Pick<Item, "id" | "code" | "name" | "total_stock" | "available_stock">;
type MovementBorrowing = Pick<Borrowing, "id" | "quantity" | "borrowed_on" | "returned_at">;
type DashboardData = {
  items: DashboardItem[];
  activeBorrowings: Array<Pick<Borrowing, "id" | "quantity">>;
  recentBorrowings: Borrowing[];
  weeklyBorrowings: MovementBorrowing[];
};
type DailyMovement = { key: string; label: string; borrowed: number; returned: number };

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeeklyMovement(rows: MovementBorrowing[]): DailyMovement[] {
  const formatter = new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "2-digit" });
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - index));
    return { key: localDateKey(date), label: formatter.format(date), borrowed: 0, returned: 0 };
  });
  const byDate = new Map(days.map((day) => [day.key, day]));
  for (const row of rows) {
    const borrowedDay = byDate.get(row.borrowed_on);
    if (borrowedDay) borrowedDay.borrowed += row.quantity;
    if (row.returned_at) {
      const returnedDay = byDate.get(localDateKey(new Date(row.returned_at)));
      if (returnedDay) returnedDay.returned += row.quantity;
    }
  }
  return days;
}

export function DashboardPage() {
  const { profile } = useAuth();
  const loader = useCallback(async (): Promise<DashboardData[]> => {
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - 6);
    const [itemsResult, activeResult, recentResult, weeklyResult] = await Promise.all([
      supabase.from("items").select("id,code,name,total_stock,available_stock").eq("is_archived", false).order("available_stock"),
      supabase.from("borrowings").select("id,quantity").eq("status", "BORROWED"),
      supabase.from("borrowings").select("*").order("created_at", { ascending: false }).limit(6),
      supabase.from("borrowings").select("id,quantity,borrowed_on,returned_at")
        .or(`borrowed_on.gte.${localDateKey(weekStart)},returned_at.gte.${weekStart.toISOString()}`),
    ]);
    if (itemsResult.error) throw itemsResult.error;
    if (activeResult.error) throw activeResult.error;
    if (recentResult.error) throw recentResult.error;
    if (weeklyResult.error) throw weeklyResult.error;
    return [{
      items: itemsResult.data as DashboardItem[],
      activeBorrowings: activeResult.data as Array<Pick<Borrowing, "id" | "quantity">>,
      recentBorrowings: recentResult.data as Borrowing[],
      weeklyBorrowings: weeklyResult.data as MovementBorrowing[],
    }];
  }, []);
  const state = useSupabaseList(loader, { cacheKey: `dashboard:${profile?.id ?? "guest"}` });

  return (
    <section className="page-stack">
      <header className="page-header">
        <div>
          <p className="context-label">Ringkasan {profile?.role === "ADMIN" ? "Admin" : "Staff"}</p>
          <h1>Selamat datang, {profile?.display_name}</h1>
          <p>Periksa pergerakan transaksi dan stok yang perlu ditindaklanjuti hari ini.</p>
        </div>
      </header>

      <DataState state={state} emptyTitle="Ringkasan belum tersedia" emptyText="Belum ada data inventaris yang dapat dihitung." onRetry={state.reload}>
        {([dashboard]) => {
          if (!dashboard) return null;
          const availableUnits = dashboard.items.reduce((sum, item) => sum + item.available_stock, 0);
          const totalUnits = dashboard.items.reduce((sum, item) => sum + item.total_stock, 0);
          const borrowedUnits = dashboard.activeBorrowings.reduce((sum, row) => sum + row.quantity, 0);
          const utilization = totalUnits === 0 ? 0 : Math.round((borrowedUnits / totalUnits) * 100);
          const lowStock = dashboard.items.filter((item) => item.available_stock <= 2).slice(0, 5);
          const weekly = getWeeklyMovement(dashboard.weeklyBorrowings);
          const chartMaximum = Math.max(1, ...weekly.flatMap((day) => [day.borrowed, day.returned]));
          const recent = dashboard.recentBorrowings;

          return <>
            <div className="metric-strip dashboard-metrics" aria-label="Ringkasan data operasional">
              <div><span>Jenis barang aktif</span><strong>{dashboard.items.length}</strong><small>jenis tercatat</small></div>
              <div><span>Unit tersedia</span><strong>{availableUnits}</strong><small>dari {totalUnits} unit</small></div>
              <div><span>Pinjaman aktif</span><strong>{dashboard.activeBorrowings.length}</strong><small>{borrowedUnits} unit dipinjam</small></div>
              <div><span>Pemakaian stok</span><strong>{utilization}%</strong><small>unit sedang dipinjam</small></div>
            </div>

            <div className="action-row dashboard-actions">
              <Link className="button primary" to="/borrowings/new">Catat peminjaman</Link>
              <Link className="button secondary" to="/returns">Proses pengembalian</Link>
              {profile?.role === "ADMIN" && <Link className="button secondary" to="/inventory/new">Tambah barang</Link>}
            </div>

            <div className="dashboard-grid">
              <section className="panel movement-panel" aria-labelledby="movement-title">
                <div className="panel-heading dashboard-section-heading">
                  <div><h2 id="movement-title">Pergerakan 7 hari</h2><p>Jumlah unit yang dipinjam dan dikembalikan.</p></div>
                  <div className="chart-legend" aria-label="Legenda grafik">
                    <span><i className="legend-borrowed" aria-hidden="true" />Dipinjam</span>
                    <span><i className="legend-returned" aria-hidden="true" />Kembali</span>
                  </div>
                </div>
                <div className="movement-chart" role="list" aria-label="Unit dipinjam dan dikembalikan selama tujuh hari terakhir">
                  {weekly.map((day) => (
                    <div className="chart-day" key={day.key} role="listitem" aria-label={`${day.label}: ${day.borrowed} unit dipinjam, ${day.returned} unit dikembalikan`}>
                      <div className="chart-values" aria-hidden="true"><span>{day.borrowed || ""}</span><span>{day.returned || ""}</span></div>
                      <div className="chart-bars" aria-hidden="true">
                        <i className="chart-bar borrowed" style={{ height: day.borrowed ? `${Math.max(8, (day.borrowed / chartMaximum) * 100)}%` : 0 }} />
                        <i className="chart-bar returned" style={{ height: day.returned ? `${Math.max(8, (day.returned / chartMaximum) * 100)}%` : 0 }} />
                      </div>
                      <span className="chart-label">{day.label}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="panel attention-panel" aria-labelledby="attention-title">
                <div className="panel-heading dashboard-section-heading">
                  <div><h2 id="attention-title">Perlu diperiksa</h2><p>Barang aktif dengan stok tersisa paling sedikit.</p></div>
                  <Link to="/inventory">Inventaris</Link>
                </div>
                {lowStock.length === 0 ? <p className="quiet">Tidak ada barang dengan stok kritis.</p> : (
                  <div className="attention-list">
                    {lowStock.map((item) => (
                      <div key={item.id}>
                        <span><b>{item.code}</b>{item.name}</span>
                        <strong className={item.available_stock === 0 ? "stock-empty" : "stock-low"}>{item.available_stock} / {item.total_stock}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="panel recent-panel">
              <div className="panel-heading dashboard-section-heading">
                <div><h2>Transaksi terbaru</h2><p>Aktivitas peminjaman dan pengembalian yang dapat Anda lihat.</p></div>
                <Link to="/history">Buka riwayat</Link>
              </div>
              {recent.length === 0 ? <p className="quiet">Belum ada transaksi. Catat peminjaman pertama dari tombol di atas.</p> : (
                <div className="record-list">
                  {recent.map((row) => (
                    <article key={row.id} className="record-row transaction-row dashboard-transaction-row">
                      <div className="transaction-identity">
                        <strong>{row.borrower_name}</strong>
                        <span>{row.item_code_snapshot} · {row.item_name_snapshot}</span>
                        <small>{row.item_category_snapshot}</small>
                      </div>
                      <div className="transaction-details">
                        <span><b>Dicatat</b>{formatDateTime(row.created_at)}</span>
                        <span><b>Petugas</b>@{row.created_by_username_snapshot}</span>
                        {row.returner_name && <span><b>Pengembali</b>{row.returner_name}</span>}
                      </div>
                      <div className="transaction-actions">
                        <span className={`status ${row.status.toLowerCase()}`}>{row.status === "BORROWED" ? "Dipinjam" : "Dikembalikan"}</span>
                        <span className="meta-chip">{row.quantity} unit</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>;
        }}
      </DataState>
    </section>
  );
}
