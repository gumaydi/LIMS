import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const required = ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "ADMIN_USERNAME", "ADMIN_DISPLAY_NAME", "ADMIN_PASSWORD"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Variabel ${name} wajib diisi.`);
}

const username = process.env.ADMIN_USERNAME.trim().toLowerCase();
if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error("ADMIN_USERNAME tidak valid.");
if (process.env.ADMIN_PASSWORD.length < 12) throw new Error("ADMIN_PASSWORD minimal 12 karakter.");

const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const alias = `${randomUUID()}@internal.invalid`;
const { data: authData, error: authError } = await client.auth.admin.createUser({
  email: alias,
  password: process.env.ADMIN_PASSWORD,
  email_confirm: true,
});
if (authError || !authData.user) throw authError ?? new Error("Auth user tidak berhasil dibuat.");

const { error: profileError } = await client.from("profiles").insert({
  id: authData.user.id,
  username,
  display_name: process.env.ADMIN_DISPLAY_NAME.trim(),
  role: "ADMIN",
  created_by: null,
  updated_by: null,
});
if (profileError) {
  await client.auth.admin.deleteUser(authData.user.id);
  throw profileError;
}
console.log(`Admin @${username} berhasil dibuat.`);
