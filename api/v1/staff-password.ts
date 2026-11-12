import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { z } from "zod";
import { requireActor } from "../_lib/auth.js";
import { assertMethod, parseBody, withErrors } from "../_lib/http.js";
import { serviceClient } from "../_lib/supabase.js";

const passwordSchema = z.object({
  staff_id: z.string().uuid(),
  temporary_password: z.string().min(12).max(128),
}).strict();

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await withErrors(response, async () => {
    assertMethod(request, ["POST"]);
    const actor = await requireActor(request, "ADMIN");
    const input = parseBody(request, passwordSchema);
    const { error } = await serviceClient.auth.admin.updateUserById(input.staff_id, {
      password: input.temporary_password,
    });
    if (error) throw error;
    const { error: logError } = await serviceClient.schema("api").rpc("log_staff_password_reset", {
      actor_id: actor.id,
      staff_id: input.staff_id,
    });
    if (logError) throw logError;
    response.status(204).end();
  });
}
