import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, addDays } from "date-fns";
import { api } from "../api/client";
import type { PlanDetail, PlannedSession } from "../api/client";
import { day, planWeek } from "../lib/plan";
import { onKey } from "../lib/a11y";
import { Ribbon } from "../ui";

// Full plan view (Phase R2): the Dashboard card shows only this week — this
// page lays out every week with its phase label and done ticks.

function Row({ s }: { s: PlannedSession }) {
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
          {format(day(s.scheduled_date), "EEE MMM d")} · {s.title}
        </div>
        {s.focus && <div className="muted" style={{ fontSize: 12, marginTop: 1 }}>{s.focus}</div>}
      </div>
    </div>
  );
}

function WeekCard({ plan, week }: { plan: PlanDetail; week: number }) {
  const start = addDays(day(plan.start_date), (week - 1) * 7);
  const end = addDays(start, 6);
  const sessions = plan.sessions.filter((s) => {
    const d = day(s.scheduled_date);
    return d >= start && d < addDays(start, 7);
  });
  const phase = plan.phases[week - 1];
  const current = week === planWeek(plan);
  const done = sessions.filter((s) => s.done).length;

  return (
    <div className="card-flat offset-ink" style={{
      padding: 14,
      borderColor: current ? "var(--sea)" : undefined,
    }}>
      <div className="gap-row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <span style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.1em" }}>
          WEEK {week}
          {phase && <span style={{ color: "var(--sea)" }}> · {phase.toUpperCase()}</span>}
          {current && (
            <span style={{
              marginLeft: 8, padding: "1px 7px", background: "var(--sea)", color: "var(--cream)",
              fontSize: 9, letterSpacing: "0.1em", boxShadow: "2px 2px 0 var(--ink)",
            }}>NOW</span>
          )}
        </span>
        <span className="muted" style={{ fontSize: 11, fontFamily: "var(--font-banner)", letterSpacing: "0.05em" }}>
          {format(start, "MMM d")} – {format(end, "MMM d")} · {done}/{sessions.length} DONE
        </span>
      </div>
      {sessions.map((s) => <Row key={s.id} s={s} />)}
    </div>
  );
}

export default function PlanPage() {
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getPlan().then(setPlan).catch(() => {}).finally(() => setLoaded(true));
  }, []);

  async function swapDeload() {
    try { setPlan(await api.deloadWeek()); } catch { /* ignore */ }
  }

  return (
    <div className="page">
      <div className="gap-row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <Link to="/" style={{ fontSize: 13 }}>← Dashboard</Link>
      </div>
      <div style={{ marginBottom: 20 }}>
        <Ribbon color="var(--cobalt)" textColor="var(--cream)">★ TRAINING PLAN ★</Ribbon>
      </div>

      {!loaded ? (
        <p className="muted">Loading…</p>
      ) : !plan ? (
        <div className="card-flat offset-ink" style={{ padding: 20 }}>
          <p className="muted" style={{ fontSize: 14 }}>
            No active plan. Start one from the Dashboard — pick a template and log against it.
          </p>
        </div>
      ) : (
        <>
          <div className="gap-row" style={{ justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontFamily: "var(--font-hand)", fontSize: 19 }}>{plan.name}</span>
            <span className="muted" style={{ fontSize: 12, fontFamily: "var(--font-banner)", letterSpacing: "0.05em" }}>
              WEEK {planWeek(plan)}/{plan.weeks} · {plan.done_count}/{plan.total_count} DONE
            </span>
          </div>

          {plan.deload_suggested && (
            <div style={{
              marginBottom: 14, padding: "7px 11px", background: "var(--red)", color: "var(--cream)",
              border: "var(--b) solid var(--ink)", boxShadow: "2px 2px 0 var(--ink)",
              fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.05em", transform: "rotate(-0.4deg)",
            }}>
              ⚠ LOAD SPIKING — EASE INTO A DELOAD WEEK
              <div role="button" tabIndex={0} onClick={swapDeload} onKeyDown={onKey(swapDeload)}
                style={{
                  marginTop: 6, padding: "4px 9px", display: "inline-block", cursor: "pointer",
                  background: "var(--cream)", color: "var(--ink)", border: "var(--b) solid var(--ink)",
                  boxShadow: "2px 2px 0 var(--ink)", fontSize: 10, letterSpacing: "0.08em",
                }}>
                SWAP THIS WEEK FOR A DELOAD →
              </div>
            </div>
          )}

          <div className="gap-col">
            {Array.from({ length: plan.weeks }, (_, i) => (
              <WeekCard key={i} plan={plan} week={i + 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
