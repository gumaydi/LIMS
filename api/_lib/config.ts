import { config } from "dotenv";
import { z } from "zod";

config({ path: ".env.local", override: false, quiet: true });

const serverConfigSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SECRET_KEY: z.string().min(20),
});

export const serverConfig = serverConfigSchema.parse(process.env);
