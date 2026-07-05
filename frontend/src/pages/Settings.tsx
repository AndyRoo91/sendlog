import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../lib/auth";
import { Ribbon } from "../ui";
import { onKey } from "../lib/a11y";

/** Parse a `${status}: ${body}` error string into a friendly detail line. */
function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "that didn't stick";
  const match = raw.match(/^\d+: (.+)$/);
  if (!match) return raw;
  try {
    const parsed = JSON.parse(match[1]);
    return parsed.detail ?? match[1];
  } catch {
    return match[1];
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-flat offset-ink" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{
        fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.12em",
        color: "var(--ink)", marginBottom: 12,
      }}>{title}</div>
      {children}
    </div>
  );
}

interface FormProps {
  busy: boolean;
  error: string | null;
  ok: string | null;
}

function FormFeedback({ error, ok }: Pick<FormProps, "error" | "ok">) {
  if (!error && !ok) return null;
  return (
    <div role="status" style={{
      background: error ? "var(--red)" : "var(--sea)", color: "var(--cream)",
      padding: "6px 10px", fontFamily: "var(--font-banner)", fontSize: 11,
      letterSpacing: "0.08em", marginTop: 10, transform: "rotate(-0.4deg)",
    }}>{(error ?? ok ?? "").toUpperCase()}</div>
  );
}

function ChangePasswordForm() {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setOk(null);
    if (newPw !== confirmPw) { setError("New passwords don't match"); return; }
    setBusy(true);
    try {
      await api.changePassword(oldPw, newPw);
      setOk("Password updated.");
      setOldPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      setError(friendlyError(err));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit}>
      <label>Current password</label>
      <input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} autoComplete="current-password" required />
      <label style={{ marginTop: 6 }}>New password</label>
      <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" minLength={6} required />
      <label style={{ marginTop: 6 }}>Confirm new password</label>
      <input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" minLength={6} required />
      <button type="submit" className="btn-primary" disabled={busy} style={{ marginTop: 12 }}>
        {busy ? "Saving…" : "Update password"}
      </button>
      <FormFeedback error={error} ok={ok} />
    </form>
  );
}

