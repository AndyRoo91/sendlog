import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Achievement, BuddyState, SessionSummary } from "../api/client";
import { localDay, fmtDay, fmtTime, parseUTC, daysAgo } from "../lib/dates";
import { ICON, Ribbon, Crag, lobbyCondition, asSpecies } from "../ui";
import type { CragState } from "../ui";
import { useAuth } from "../lib/auth";
import { isDuckOn, setDuck, useDuckMode, useKonami } from "../lib/duckMode";
import WeeklyGoals from "../components/WeeklyGoals";
import TrainingPlan from "../components/TrainingPlan";
import Onboarding from "../components/Onboarding";

interface StatProps {
  label: string;
  value: string;
  color: string;
  rotate?: number;
  /** Off-register plate colour behind the numeral (P1); contrast the numeral. */
  misreg?: string;
}

function Stat({ label, value, color, rotate = 0, misreg = "var(--red)" }: StatProps) {
  return (
    <div className="card-flat offset-ink" style={{
      padding: "12px 10px", textAlign: "center", transform: `rotate(${rotate}deg)`,
      background: "var(--cream)",
    }}>
      <div style={{
        fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.08em",
        color: "var(--ink-2)", marginBottom: 6, textTransform: "uppercase",
      }}>{label}</div>
      <div className="misreg-lg" style={{
        fontFamily: "var(--font-display)", fontSize: 30, lineHeight: 1, color,
        ["--misreg" as string]: misreg,
      }}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [buddy, setBuddy] = useState<BuddyState | null>(null);
  const { user } = useAuth();
  const duck = useDuckMode();

  useEffect(() => {
    api.listSessions().then((s) => { setSessions(s); setLoading(false); });
    api.listAchievements().then(setAchievements).catch(() => {});
    api.getBuddy().then(setBuddy).catch(() => {});
  }, []);

  // Konami → toggle duck mode. Quick double-vibrate so something happens on phones too.
  const onKonami = useCallback(() => {
    const next = !isDuckOn();
    setDuck(next);
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([40, 60, 40]);
    }
  }, []);
  useKonami(onKonami);

  const recent = sessions.slice(0, 5);
  const totalSessions = sessions.length;
  // A session that's been started but not ended is still "running" — surface it
  // so you can jump straight back to logging instead of hunting the list.
  const runningSession = sessions.find((s) => s.started_at && !s.ended_at) ?? null;
  const thisMonth = sessions.filter((s) => {
    const d = localDay(s.date);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const last = sessions[0] ? fmtDay(sessions[0].date, "MMM d") : "—";

  // Lobby condition — count sessions that had started_at within the last 14 days.
  const sessions14 = sessions.filter((s) => {
    if (!s.started_at) return false;
    const ms = Date.now() - parseUTC(s.started_at).getTime();
    return ms <= 14 * 24 * 60 * 60 * 1000;
  }).length;
  const CRAG_COPY: Record<CragState, { head: string; body: string }> = {
    primed:    { head: "still on form.",   body: "keep it rolling — Crag's ready when you are." },
    training:  { head: "rebuilding!",      body: "eye of the tiger. consistency is the gain." },
    detrained: { head: "off-season, eh?",  body: "Crag's been taking it easy too. whenever you're ready, he's in." },
    stoked:    { head: "let's go!",        body: "you're sending. Crag is stoked." },
    shakeoff:  { head: "go again.",        body: "shake it off and get back on." },
    resting:   { head: "rest up.",         body: "recovery is training." },
    cooked:    { head: "cooked, eh?",      body: "arms to jelly — that's a good day's work. rest up." },
    nervous:   { head: "deep breath.",     body: "new grade nerves are normal. trust the feet." },
    focused:   { head: "dialled in.",      body: "long one today — Crag's locked in right there with you." },
  };
  // Prefer the server-computed buddy mood; fall back to the recency-only
  // heuristic if the call hasn't landed (or failed).
  const cragState: CragState =
    buddy && buddy.state in CRAG_COPY
      ? (buddy.state as CragState)
      : lobbyCondition(sessions14);

  // A training-load spike (M4 ACWR) overrides the mood copy with a deload nudge.
  const greeting = buddy?.reason === "load_spike"
    ? { head: "ease off.", body: `load's spiking (ACWR ${buddy.load_ratio?.toFixed(1) ?? "high"}). take a deload — lighter week, more rest.` }
    : CRAG_COPY[cragState];

  const daysSince = sessions[0] ? daysAgo(sessions[0].date) : null;
  const nudge: { text: string; color: string } | null =
    daysSince === null ? null
    : daysSince === 0 ? { text: "★ FRESH OFF A SEND ★", color: "var(--red)" }
    : daysSince === 1 ? { text: "★ 1 DAY SINCE YOUR LAST CLIMB ★", color: "var(--cobalt)" }
    : daysSince <= 6 ? { text: `★ ${daysSince} DAYS SINCE YOUR LAST CLIMB ★`, color: "var(--cobalt)" }
    : daysSince <= 13 ? { text: `★ ${daysSince} DAYS — TIME TO GET ON IT ★`, color: "var(--mustard)" }
    : { text: `★ ${daysSince} DAYS — GET BACK ON THE WALL ★`, color: "var(--red)" };

  return (
    <div className="page">
      <div aria-hidden="true" className="ghost-word">SENDLOG</div>
      <div className="gap-row" style={{ justifyContent: "space-between", marginBottom: 20, alignItems: "flex-start" }}>
        <Ribbon color="var(--red)" textColor="var(--cream)">★ DASHBOARD ★</Ribbon>
        <Link to="/sessions/new">
          <button className="btn-primary">+ Log Session</button>
        </Link>
      </div>

      {duck && (
        <div role="button" tabIndex={0} aria-label="Disable duck mode"
          onClick={() => setDuck(false)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDuck(false); } }}
          style={{
            background: "var(--mustard)", color: "var(--ink)", textAlign: "center",
            padding: "6px 10px", fontFamily: "var(--font-banner)", fontSize: 11,
            letterSpacing: "0.1em", marginBottom: 10, transform: "rotate(0.4deg)",
            border: "var(--b) solid var(--ink)", boxShadow: "2px 2px 0 var(--ink)",
            cursor: "pointer",
          }}>
          🦆 QUACK MODE — TAP TO TURN OFF
        </div>
      )}
      {runningSession && (
        <Link to={`/sessions/${runningSession.id}`} style={{ textDecoration: "none" }}>
          {/* No inline border: the `border` shorthand resets border-image,
              and inline wins — it would erase the rough keyline frame.
              .card-flat already provides the border. */}
          <div className="card-flat keyline" style={{
            padding: "10px 14px", marginBottom: 16, background: "var(--sea)",
            color: "var(--cream)", display: "flex", alignItems: "center", gap: 10,
            transform: "rotate(-0.5deg)", boxShadow: "3px 3px 0 var(--ink)",
            cursor: "pointer",
          }}>
            <span style={{ fontSize: 12, color: "var(--mustard)" }}>●</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.1em" }}>
                SESSION RUNNING{runningSession.location ? ` · ${runningSession.location.toUpperCase()}` : ""}
              </div>
              <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 12, opacity: 0.9 }}>
                tap to jump back in and keep logging
              </div>
            </div>
            <span style={{ fontFamily: "var(--font-banner)", fontSize: 18, color: "var(--mustard)" }}>→</span>
          </div>
        </Link>
      )}

      {!loading && <Onboarding sessionCount={sessions.length} />}
      <WeeklyGoals />
      <TrainingPlan />

      {nudge && (
        <div className="card-flat" style={{
          padding: "10px 14px", marginBottom: 16, background: nudge.color,
          color: "var(--cream)", fontFamily: "var(--font-banner)", fontSize: 12,
          letterSpacing: "0.1em", textAlign: "center", transform: "rotate(-0.6deg)",
          boxShadow: "3px 3px 0 var(--ink)",
        }}>{nudge.text}</div>
      )}

      {/* Crag greeting — lobby idle card (one animated instance per screen) */}
      {!loading && (
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "10px 12px", marginBottom: 18,
          background: "var(--cream)", border: "3px solid var(--ink)",
          boxShadow: "4px 4px 0 var(--ink)",
        }}>
          <Crag state={cragState} species={asSpecies(user?.buddy_species)} size={90} showBg={false} uid="dashboard-lobby" build={buddy?.build ?? 0} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "var(--font-hand)", fontSize: 18, color: "var(--sea)",
              lineHeight: 1.1, marginBottom: 4,
            }}>
              {greeting.head}
            </div>
            <div style={{
              fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13,
              color: "var(--ink-2)", lineHeight: 1.3,
            }}>
              {greeting.body}
            </div>
          </div>
        </div>
      )}

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 22,
        position: "relative",
      }}>
        {/* P7: coffee-ring stain — someone put a mug down on the logbook. */}
        <div aria-hidden="true" className="coffee-ring" style={{ top: -34, right: -18, transform: "rotate(24deg)" }} />
        <Stat label="Total" value={String(totalSessions)} color="var(--ink)" rotate={0.5} />
        <Stat label="This month" value={String(thisMonth)} color="var(--cobalt)" rotate={-1} />
        <Stat label="Last" value={last} color="var(--red)" rotate={0.5} misreg="var(--cobalt)" />
      </div>

      <Link to="/routes" style={{ textDecoration: "none" }}>
        <div className="card-flat offset-mustard" style={{
          display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
          marginBottom: 24, cursor: "pointer", background: "var(--ink)",
          transform: "rotate(-0.5deg)",
        }}>
          <span style={{
            display: "inline-flex", width: 36, height: 36, alignItems: "center",
            justifyContent: "center", color: "var(--mustard)",
          }}>{ICON.pin}</span>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "var(--font-display)", fontSize: 18, color: "var(--cream)",
            }}>PROJECTS</div>
            <div style={{
              fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.08em",
              color: "var(--mustard)",
            }}>HIGH-POINTS ON A ROUTE PHOTO, ACROSS SESSIONS</div>
          </div>
          <span style={{
            fontFamily: "var(--font-banner)", fontSize: 18, color: "var(--mustard)",
          }}>→</span>
        </div>
      </Link>

      {achievements.length > 0 && (
        <div className="card-flat offset-ink" style={{ padding: 16, marginBottom: 22 }}>
          <div className="section-header" style={{ marginBottom: 10 }}>
            <div style={{
              fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.12em",
              color: "var(--ink)",
            }}>★ ACHIEVEMENTS ★</div>
            <div style={{
              fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.08em",
              color: "var(--ink-2)",
            }}>
              {achievements.filter((a) => a.unlocked).length} / {achievements.length} UNLOCKED
            </div>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
            gap: 10,
          }}>
            {achievements.map((a, i) => (
              <div key={a.code} title={a.unlocked
                ? `${a.title} — ${a.description}${a.unlocked_at ? ` (unlocked ${fmtTime(a.unlocked_at, "MMM d")})` : ""}`
                : `Locked: ${a.description}`}
                className={i % 2 ? "wonk-2" : "wonk"}
                style={{
                  border: "var(--b) solid var(--ink)",
                  background: a.unlocked ? "var(--mustard)" : "var(--cream)",
                  boxShadow: a.unlocked ? "2px 2px 0 var(--ink)" : "none",
                  padding: "10px 4px 6px", textAlign: "center",
                  transform: `rotate(${(i % 2 === 0 ? -0.6 : 0.6)}deg)`,
                  opacity: a.unlocked ? 1 : 0.45,
                  filter: a.unlocked ? "none" : "grayscale(0.8)",
                  cursor: "default", userSelect: "none",
                }}
              >
                <div style={{ fontSize: 26, lineHeight: 1 }}>{a.emoji}</div>
                <div style={{
                  fontFamily: "var(--font-banner)", fontSize: 8, letterSpacing: "0.04em",
                  marginTop: 5, color: "var(--ink)", lineHeight: 1.1,
                }}>
                  {a.unlocked ? a.title.toUpperCase() : "???"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-flat offset-ink" style={{ padding: 16 }}>
        <div className="section-header">
          <div style={{
            fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.12em",
            color: "var(--ink)",
          }}>RECENT SESSIONS</div>
          <Link to="/sessions" style={{ fontSize: 12, fontFamily: "var(--font-banner)", letterSpacing: "0.08em" }}>VIEW ALL →</Link>
        </div>
        {loading && <p className="muted">chalking up…</p>}
        {!loading && recent.length === 0 && (
          <p className="muted">Nothing logged yet. <Link to="/sessions/new">Get on something →</Link></p>
        )}
        <div className="gap-col">
          {recent.map((s, i) => (
            <Link key={s.id} to={`/sessions/${s.id}`} style={{ textDecoration: "none" }}>
              <div className="card-flat" style={{
                padding: "12px 14px", cursor: "pointer",
                transform: `rotate(${i % 2 === 0 ? -0.4 : 0.3}deg)`,
                boxShadow: "2px 2px 0 var(--ink)",
              }}>
                <div className="gap-row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.06em" }}>
                      {fmtDay(s.date, "EEE · MMM d").toUpperCase()}
                    </span>
                    {s.location && (
                      <span className="muted" style={{ marginLeft: 10, fontSize: 13 }}>{s.location}</span>
                    )}
                  </div>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {s.mood != null && (
                      <span aria-label={`Mood ${s.mood} of 5`} style={{ fontSize: 16, lineHeight: 1 }}>
                        {["😩","😕","🙂","😎","🔥"][s.mood - 1] ?? ""}
                      </span>
                    )}
                    {s.duration_minutes && (
                      <span className="muted" style={{ fontSize: 13 }}>{s.duration_minutes} min</span>
                    )}
                  </span>
                </div>
                {s.notes && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{s.notes}</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
