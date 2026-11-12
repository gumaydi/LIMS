import type { VercelRequest } from "./vercel.js";
import { HttpError } from "./http.js";
import { serviceClient } from "./supabase.js";

export type Actor = {
  id: string;
  username: string;
  display_name: string;
  role: "ADMIN" | "STAFF";
  is_active: boolean;
};

export async function requireActor(request: VercelRequest, requiredRole?: Actor["role"]): Promise<Actor> {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    throw new HttpError(401, "UNAUTHENTICATED", "Sesi tidak valid. Silakan masuk kembali.");
  }

  const token = authorization.slice("Bearer ".length);
  const { data: authData, error: authError } = await serviceClient.auth.getUser(token);
  if (authError || !authData.user) {
    throw new HttpError(401, "UNAUTHENTICATED", "Sesi tidak valid. Silakan masuk kembali.");
  }

  const { data, error } = await serviceClient
    .from("profiles")
    .select("id,username,display_name,role,is_active")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (error || !data || !data.is_active) {
    throw new HttpError(401, "ACCOUNT_INACTIVE", "Sesi tidak valid. Silakan masuk kembali.");
  }
  const actor = data as Actor;
  if (requiredRole && actor.role !== requiredRole) {
    throw new HttpError(403, "FORBIDDEN", "Anda tidak memiliki izin untuk tindakan ini.");
  }
  return actor;
}
