import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { onKey } from "../lib/a11y";

// First-run onboarding (Phase R2): a dismissible 3-step checklist for empty
// accounts. Every step is derived from existing data — no new backend state.
// Dismissal is a localStorage flag; the card also disappears for good once
// all three steps are done.

const DISMISS_KEY = "sendlog.onboardingDismissed";

function isDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

function Step({ done, title, hint, to }: { done: boolean; title: string; hint: string; to: string }) {
  const body = (
    <div className="gap-row" style={{ gap: 9, alignItems: "flex-start", marginTop: 8 }}>
      <span aria-hidden="true" style={{
        flex: "0 0 auto", width: 18, height: 18, borderRadius: "50%", marginTop: 1,
        border: "2px solid var(--ink)", background: done ? "var(--sea)" : "transparent",
        color: "var(--cream)", fontSize: 11, lineHeight: "15px", textAlign: "center",
      }}>{done ? "✓" : ""}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.04em",
          color: done ? "var(--ink-2)" : "var(--ink)" }}>
          {title}{!done && <span aria-hidden="true" className="muted" style={{ marginLeft: 6 }}>↗</span>}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{hint}</div>
      </div>
    </div>
  );
  return done ? body : (
    <Link to={to} style={{ textDecoration: "none", color: "inherit", display: "block" }}>{body}</Link>
  );
}

export default function Onboarding({ sessionCount }: { sessionCount: number }) {
  const [dismissed, setDismissed] = useState(isDismissed);
  const [hasGym, setHasGym] = useState<boolean | null>(null);
  const [hasGoal, setHasGoal] = useState<boolean | null>(null);

  useEffect(() => {
    if (dismissed) return;
    api.listGyms().then((gs) => setHasGym(gs.length > 0)).catch(() => {});
    api.getWeeklyProgress()
      .then((wp) => setHasGoal(wp.session_goal != null || wp.tick_goal != null))
      .catch(() => {});
  }, [dismissed]);

  const hasSession = sessionCount > 0;
  // Wait for both lookups so the card doesn't flash half-checked, and hide it
  // entirely once the checklist is complete.
  if (dismissed || hasGym === null || hasGoal === null) return null;
  if (hasGym && hasGoal && hasSession) return null;

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* best-effort */ }
  }

  return (
    <div className="card-flat offset-ink" style={{ padding: 16, marginBottom: 16, borderColor: "var(--mustard)" }}>
      <div className="gap-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.12em" }}>
          ★ GETTING STARTED
        </div>
        <span role="button" tabIndex={0} aria-label="Dismiss getting started" className="muted"
          onClick={dismiss} onKeyDown={onKey(dismiss)}
          style={{ fontSize: 13, cursor: "pointer" }}>×</span>
      </div>
      <Step done={!!hasGym} to="/gyms"
        title="ADD YOUR GYM" hint="walls + set tracking hang off it" />
      <Step done={!!hasGoal} to="/settings"
        title="SET A WEEKLY GOAL" hint="sessions or ticks — the rings live here on the dashboard" />
      <Step done={hasSession} to="/sessions/new"
        title="LOG YOUR FIRST SESSION" hint="start one at the gym and tick as you climb" />
    </div>
  );
}
