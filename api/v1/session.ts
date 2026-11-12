import type { VercelRequest, VercelResponse } from "../_lib/vercel.js";
import { z } from "zod";
import { assertMethod, HttpError, parseBody, withErrors } from "../_lib/http.js";
import { createPasswordClient, serviceClient } from "../_lib/supabase.js";

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,32}$/),
  password: z.string().min(8).max(128),
}).strict();

const genericLoginError = () => new HttpError(401, "INVALID_CREDENTIALS", "Username atau password salah.");

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  await withErrors(response, async () => {
    assertMethod(request, ["POST"]);
    const input = parseBody(request, loginSchema);
    const { data: profile, error: profileError } = await serviceClient
      .from("profiles")
      .select("id,username,display_name,role,is_active")
      .eq("username", input.username)
      .maybeSingle();
    if (profileError || !profile?.is_active) throw genericLoginError();

    const { data: authUser, error: authUserError } = await serviceClient.auth.admin.getUserById(profile.id);
    const alias = authUser.user?.email;
    if (authUserError || !alias) throw genericLoginError();

    const passwordClient = createPasswordClient();
    const { data: sessionData, error: sessionError } = await passwordClient.auth.signInWithPassword({
      email: alias,
      password: input.password,
    });
    if (sessionError || !sessionData.session) throw genericLoginError();

    response.status(200).json({
      session: {
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
        expires_in: sessionData.session.expires_in,
        token_type: sessionData.session.token_type,
      },
      profile: {
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        role: profile.role,
        is_active: profile.is_active,
      },
    });
  });
}
