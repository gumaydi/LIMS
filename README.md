# Inventaris Laboratorium

Aplikasi React dan Supabase untuk mencatat inventaris, peminjaman, pengembalian, akun Staff, dan aktivitas laboratorium. Antarmuka menggunakan Bahasa Indonesia. Admin mengelola barang dan akun. Staff hanya membaca inventaris aktif serta mencatat transaksi.

## Arsitektur

- Browser membaca tabel melalui Supabase Data API dan RLS.
- Semua perubahan data melewati Vercel Functions di `/api/v1`.
- Handler memvalidasi access token, memuat profil terkini, dan menyuntikkan UUID pelaku.
- PostgreSQL memeriksa ulang peran serta status aktif, mengunci baris stok, dan mencatat aktivitas dalam transaksi yang sama.
- RPC mutasi hanya dapat dijalankan `service_role`.

Desain teknis lengkap tersedia di [specs/laboratory_inventory_design.md](specs/laboratory_inventory_design.md).

## Menjalankan secara lokal

Prasyarat: Node.js 22, Docker, Supabase CLI, dan Vercel CLI.

Masuk ke folder proyek terlebih dahulu:

```bash
cd invent-system
```

### Variabel Supabase yang harus diisi

Salin `.env.example` menjadi `.env.local`. Isi lima variabel berikut:

| Variabel | Isi | Lokasi pengambilan |
|---|---|---|
| `VITE_SUPABASE_URL` | Project URL | Supabase Dashboard, tombol Connect |
| `SUPABASE_URL` | Project URL yang sama | Supabase Dashboard, tombol Connect |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key | Settings, API Keys, bagian Publishable key |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable key yang sama | Settings, API Keys, bagian Publishable key |
| `SUPABASE_SECRET_KEY` | Secret key | Settings, API Keys, bagian Secret key |

Contoh bentuk nilai hosted:

```env
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_PUBLISHABLE_KEY=<publishable-key>
SUPABASE_SECRET_KEY=<secret-key>
```

Jangan menambahkan tanda kutip, spasi, atau koma di sekitar nilai. Variabel dengan awalan `VITE_` masuk ke bundle browser, jadi jangan pernah menaruh secret key di sana.

Untuk Supabase lokal, ambil Project URL, publishable key, dan secret key dari output `supabase status`. Jika project hosted Anda masih menyediakan key legacy, nilai `anon` dapat ditempatkan pada dua variabel publishable dan nilai `service_role` dapat ditempatkan pada `SUPABASE_SECRET_KEY`. Publishable dan secret key baru tetap menjadi pilihan utama.

Langkah menjalankan aplikasi:

1. Isi `.env.local` sesuai tabel di atas.
2. Pasang dependensi dengan `npm ci`.
3. Jalankan Supabase dengan `supabase start`.
4. Terapkan database dengan `supabase db reset`.
5. Buat Admin terkontrol:

```bash
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SECRET_KEY=<secret-key> \
ADMIN_USERNAME=admin.lab \
ADMIN_DISPLAY_NAME="Admin Laboratorium" \
ADMIN_PASSWORD=<password-minimal-12-karakter> \
node scripts/bootstrap-admin.mjs
```

6. Jalankan seed setelah Admin tersedia:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/seed.sql
```

7. Jalankan frontend dan Functions bersama `vercel dev`.

Supabase Auth harus tetap menonaktifkan pendaftaran publik. Pengguna tidak pernah memasukkan email internal pada aplikasi.

## Verifikasi

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run audit:prod
supabase test db
```

## Deployment

1. Buat proyek Supabase dan nonaktifkan public signup.
2. Hubungkan proyek lokal dengan `supabase link --project-ref <project-ref>`.
3. Tinjau perubahan menggunakan `supabase db diff`, lalu jalankan `supabase db push`.
   Migration `202611120003_item_images.sql` menambahkan kolom foto dan membuat bucket publik `item-images` dengan batas 2 MB untuk JPG, PNG, dan WebP. Bucket tidak perlu dibuat manual dari Dashboard.
   Migration `202611120004_expose_service_api_schema.sql` menambahkan schema `api` ke PostgREST. Fungsi di dalamnya tetap hanya dapat dieksekusi oleh `service_role`.
   Migration `202611120006_returner_identity.sql` menyimpan nama orang yang menyerahkan barang saat pengembalian. Data lama tetap dipertahankan tanpa menebak identitas pengembali.
4. Buat Admin dengan `scripts/bootstrap-admin.mjs` dan jalankan seed satu kali.
5. Buat proyek Vercel dari repository ini.
6. Isi `VITE_SUPABASE_URL`, `SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SECRET_KEY` pada Vercel.
7. Deploy, lalu uji login Admin dan Staff dari browser bersih.

Jangan memasukkan secret key atau legacy service-role key ke variabel yang diawali `VITE_`. Password demo harus dibagikan melalui kanal privat.

## Rollback dan pemulihan

Ekspor backup logis sebelum migration produksi. Migration ini membuat type dan tabel inti, jadi rollback produksi sebaiknya memakai backup terverifikasi atau migration maju yang memperbaiki schema. Jangan menjatuhkan tabel yang sudah memiliki transaksi.

Untuk memeriksa akun Auth internal tanpa profil:

```bash
SUPABASE_URL=<url> SUPABASE_SECRET_KEY=<secret-key> node scripts/list-auth-orphans.mjs
```

Skrip hanya menampilkan orphan. Operator harus meninjau setiap UUID sebelum memilih rekonsiliasi atau penghapusan melalui Supabase Dashboard.

## Batas hosted free plan

Free plan cocok untuk pengembangan dan demonstrasi akademik, tetapi proyek dapat terpengaruh kuota serta kebijakan jeda dari penyedia. Periksa status proyek sebelum evaluasi dan simpan backup logis sebelum migration penting. Repository ini tidak menyertakan kredensial, URL publik, atau akun demo karena ketiganya memerlukan akses pemilik proyek.
