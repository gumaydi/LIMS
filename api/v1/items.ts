import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { z } from "zod";
import { requireActor } from "../_lib/auth.js";
import { assertMethod, HttpError, parseBody, withErrors } from "../_lib/http.js";
import { serviceClient } from "../_lib/supabase.js";

const itemSchema = z.object({
  item_id: z.string().uuid().nullable(),
  code: z.string().trim().min(2).max(32),
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  total_stock: z.number().int().nonnegative(),
}).strict();

const archiveSchema = z.object({ item_id: z.string().uuid() }).strict();

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await withErrors(response, async () => {
    const actor = await requireActor(request, "ADMIN");
    if (request.method === "POST" || request.method === "PUT") {
      const input = parseBody(request, itemSchema);
      const { data, error } = await serviceClient.schema("api").rpc("upsert_item", {
        actor_id: actor.id,
        ...input,
      });
      if (error) throw error;
      if (!data) throw new HttpError(500, "EMPTY_RESULT", "Barang tidak berhasil disimpan.");
      response.status(request.method === "POST" ? 201 : 200).json({ data });
      return;
    }
    if (request.method === "DELETE") {
      const input = parseBody(request, archiveSchema);
      const { data, error } = await serviceClient.schema("api").rpc("archive_item", {
        actor_id: actor.id,
        item_id: input.item_id,
      });
      if (error) throw error;
      response.status(200).json({ data });
      return;
    }
    assertMethod(request, ["POST", "PUT", "DELETE"]);
  });
}
