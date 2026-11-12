import { createClient } from "@supabase/supabase-js";
import { serverConfig } from "./config.js";

export const serviceClient = createClient(
  serverConfig.SUPABASE_URL,
  serverConfig.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

export function createPasswordClient() {
  return createClient(serverConfig.SUPABASE_URL, serverConfig.SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
