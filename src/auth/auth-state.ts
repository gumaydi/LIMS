import { createContext } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "../types";

export type AuthState = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<Profile>;
  logout: () => Promise<void>;
};

export const AuthStateContext = createContext<AuthState | null>(null);
