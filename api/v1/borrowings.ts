import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { z } from "zod";
import { requireActor } from "../_lib/auth.js";
import { assertMethod, HttpError, parseBody, withErrors } from "../_lib/http.js";
import { serviceClient } from "../_lib/supabase.js";

const borrowingSchema = z.object({
  client_request_id: z.string().uuid(),
  borrower_name: z.string().trim().min(2).max(120),
  item_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  borrowed_on: z.string().date(),
}).strict();

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await withErrors(response, async () => {
    assertMethod(request, ["POST"]);
    const actor = await requireActor(request);
    const input = parseBody(request, borrowingSchema);
    const { data, error } = await serviceClient.schema("api").rpc("create_borrowing", {
      actor_id: actor.id,
      ...input,
    });
    if (error) throw error;
    if (!data) throw new HttpError(500, "EMPTY_RESULT", "Peminjaman tidak berhasil disimpan.");
    response.status(201).json({ data });
  });
}
