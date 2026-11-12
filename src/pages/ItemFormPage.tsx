import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertMessage } from "../components/AlertMessage";
import { apiRequest } from "../lib/api";
import { supabase } from "../lib/supabase";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { getItemImageUrl, ITEM_IMAGE_ACCEPT, readFileAsDataUrl, validateItemImage } from "../lib/itemImage";
import type { Item } from "../types";

export function ItemFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ code: "", name: "", category: "", total_stock: 0 });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    const state = location.state as { uploadError?: string } | null;
    return state?.uploadError ?? null;
  });

  useEffect(() => {
    if (!id) return;
    void supabase.from("items").select("*").eq("id", id).single().then(({ data, error: loadError }) => {
      if (loadError) setError("Barang tidak dapat dimuat.");
      else {
        const item = data as Item;
        setForm({ code: item.code, name: item.name, category: item.category, total_stock: item.total_stock });
        setImagePreview(getItemImageUrl(item.image_path));
      }
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    const state = location.state as { uploadError?: string } | null;
    if (state?.uploadError) setError(state.uploadError);
  }, [location.state]);

  useEffect(() => () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    const validationError = validateItemImage(file);
    if (validationError) {
      setError(validationError);
      event.target.value = "";
      return;
    }
    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiRequest<{ data: Item }>("/api/v1/items", { method: id ? "PUT" : "POST", body: JSON.stringify({ item_id: id ?? null, ...form }) });
      if (imageFile) {
        try {
          const imageDataUrl = await readFileAsDataUrl(imageFile);
          await apiRequest("/api/v1/item-image", {
            method: "POST",
            body: JSON.stringify({ item_id: result.data.id, image_data_url: imageDataUrl }),
          });
        } catch (uploadError) {
          navigate(`/inventory/${result.data.id}/edit`, {
            replace: true,
            state: { uploadError: uploadError instanceof Error ? `Data barang tersimpan, tetapi ${uploadError.message.toLowerCase()}` : "Data barang tersimpan, tetapi gambar gagal diunggah." },
          });
          return;
        }
      }
      navigate("/inventory", { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Barang tidak dapat disimpan.");
    } finally { setSubmitting(false); }
  }

  if (loading) return <div className="state-panel loading-panel"><LoadingIndicator label="Memuat data barang..." /></div>;

  return (
    <section className="page-stack narrow">
      <header className="page-header">
        <div>
          <p className="context-label">Inventaris laboratorium</p>
          <h1>{id ? "Ubah barang" : "Tambah barang baru"}</h1>
          <p>Total stok harus mencakup seluruh unit yang sedang dipinjam saat ini.</p>
        </div>
      </header>

      {error && (
        <AlertMessage
          type="error"
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      <form className="panel form-grid" onSubmit={submit}>
        <label htmlFor="code">Kode barang</label>
        <input
          id="code"
          required
          minLength={2}
          maxLength={32}
          placeholder="Contoh: BR014"
          value={form.code}
          onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
        />

        <fieldset className="image-fieldset">
          <legend>Foto barang</legend>
          <div className="image-upload-layout">
            <div className="image-preview">
              {imagePreview ? (
                <img src={imagePreview} alt={`Pratinjau foto ${form.name || "barang"}`} width="640" height="400" />
              ) : (
                <span>Belum ada foto</span>
              )}
            </div>
            <div className="image-upload-control">
              <label className="button secondary" htmlFor="item-image">Pilih gambar</label>
              <input
                className="visually-hidden-file"
                id="item-image"
                type="file"
                accept={ITEM_IMAGE_ACCEPT}
                onChange={selectImage}
              />
              <small>JPG, PNG, atau WebP. Maksimal 2 MB.</small>
              {imageFile && <small className="selected-file">Dipilih: {imageFile.name}</small>}
            </div>
          </div>
        </fieldset>

        <label htmlFor="name">Nama barang</label>
        <input
          id="name"
          required
          minLength={2}
          maxLength={120}
          placeholder="Contoh: Oscilloscope Digital 100MHz"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
        />

        <label htmlFor="category">Kategori</label>
        <input
          id="category"
          required
          minLength={2}
          maxLength={80}
          placeholder="Contoh: Alat Ukur, Mikrokontroler, dsb."
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
        />

        <label htmlFor="stock">Total stok</label>
        <input
          id="stock"
          type="number"
          min="0"
          required
          value={form.total_stock}
          onChange={(event) => setForm({ ...form, total_stock: Number(event.target.value) })}
        />

        <div className="form-actions">
          <Link className="button secondary" to="/inventory">
            Batal
          </Link>
          <button className="button primary" disabled={submitting} type="submit" aria-busy={submitting}>
            {submitting && <span className="button-spinner" aria-hidden="true" />}
            {submitting ? "Menyimpan barang..." : "Simpan barang"}
          </button>
        </div>
      </form>
    </section>
  );
}
