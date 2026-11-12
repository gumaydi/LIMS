import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const hasSupabaseConfig = Boolean(url && publishableKey);

export const supabase = createClient(
  url ?? "https://configuration-required.supabase.co",
  publishableKey ?? "configuration-required-publishable-key-000000000000",
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } },
);