function PinForm() {
  const { user, setUser } = useAuth();
  const hasPin = Boolean(user?.has_pin);

  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function refreshMe() {
    try { setUser(await api.me()); } catch { /* tolerate */ }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setOk(null);
    setBusy(true);
    try {
      await api.setPin(password, pin);
      await refreshMe();
      setOk(hasPin ? "PIN updated." : "PIN set.");
      setPassword(""); setPin("");
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  async function clear() {
    setError(null); setOk(null);
    if (!password) { setError("Password required to clear the PIN"); return; }
    setBusy(true);
    try {
      await api.clearPin(password);
      await refreshMe();
      setOk("PIN cleared.");
      setPassword("");
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save}>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {hasPin
          ? "A PIN is set. The app auto-locks after 5 minutes of inactivity — enter your PIN to unlock without re-typing your password."
          : "Set a 4–8 digit PIN to enable fast unlock after the app auto-locks."}
      </p>
      <label>Current password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      <label style={{ marginTop: 6 }}>{hasPin ? "New PIN" : "PIN"}</label>
      <input type="password" inputMode="numeric" pattern="[0-9]{4,8}" maxLength={8}
        value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        placeholder="••••" required={!hasPin || pin.length > 0} />
      <div className="gap-row" style={{ gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <button type="submit" className="btn-primary" disabled={busy || pin.length < 4}>
          {busy ? "Saving…" : hasPin ? "Update PIN" : "Set PIN"}
        </button>
        {hasPin && (
          <button type="button" className="btn-secondary" disabled={busy} onClick={clear}>
            Clear PIN
          </button>
        )}
      </div>
      <FormFeedback error={error} ok={ok} />
    </form>
  );
}

function FeedSharingForm() {
  const { user, setUser } = useAuth();
  const sharing = user?.share_to_feed ?? true;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setError(null);
    setBusy(true);
    try {
      const updated = await api.setFeedSharing(!sharing);
      setUser(updated);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        {sharing
          ? "Your sessions and achievements appear in the shared feed for everyone on this sendlog."
          : "You're hidden from the shared feed — nobody sees your activity. You can still see theirs."}
      </p>
      <div role="button" tabIndex={0} aria-pressed={sharing}
        onClick={busy ? undefined : toggle} onKeyDown={onKey(() => { if (!busy) toggle(); })}
        className="chunky"
        style={{
          display: "inline-block", padding: "8px 14px", cursor: busy ? "default" : "pointer",
          fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.08em",
          color: "var(--cream)", background: sharing ? "var(--sea)" : "var(--ink-2)",
          boxShadow: "3px 3px 0 var(--ink)", opacity: busy ? 0.6 : 1,
        }}>
        {sharing ? "★ SHARING — ON" : "SHARING — OFF"}
      </div>
      <FormFeedback error={error} ok={null} />
    </div>
  );
}

function WeeklyGoalsForm() {
  const { user, setUser } = useAuth();
  const [sessionGoal, setSessionGoal] = useState(user?.weekly_session_goal?.toString() ?? "");
  const [tickGoal, setTickGoal] = useState(user?.weekly_tick_goal?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setOk(null); setBusy(true);
    try {
      const updated = await api.setGoals({
        weekly_session_goal: sessionGoal === "" ? null : Number(sessionGoal),
        weekly_tick_goal: tickGoal === "" ? null : Number(tickGoal),
      });
      setUser(updated);
      setSessionGoal(updated.weekly_session_goal?.toString() ?? "");
      setTickGoal(updated.weekly_tick_goal?.toString() ?? "");
      setOk("Goals saved.");
    } catch (err) { setError(friendlyError(err)); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={save}>
      <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
        A progress ring on your Dashboard fills as you climb each week (Mon–Sun). Leave blank to hide a ring.
      </p>
      <div className="grid-2">
        <div>
          <label>Sessions / week</label>
          <input type="number" inputMode="numeric" min={0} value={sessionGoal}
            onChange={(e) => setSessionGoal(e.target.value)} placeholder="e.g. 3" />
        </div>
        <div>
          <label>Ticks / week</label>
          <input type="number" inputMode="numeric" min={0} value={tickGoal}
            onChange={(e) => setTickGoal(e.target.value)} placeholder="e.g. 40" />
        </div>
      </div>
      <button type="submit" className="btn-primary" disabled={busy} style={{ marginTop: 12 }}>
        {busy ? "Saving…" : "Save goals"}
      </button>
      <FormFeedback error={error} ok={ok} />
    </form>
  );
}

interface SettingsProps {
  onLockNow: () => void;
}

export default function Settings({ onLockNow }: SettingsProps) {
  const { user, logout } = useAuth();
  if (!user) return null;

  const hasPin = user.has_pin;
  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <Ribbon color="var(--cobalt)" textColor="var(--cream)">★ SETTINGS ★</Ribbon>
      </div>

      <Section title={`SIGNED IN AS ${user.username.toUpperCase()}`}>
        <div className="gap-row" style={{ gap: 8, flexWrap: "wrap" }}>
          {hasPin && (
            <div role="button" tabIndex={0} className="chunky"
              onClick={onLockNow} onKeyDown={onKey(onLockNow)}
              style={{
                padding: "8px 14px", background: "var(--mustard)", color: "var(--ink)",
                fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.08em",
                boxShadow: "3px 3px 0 var(--ink)", cursor: "pointer",
              }}>
              🔒 LOCK NOW
            </div>
          )}
          <div role="button" tabIndex={0} className="chunky"
            onClick={logout} onKeyDown={onKey(logout)}
            style={{
              padding: "8px 14px", background: "var(--red)", color: "var(--cream)",
              fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.08em",
              boxShadow: "3px 3px 0 var(--ink)", cursor: "pointer",
            }}>
            LOG OUT
          </div>
        </div>
      </Section>

      <Section title="GYMS">
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Define your regular gyms and their walls, then tag sessions to them.
        </p>
        <Link to="/gyms" style={{ textDecoration: "none" }}>
          <div className="chunky" style={{
            display: "inline-block", padding: "8px 14px", cursor: "pointer",
            fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.08em",
            color: "var(--cream)", background: "var(--cobalt)", boxShadow: "3px 3px 0 var(--ink)",
          }}>
            🧗 MANAGE GYMS →
          </div>
        </Link>
      </Section>

      <Section title="WEEKLY GOALS"><WeeklyGoalsForm /></Section>
      <Section title="SHARED FEED"><FeedSharingForm /></Section>
      <Section title="CHANGE PASSWORD"><ChangePasswordForm /></Section>
      <Section title={hasPin ? "PIN" : "SET A PIN"}><PinForm /></Section>
    </div>
  );
}
