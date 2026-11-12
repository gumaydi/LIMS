import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { z } from "zod";
import { requireActor } from "../_lib/auth.js";
import { assertMethod, HttpError, parseBody, withErrors } from "../_lib/http.js";
import { serviceClient } from "../_lib/supabase.js";

const returnSchema = z.object({
  borrowing_id: z.string().uuid(),
  returner_name: z.string().trim().min(2).max(120),
}).strict();

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await withErrors(response, async () => {
    assertMethod(request, ["POST"]);
    const actor = await requireActor(request);
    const input = parseBody(request, returnSchema);
    const { data, error } = await serviceClient.schema("api").rpc("return_borrowing", {
      actor_id: actor.id,
      borrowing_id: input.borrowing_id,
      returner_name: input.returner_name,
    });
    if (error) throw error;
    if (!data) throw new HttpError(500, "EMPTY_RESULT", "Pengembalian tidak berhasil disimpan.");
    response.status(200).json({ data });
  });
}
