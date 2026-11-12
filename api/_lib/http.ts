import type { VercelRequest, VercelResponse } from "./vercel.js";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export function assertMethod(request: VercelRequest, allowed: readonly string[]): void {
  if (!request.method || !allowed.includes(request.method)) {
    throw new HttpError(405, "METHOD_NOT_ALLOWED", "Metode permintaan tidak didukung.");
  }
}

export function parseBody<T extends z.ZodTypeAny>(request: VercelRequest, schema: T): z.infer<T> {
  const result = schema.safeParse(request.body);
  if (!result.success) {
    const details: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join(".") || "body";
      details[field] = [...(details[field] ?? []), issue.message];
    }
    throw new HttpError(422, "VALIDATION_ERROR", "Periksa kembali data yang dikirim.", details);
  }
  return result.data;
}

export function sendError(response: VercelResponse, error: unknown): void {
  const requestId = crypto.randomUUID();
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details, requestId },
    });
    return;
  }

  const databaseError = error as { code?: string; message?: string };
  const knownStatus = databaseError.code === "23505" ? 409 : databaseError.code === "P0002" ? 404 : 400;
  if (databaseError.code && databaseError.message) {
    response.status(knownStatus).json({
      error: { code: "DATABASE_REJECTED", message: databaseError.message, requestId },
    });
    return;
  }

  console.error("Unhandled API error", { requestId, error });
  response.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Server tidak dapat memproses permintaan.", requestId },
  });
}

export async function withErrors(
  response: VercelResponse,
  handler: () => Promise<void>,
): Promise<void> {
  try {
    await handler();
  } catch (error) {
    sendError(response, error);
  }
}
