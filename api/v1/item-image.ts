import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { z } from "zod";
import { requireActor } from "../_lib/auth.js";
import { assertMethod, HttpError, parseBody, withErrors } from "../_lib/http.js";
import { serviceClient } from "../_lib/supabase.js";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const inputSchema = z.object({
  item_id: z.string().uuid(),
  image_data_url: z.string().max(2_800_000),
}).strict();

const imageTypes = {
  "image/jpeg": { extension: "jpg", signature: (bytes: Buffer) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
  "image/png": { extension: "png", signature: (bytes: Buffer) => bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  "image/webp": { extension: "webp", signature: (bytes: Buffer) => bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP" },
} as const;

function decodeImage(dataUrl: string): { bytes: Buffer; mimeType: keyof typeof imageTypes; extension: string } {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new HttpError(422, "INVALID_IMAGE", "Gunakan gambar JPG, PNG, atau WebP yang valid.");
  const mimeType = match[1] as keyof typeof imageTypes;
  const bytes = Buffer.from(match[2]!, "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new HttpError(422, "IMAGE_TOO_LARGE", "Ukuran gambar maksimal 2 MB.");
  }
  const imageType = imageTypes[mimeType];
  if (!imageType.signature(bytes)) {
    throw new HttpError(422, "INVALID_IMAGE", "Isi file tidak sesuai dengan format gambar.");
  }
  return { bytes, mimeType, extension: imageType.extension };
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await withErrors(response, async () => {
    assertMethod(request, ["POST"]);
    const actor = await requireActor(request, "ADMIN");
    const input = parseBody(request, inputSchema);
    const image = decodeImage(input.image_data_url);

    const { data: currentItem, error: itemError } = await serviceClient
      .from("items")
      .select("id,image_path")
      .eq("id", input.item_id)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!currentItem) throw new HttpError(404, "ITEM_NOT_FOUND", "Barang tidak ditemukan.");

    const nextPath = `${input.item_id}/${crypto.randomUUID()}.${image.extension}`;
    const { error: uploadError } = await serviceClient.storage
      .from("item-images")
      .upload(nextPath, image.bytes, { contentType: image.mimeType, cacheControl: "31536000", upsert: false });
    if (uploadError) throw new HttpError(400, "IMAGE_UPLOAD_FAILED", "Gambar tidak dapat diunggah ke penyimpanan.");

    const { data, error: updateError } = await serviceClient.schema("api").rpc("set_item_image", {
      actor_id: actor.id,
      item_id: input.item_id,
      image_path: nextPath,
    });
    if (updateError) {
      await serviceClient.storage.from("item-images").remove([nextPath]);
      throw updateError;
    }

    if (currentItem.image_path && currentItem.image_path !== nextPath) {
      await serviceClient.storage.from("item-images").remove([currentItem.image_path]);
    }
    response.status(200).json({ data });
  });
}
