import { useState } from "react";
import { api } from "../api/client";
import type { AuthUser } from "../api/client";
import { Ribbon } from "../ui";

interface Props {
  onAuthed: (user: AuthUser) => void;
}

export default function LoginPage({ onAuthed }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = mode === "login"
        ? await api.login(username.trim(), password)
        : await api.register(username.trim(), password);
      onAuthed(user);
    } catch (err) {
      // The req() helper throws `${status}: ${text}` — the FastAPI body is JSON
      // like {"detail": "Invalid username or password"}, so try to surface that.
      const raw = err instanceof Error ? err.message : "Something went wrong";
      let friendly = raw;
      const match = raw.match(/^\d+: (.+)$/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          friendly = parsed.detail ?? match[1];
        } catch { friendly = match[1]; }
      }
      setError(friendly);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="paper-plain" style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "32px 18px",
    }}>
      <div style={{ marginBottom: 28, transform: "rotate(-2deg)" }}>
        <Ribbon color="var(--red)" font="display">★ SENDLOG ★</Ribbon>
      </div>

      <form onSubmit={handleSubmit} className="boil-frame" style={{
        width: "100%", maxWidth: 360,
        background: "var(--cream)", border: "var(--bw) solid transparent",
        boxShadow: "6px 6px 0 var(--ink)", padding: "20px 18px",
        transform: "rotate(-0.4deg)",
      }}>
        <div style={{
          display: "flex", gap: 6, marginBottom: 16,
          fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.1em",
        }}>
          {(["login", "register"] as const).map((m) => (
            <div key={m} role="button" tabIndex={0} aria-pressed={mode === m}
              className={m === "login" ? "wonk" : "wonk-2"}
              onClick={() => { setMode(m); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMode(m); } }}
              style={{
                flex: 1, padding: "8px 0", textAlign: "center", cursor: "pointer",
                border: "var(--b) solid var(--ink)",
                background: mode === m ? "var(--ink)" : "var(--paper)",
                color: mode === m ? "var(--mustard)" : "var(--ink)",
                boxShadow: mode === m ? "2px 2px 0 var(--red)" : "none",
              }}>
              {m === "login" ? "LOG IN" : "REGISTER"}
            </div>
          ))}
        </div>

        <label style={{
          fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.1em",
          color: "var(--ink-2)",
        }}>USERNAME</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none" autoComplete="username" required
          placeholder="andy"
          style={{ marginBottom: 10, fontFamily: "var(--font-hand)", fontSize: 18 }} />

        <label style={{
          fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.1em",
          color: "var(--ink-2)",
        }}>PASSWORD</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"} required
          minLength={mode === "register" ? 6 : undefined}
          style={{ marginBottom: 14, fontFamily: "var(--font-hand)", fontSize: 18 }} />

        {error && (
          <div role="alert" style={{
            background: "var(--red)", color: "var(--cream)", padding: "6px 10px",
            fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.08em",
            marginBottom: 12, transform: "rotate(-0.5deg)",
          }}>{error.toUpperCase()}</div>
        )}

        <button type="submit" className="btn-primary" disabled={submitting}
          style={{ width: "100%" }}>
          {submitting ? "…" : mode === "login" ? "LOG IN →" : "CREATE ACCOUNT →"}
        </button>
      </form>

      <div style={{
        marginTop: 18, textAlign: "center", maxWidth: 360,
        fontFamily: "var(--font-hand)", fontSize: 14, color: "var(--ink-2)",
        transform: "rotate(0.5deg)",
      }}>
        {mode === "login"
          ? "no account yet? tap REGISTER above."
          : "pick a username and a password (6+ characters)."}
      </div>
    </div>
  );
}
