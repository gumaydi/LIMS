import { supabase } from "./supabase";
import { clearQueryCache } from "./queryCache";

type ApiFailure = { error?: { message?: string } };

export async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (data.session?.access_token) headers.set("Authorization", `Bearer ${data.session.access_token}`);
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const failure = (await response.json().catch(() => ({}))) as ApiFailure;
    throw new Error(failure.error?.message ?? "Permintaan tidak berhasil diproses.");
  }
  if ((init.method ?? "GET").toUpperCase() !== "GET") clearQueryCache();
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
