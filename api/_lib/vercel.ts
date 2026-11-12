import type { IncomingMessage, ServerResponse } from "node:http";

export interface VercelRequest extends IncomingMessage {
  body: unknown;
}

export interface VercelResponse extends ServerResponse {
  json(body: unknown): VercelResponse;
  status(statusCode: number): VercelResponse;
}
