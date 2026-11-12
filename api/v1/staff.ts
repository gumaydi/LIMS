import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { z } from "zod";
import { requireActor } from "../_lib/auth.js";
import { assertMethod, HttpError, parseBody, withErrors } from "../_lib/http.js";
import { serviceClient } from "../_lib/supabase.js";

const baseStaffSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/),
  display_name: z.string().trim().min(2).max(100),
});
const createStaffSchema = baseStaffSchema.extend({ password: z.string().min(12).max(128) }).strict();
const updateStaffSchema = baseStaffSchema.extend({ staff_id: z.string().uuid() }).strict();
const activationSchema = z.object({ staff_id: z.string().uuid(), is_active: z.boolean() }).strict();

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await withErrors(response, async () => {
    const actor = await requireActor(request, "ADMIN");
    if (request.method === "POST") {
      const input = parseBody(request, createStaffSchema);
      const { data: existing, error: precheckError } = await serviceClient
        .from("profiles").select("id").eq("username", input.username).maybeSingle();
      if (precheckError) throw precheckError;
      if (existing) throw new HttpError(409, "USERNAME_TAKEN", "Username sudah digunakan.");
      const internalAlias = `${crypto.randomUUID()}@internal.invalid`;
      const { data: created, error: authError } = await serviceClient.auth.admin.createUser({
        email: internalAlias,
        password: input.password,
        email_confirm: true,
      });
      if (authError || !created.user) throw authError ?? new HttpError(500, "AUTH_CREATE_FAILED", "Akun Auth tidak berhasil dibuat.");
      const { data, error } = await serviceClient.schema("api").rpc("create_staff_profile", {
        actor_id: actor.id,
        staff_id: created.user.id,
        username: input.username,
        display_name: input.display_name,
      });
      if (error) {
        const { error: cleanupError } = await serviceClient.auth.admin.deleteUser(created.user.id);
        if (cleanupError) {
          await serviceClient.auth.admin.updateUserById(created.user.id, { ban_duration: "876000h" });
          await serviceClient.schema("api").rpc("log_staff_provision_failure", {
            actor_id: actor.id,
            staff_id: created.user.id,
            username: input.username,
            error_category: error.code ?? "PROFILE_CREATE_FAILED",
          });
        }
        throw error;
      }
      response.status(201).json({ data });
      return;
    }
    if (request.method === "PUT") {
      const input = parseBody(request, updateStaffSchema);
      const { data, error } = await serviceClient.schema("api").rpc("update_staff_profile", {
        actor_id: actor.id,
        staff_id: input.staff_id,
        username: input.username,
        display_name: input.display_name,
      });
      if (error) throw error;
      response.status(200).json({ data });
      return;
    }
    if (request.method === "PATCH") {
      const input = parseBody(request, activationSchema);
      const { data, error } = await serviceClient.schema("api").rpc("set_staff_active", {
        actor_id: actor.id,
        staff_id: input.staff_id,
        is_active: input.is_active,
      });
      if (error) throw error;
      const { error: authError } = await serviceClient.auth.admin.updateUserById(input.staff_id, {
        ban_duration: input.is_active ? "none" : "876000h",
      });
      if (authError) {
        throw new HttpError(502, "AUTH_SYNC_FAILED", "Profil tersimpan, tetapi status Auth belum tersinkron. Coba lagi.");
      }
      response.status(200).json({ data });
      return;
    }
    assertMethod(request, ["POST", "PUT", "PATCH"]);
  });
}
