import { supabase } from "./supabase";

export const ITEM_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const ITEM_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

export function getItemImageUrl(path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from("item-images").getPublicUrl(path).data.publicUrl;
}

export function validateItemImage(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return "Pilih gambar berformat JPG, PNG, atau WebP.";
  }
  if (file.size > ITEM_IMAGE_MAX_BYTES) return "Ukuran gambar maksimal 2 MB.";
  return null;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Gambar tidak dapat dibaca."));
    reader.onerror = () => reject(new Error("Gambar tidak dapat dibaca."));
    reader.readAsDataURL(file);
  });
}
