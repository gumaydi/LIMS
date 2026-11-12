import { type FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { AlertMessage } from "../components/AlertMessage";
import { useAuth } from "../hooks/useAuth";

export function LoginPage() {
  const { profile, login, error: authError } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  if (profile) return <Navigate to={profile.role === "ADMIN" ? "/admin" : "/staff"} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const nextProfile = await login(username.trim().toLowerCase(), password);
      navigate(nextProfile.role === "ADMIN" ? "/admin" : "/staff", { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Tidak dapat masuk.");
    } finally {
      setSubmitting(false);
    }
  }

  const activeMessage = error ?? authError;

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-heading">
          <p>Laboratorium</p>
          <h1 id="login-title">Masuk ke inventaris</h1>
          <span>Gunakan akun yang diberikan oleh pengelola laboratorium.</span>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            minLength={3}
            maxLength={32}
            placeholder="Contoh: admin atau staff.lab"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            placeholder="Masukkan password akun"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {activeMessage && (
            <AlertMessage
              type="error"
              message={activeMessage}
              onDismiss={() => setError(null)}
            />
          )}
          <button className="button primary" type="submit" disabled={submitting} aria-busy={submitting}>
            {submitting && <span className="button-spinner" aria-hidden="true" />}
            {submitting ? "Memeriksa akun..." : "Masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}
