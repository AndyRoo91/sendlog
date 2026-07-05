import { useEffect, useMemo, useRef, useState } from "react";
import { onKey } from "../lib/a11y";
import { useNavigate, useParams } from "react-router-dom";
import { fmtDay, parseUTC } from "../lib/dates";
import { toPng } from "html-to-image";
import { api } from "../api/client";
import type { SessionDetail, BoulderEntry, LeadRouteEntry } from "../api/client";
import { Ribbon, STYLE_BY_ID, sendTypeToStyle, Crag } from "../ui";
import type { CragState } from "../ui";
import { BOULDER_GRADES, LEAD_GRADE_OPTIONS } from "../lib/grades";
import type { GradeSystem } from "../lib/grades";

type AnyEntry = (BoulderEntry | LeadRouteEntry) & { grade_system?: string };

const SEND_STYLES = new Set(["flash", "send", "onsight", "toprope"]);

function fmtDuration(start?: string | null, end?: string | null, fallbackMin?: number | null): string {
  if (start && end) {
    const secs = Math.max(0, Math.floor((parseUTC(end).getTime() - parseUTC(start).getTime()) / 1000));
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  if (fallbackMin) return `${Math.floor(fallbackMin / 60)}:${String(fallbackMin % 60).padStart(2, "0")}:00`;
  return "—";
}
function orderOf(e: AnyEntry): number {
  if (e.grade_system && e.grade_system !== "vscale") {
    return (LEAD_GRADE_OPTIONS[e.grade_system as GradeSystem] ?? []).indexOf(e.grade);
  }
  return BOULDER_GRADES.indexOf(e.grade);
}

export default function Summary() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);
  const navigate = useNavigate();
  const certRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    api.getSession(sessionId).then((s) => {
      setSession(s);
      setNotes(s.notes ?? "");
      setMood(s.mood ?? null);
    });
  }, [sessionId]);

  async function setMoodPersisted(m: number) {
    const next = mood === m ? null : m;   // tap-again clears
    setMood(next);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
    try { await api.patchSession(sessionId, { mood: next }); } catch { /* eventual */ }
  }

  const all: AnyEntry[] = useMemo(() => {
    if (!session) return [];
    return [
      ...session.boulder_entries.map((b) => ({ ...b, grade_system: "vscale" })),
      ...session.lead_route_entries,
    ];
  }, [session]);

  const stats = useMemo(() => {
    const sends = all.filter((e) => SEND_STYLES.has(sendTypeToStyle(e.send_type)));
    const flashes = all.filter((e) => sendTypeToStyle(e.send_type) === "flash");
    const top = sends.length ? sends.reduce((a, b) => (orderOf(b) > orderOf(a) ? b : a)) : null;

    // pyramid: group by grade label, count + latest style colour
    const byGrade: Record<string, { count: number; color: string; ord: number }> = {};
    for (const e of all) {
      const st = STYLE_BY_ID[sendTypeToStyle(e.send_type)];
      const g = byGrade[e.grade];
      if (!g) byGrade[e.grade] = { count: 1, color: st.color, ord: orderOf(e) };
      else { g.count += 1; g.color = st.color; }
    }
    const pyramid = Object.entries(byGrade)
      .map(([grade, v]) => ({ grade, ...v }))
      .sort((a, b) => b.ord - a.ord)
      .slice(0, 7);

    return { sends: sends.length, flashes: flashes.length, top: top?.grade ?? "—", pyramid };
  }, [all]);

  async function share() {
    if (!certRef.current) return;
    setSharing(true);
    try {
      const dataUrl = await toPng(certRef.current, { pixelRatio: 2, backgroundColor: "#f0e4c8" });
      const a = document.createElement("a");
      a.download = `sendlog-${session?.date ?? "session"}.png`;
      a.href = dataUrl;
      a.click();
    } finally { setSharing(false); }
  }

  async function done() {
    if (session && notes !== (session.notes ?? "")) {
      await api.patchSession(sessionId, { notes: notes || null });
    }
    navigate("/");
  }

  const MOOD_OPTIONS: { value: number; emoji: string; label: string }[] = [
    { value: 1, emoji: "😩", label: "COOKED" },
    { value: 2, emoji: "😕", label: "FLAT" },
    { value: 3, emoji: "🙂", label: "OK" },
    { value: 4, emoji: "😎", label: "SENDY" },
    { value: 5, emoji: "🔥", label: "FIRE" },
  ];

  if (!session) return <div className="page"><p className="muted">Loading…</p></div>;

  const maxCount = Math.max(1, ...stats.pyramid.map((p) => p.count));
  const summaryState: CragState = stats.sends > 0 ? "stoked" : "shakeoff";

  return (
    <div className="paper-plain no-scrollbar" style={{ overflow: "auto", paddingBottom: 24 }}>
      <div style={{ height: 16, background: "var(--ink)" }} />
      <div style={{ padding: "20px 16px 0", textAlign: "center" }}>
        <Ribbon color="var(--red)" font="display">★ SESSION DONE ★</Ribbon>
      </div>

      {/* Tick certificate (captured for share) */}
      <div ref={certRef} style={{ margin: "16px 14px 0", background: "var(--cream)", border: "var(--bw) solid var(--ink)", boxShadow: "6px 6px 0 var(--ink)", padding: "16px 14px", position: "relative" }}>
        <div style={{ position: "absolute", top: -2, left: 0, right: 0, height: 8, background: "repeating-linear-gradient(90deg, var(--paper) 0 6px, transparent 6px 12px)" }} />

        {/* Crag — celebrates or shakes off, never sad */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 14 }}>
          <Crag state={summaryState} size={200} showBg={false} uid="summary-cert" />
          <div style={{
            fontFamily: "var(--font-hand)", fontSize: 22,
            color: summaryState === "stoked" ? "var(--red)" : "var(--sea)",
            transform: "rotate(-1deg)",
          }}>
            {summaryState === "stoked" ? "filthy session!" : "shake it off — go again"}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <div style={{ fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.1em" }}>{fmtDay(session.date, "EEE · d MMM").toUpperCase()}</div>
          <div style={{ fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.1em", color: "var(--ink-2)" }}>{(session.location || "").toUpperCase()}</div>
        </div>
        <div className="misreg-lg" style={{ fontFamily: "var(--font-display)", fontSize: 36, lineHeight: 1, marginBottom: 14 }}>
          {fmtDuration(session.started_at, session.ended_at, session.duration_minutes)}
        </div>

        <div className="rough-rule" style={{ backgroundColor: "var(--ink)" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[{ n: String(stats.sends), l: "SENDS" }, { n: String(stats.flashes), l: "FLASH" }, { n: stats.top, l: "TOP" }].map((s, i) => (
            <div key={i} style={{ padding: "12px 6px", textAlign: "center", borderRight: i < 2 ? "2px solid var(--ink)" : "none" }}>
              <div className="misreg" style={{ fontFamily: "var(--font-display)", fontSize: 28, lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.1em", marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div className="rough-rule rough-rule-b" style={{ backgroundColor: "var(--ink)" }} />

        <div style={{ padding: "14px 0 4px" }}>
          <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 8, textAlign: "center" }}>BY GRADE</div>
          {stats.pyramid.length === 0 && <p className="muted" style={{ fontSize: 13, textAlign: "center" }}>No ticks logged.</p>}
          {stats.pyramid.map((row) => (
            <div key={row.grade} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
              <div style={{ width: 40, fontFamily: "var(--font-display)", fontSize: 15, textAlign: "right" }}>{row.grade}</div>
              <div style={{ flex: 1, height: 22, background: "var(--paper-2)", border: "var(--b) solid var(--ink)", position: "relative" }}>
                <div style={{ width: `${(row.count / maxCount) * 100}%`, height: "100%", background: row.color, borderRight: "var(--b) solid var(--ink)" }} />
              </div>
              <div style={{ width: 24, fontFamily: "var(--font-display)", fontSize: 14 }}>×{row.count}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{
            fontFamily: "var(--font-banner)", fontSize: 10, color: "var(--ink-2)",
            letterSpacing: "0.1em", textAlign: "center", marginBottom: 6,
          }}>HOW DID IT FEEL?</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            {MOOD_OPTIONS.map((m) => {
              const active = mood === m.value;
              return (
                <div key={m.value} role="button" tabIndex={0}
                  className={m.value % 2 ? "wonk" : "wonk-2"}
                  aria-label={`Mood: ${m.label}`} aria-pressed={active}
                  onClick={() => setMoodPersisted(m.value)}
                  onKeyDown={onKey(() => setMoodPersisted(m.value))}
                  style={{
                    border: "var(--b) solid var(--ink)",
                    background: active ? "var(--mustard)" : "var(--cream)",
                    boxShadow: active ? "2px 2px 0 var(--ink)" : "none",
                    padding: "6px 0 4px", textAlign: "center", cursor: "pointer",
                    transform: active ? "translate(-1px, -1px)" : "none",
                    transition: "transform 80ms ease",
                  }}>
                  <div style={{ fontSize: 22, lineHeight: 1 }}>{m.emoji}</div>
                  <div style={{
                    fontFamily: "var(--font-banner)", fontSize: 8, letterSpacing: "0.06em",
                    marginTop: 3, color: "var(--ink)",
                  }}>{m.label}</div>
                </div>
              );
            })}
          </div>
        </div>

        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="how'd it feel?"
          style={{ marginTop: 14, background: "var(--mustard)", border: "var(--b) solid var(--ink)", fontFamily: "var(--font-hand)", fontSize: 16, color: "var(--ink)", minHeight: 48 }} />
      </div>

      <div style={{ padding: "20px 16px 0", display: "flex", gap: 8 }}>
        <div role="button" tabIndex={sharing ? -1 : 0} aria-disabled={sharing}
          className="chunky" onClick={sharing ? undefined : share} onKeyDown={sharing ? undefined : onKey(share)}
          style={{ flex: 1, padding: "12px 0", textAlign: "center", fontSize: 13, background: "var(--cream)", boxShadow: "3px 3px 0 var(--ink)", opacity: sharing ? 0.6 : 1 }}>
          {sharing ? "RENDERING…" : "SHARE"}
        </div>
        <div role="button" tabIndex={0} className="chunky" onClick={done} onKeyDown={onKey(done)}
          style={{ flex: 1, padding: "12px 0", textAlign: "center", fontSize: 13, background: "var(--ink)", color: "var(--mustard)", boxShadow: "3px 3px 0 var(--red)" }}>
          DONE
        </div>
      </div>
    </div>
  );
}
