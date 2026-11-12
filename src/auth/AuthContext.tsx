import type { Session } from "@supabase/supabase-js";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "../lib/supabase";
import type { Profile } from "../types";
import { AuthStateContext } from "./auth-state";
import { clearQueryCache } from "../lib/queryCache";

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles")
    .select("id,username,display_name,role,is_active")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession?.user?.id) {
      clearQueryCache();
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      const nextProfile = await loadProfile(nextSession.user.id);
      if (nextProfile && !nextProfile.is_active) {
        await supabase.auth.signOut({ scope: "local" });
        setProfile(null);
      } else if (nextProfile) {
        setProfile(nextProfile);
      }
    } catch (err) {
      console.error("Gagal memuat profil pengguna:", err);
      setProfile((current) => {
        if (!current) {
          setError("Profil tidak dapat dimuat. Silakan periksa koneksi atau masuk kembali.");
          void supabase.auth.signOut({ scope: "local" });
          return null;
        }
        return current;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setError("Konfigurasi Supabase belum tersedia.");
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data }) => refreshProfile(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void refreshProfile(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, [refreshProfile]);

  const login = useCallback(async (username: string, password: string): Promise<Profile> => {
    clearQueryCache();
    setError(null);
    const response = await fetch("/api/v1/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const payload = await response.json() as {
      session?: { access_token: string; refresh_token: string };
      profile?: Profile;
      error?: { message?: string };
    };
    if (!response.ok || !payload.session || !payload.profile) {
      throw new Error(payload.error?.message ?? "Username atau password salah.");
    }
    const { error: sessionError } = await supabase.auth.setSession(payload.session);
    if (sessionError) throw new Error("Sesi tidak dapat disimpan.");
    setProfile(payload.profile);
    return payload.profile;
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setProfile(null);
    clearQueryCache();
  }, []);

  const value = useMemo(() => ({ session, profile, loading, error, login, logout }), [session, profile, loading, error, login, logout]);
  return <AuthStateContext.Provider value={value}>{children}</AuthStateContext.Provider>;
}
