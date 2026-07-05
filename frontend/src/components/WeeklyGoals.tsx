import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { WeeklyProgress } from "../api/client";

function Ring({ value, goal, label, color }: { value: number; goal: number; label: string; color: string }) {
  const size = 88, stroke = 9, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const met = value >= goal && goal > 0;
  return (
    <div role="img" aria-label={`${label.toLowerCase()} this week: ${value} of ${goal}${met ? " — goal met" : ""}`}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div aria-hidden="true" style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(26,22,18,0.15)" strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
            style={{ transition: "stroke-dashoffset 500ms steps(4, end)" }} />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 20, lineHeight: 1, color: "var(--ink)" }}>
            {value}<span className="muted" style={{ fontSize: 13 }}>/{goal}</span>
          </span>
          {met && <span style={{ fontSize: 12, lineHeight: 1, marginTop: 1 }}>★</span>}
        </div>
      </div>
      <span style={{ fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.08em", color: "var(--ink-2)" }}>
        {label}
      </span>
    </div>
  );
}

export default function WeeklyGoals() {
  const [wp, setWp] = useState<WeeklyProgress | null>(null);

  useEffect(() => { api.getWeeklyProgress().then(setWp).catch(() => {}); }, []);

  if (!wp) return null;
  const hasGoals = wp.session_goal != null || wp.tick_goal != null;

  if (!hasGoals) {
    return (
      <div className="card-flat offset-ink" style={{ padding: "12px 16px", marginBottom: 16 }}>
        <span className="muted" style={{ fontSize: 13 }}>
          Set a <Link to="/settings">weekly goal</Link> to track your training each week.
        </span>
      </div>
    );
  }

  return (
    <div className="card-flat offset-ink" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{
        fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.12em",
        marginBottom: 12, color: "var(--ink)",
      }}>★ THIS WEEK</div>
      <div className="gap-row" style={{ gap: 28, justifyContent: "center", flexWrap: "wrap" }}>
        {wp.session_goal != null && (
          <Ring value={wp.sessions} goal={wp.session_goal} label="SESSIONS" color="var(--sea)" />
        )}
        {wp.tick_goal != null && (
          <Ring value={wp.ticks} goal={wp.tick_goal} label="TICKS" color="var(--mustard)" />
        )}
      </div>
    </div>
  );
}
