import { useEffect, useState } from "react";
import { format, startOfWeek, addDays } from "date-fns";
import { api } from "../api/client";
import type { PlanDetail, PlanTemplate, PlannedSession } from "../api/client";
import { onKey } from "../lib/a11y";

/** "2026-06-08" → Date at local midnight (no UTC drift). */
function day(iso: string): Date { return new Date(iso + "T00:00:00"); }

function planWeek(plan: PlanDetail): number {
  const start = day(plan.start_date);
  const elapsed = Math.floor((Date.now() - start.getTime()) / (7 * 86400_000));
  return Math.min(plan.weeks, Math.max(1, elapsed + 1));
}

function SessionRow({ s }: { s: PlannedSession }) {
  return (
    <div className="gap-row" style={{ gap: 9, alignItems: "flex-start", marginTop: 8 }}>
      <span aria-hidden="true" style={{
        flex: "0 0 auto", width: 18, height: 18, borderRadius: "50%", marginTop: 1,
        border: "2px solid var(--ink)", background: s.done ? "var(--sea)" : "transparent",
        color: "var(--cream)", fontSize: 11, lineHeight: "15px", textAlign: "center",
      }}>{s.done ? "✓" : ""}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.04em",
          color: s.done ? "var(--ink-2)" : "var(--ink)" }}>
          {format(day(s.scheduled_date), "EEE")} · {s.title}
        </div>
        {s.focus && <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{s.focus}</div>}
      </div>
    </div>
  );
}

function StartFlow({ templates, onStarted }: {
  templates: PlanTemplate[]; onStarted: (p: PlanDetail) => void;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const [start, setStart] = useState(format(new Date(), "yyyy-MM-dd"));
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!pick) return;
    setBusy(true);
    try { onStarted(await api.createPlan(pick, start)); }
    finally { setBusy(false); }
  }

  return (
    <div className="gap-col" style={{ marginTop: 4 }}>
      {templates.map((t) => {
        const active = pick === t.key;
        return (
          <div key={t.key} role="button" tabIndex={0} aria-pressed={active}
            onClick={() => setPick(t.key)} onKeyDown={onKey(() => setPick(t.key))}
            style={{
              padding: "10px 12px", cursor: "pointer",
              border: "var(--b) solid var(--ink)",
              background: active ? "var(--mustard)" : "transparent",
              boxShadow: active ? "2px 2px 0 var(--ink)" : "none",
            }}>
            <div style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.05em" }}>{t.name}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>{t.description}</div>
            <div className="muted" style={{ fontSize: 11, marginTop: 4, fontFamily: "var(--font-banner)", letterSpacing: "0.05em" }}>
              {t.weeks} WEEKS · {t.sessions_per_week}×/WK
            </div>
          </div>
        );
      })}
      <div className="gap-row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
        <label style={{ margin: 0 }}>Start</label>
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: "auto" }} />
        <button className="btn-primary btn-sm" onClick={go} disabled={!pick || busy}>
          {busy ? "Starting…" : "Start plan →"}
        </button>
      </div>
    </div>
  );
}

export default function TrainingPlan() {
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [templates, setTemplates] = useState<PlanTemplate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => { api.getPlan().then(setPlan).catch(() => {}).finally(() => setLoaded(true)); }, []);

  async function openStart() {
    setStarting(true);
    if (templates.length === 0) {
      try { setTemplates(await api.listPlanTemplates()); } catch { /* ignore */ }
    }
  }

  async function abandon() {
    if (!confirm("Abandon this plan? Your logged sessions stay.")) return;
    try { await api.deletePlan(); setPlan(null); setStarting(false); } catch { /* ignore */ }
  }

  if (!loaded) return null;

  // --- Active plan ---
  if (plan) {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    const sunday = addDays(monday, 7);
    const thisWeek = plan.sessions.filter((s) => {
      const d = day(s.scheduled_date);
      return d >= monday && d < sunday;
    });
    const upcoming = plan.sessions.find((s) => day(s.scheduled_date) >= new Date());

    return (
      <div className="card-flat offset-ink" style={{ padding: 16, marginBottom: 16 }}>
        <div className="gap-row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.12em" }}>★ TRAINING PLAN</div>
          <span role="button" tabIndex={0} onClick={abandon} onKeyDown={onKey(abandon)}
            className="muted" style={{ fontSize: 11, cursor: "pointer", fontStyle: "italic" }}>abandon</span>
        </div>
        <div className="gap-row" style={{ justifyContent: "space-between", alignItems: "baseline", marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-hand)", fontSize: 17 }}>{plan.name}</span>
          <span className="muted" style={{ fontSize: 12, fontFamily: "var(--font-banner)", letterSpacing: "0.05em" }}>
            WEEK {planWeek(plan)}/{plan.weeks} · {plan.done_count}/{plan.total_count} DONE
          </span>
        </div>

        {thisWeek.length > 0 ? (
          <div style={{ marginTop: 6 }}>{thisWeek.map((s) => <SessionRow key={s.id} s={s} />)}</div>
        ) : upcoming ? (
          <div style={{ marginTop: 8 }}>
            <div className="muted" style={{ fontSize: 11, fontFamily: "var(--font-banner)", letterSpacing: "0.06em" }}>NEXT UP</div>
            <SessionRow s={upcoming} />
          </div>
        ) : (
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>Plan complete — nice work. Abandon it to start another.</p>
        )}
      </div>
    );
  }

  // --- No plan: prompt / start flow ---
  return (
    <div className="card-flat offset-ink" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.12em", marginBottom: starting ? 12 : 8 }}>
        ★ TRAINING PLAN
      </div>
      {starting ? (
        <StartFlow templates={templates} onStarted={(p) => { setPlan(p); setStarting(false); }} />
      ) : (
        <div className="gap-row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="muted" style={{ fontSize: 13 }}>Follow a structured block — pick a template and log against it.</span>
          <button className="btn-primary btn-sm" onClick={openStart}>Start a plan</button>
        </div>
      )}
    </div>
  );
}
