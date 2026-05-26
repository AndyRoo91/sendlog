import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format } from "date-fns";
import { api } from "../api/client";
import type { SessionDetail, BoulderEntry, RecentCombo } from "../api/client";
import {
  SessionStrip, ModeToggle, StyleRibbonRow, GradeChip, StarBurst,
  FeedEntry, RecentChip, Ribbon, AfterCommitOverlay,
  STYLE_BY_ID, sendTypeToStyle,
} from "../ui";
import type { StyleId, CommitTick } from "../ui";

const GRADES = ["V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11"];

const STYLE_TO_SEND: Record<StyleId, string> = {
  flash: "flash", send: "redpoint", proj: "working", fall: "fall",
};

const SELECTION_MS = 6000;

function parseUTC(s: string): Date {
  return new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : s + "Z");
}

function fmtElapsed(startISO: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - parseUTC(startISO).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function timeAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return "";
  const secs = Math.max(0, Math.floor((now - parseUTC(iso).getTime()) / 1000));
  if (secs < 60) return "now";
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h${rem}` : `${h}h`;
}

export default function TickSheet() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [recents, setRecents] = useState<RecentCombo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [commitTick, setCommitTick] = useState<CommitTick | null>(null);
  const [now, setNow] = useState(Date.now());
  const [leadHint, setLeadHint] = useState(false);
  const selectTimer = useRef<number | null>(null);
  const tickKey = useRef(0);

  const refreshRecents = useCallback(() => {
    api.getRecentCombos(sessionId).then(setRecents).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    api.getSession(sessionId).then(setSession);
    refreshRecents();
  }, [sessionId, refreshRecents]);

  // tick the elapsed clock once a session is running
  useEffect(() => {
    if (!session?.started_at || session.ended_at) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session?.started_at, session?.ended_at]);

  function selectGrade(g: string) {
    setSelected(g);
    if (selectTimer.current) clearTimeout(selectTimer.current);
    selectTimer.current = window.setTimeout(() => setSelected(null), SELECTION_MS);
  }

  const commit = useCallback(
    async (grade: string, styleId: StyleId) => {
      if (!session) return;
      const optimisticStart = session.started_at ?? new Date().toISOString();
      // optimistic UI
      tickKey.current += 1;
      setCommitTick({ grade, styleId, key: tickKey.current });
      setSelected(null);
      try {
        const created = await api.addBoulder(sessionId, {
          grade, send_type: STYLE_TO_SEND[styleId], attempts: null, notes: null,
        });
        setSession((s) => s && {
          ...s,
          started_at: s.started_at ?? optimisticStart,
          boulder_entries: [...s.boulder_entries, { ...created, photos: [] }],
        });
        refreshRecents();
      } catch {
        setCommitTick(null);
      }
    },
    [session, sessionId, refreshRecents]
  );

  async function startTimer() {
    const updated = await api.startSession(sessionId);
    setSession(updated);
    setNow(Date.now());
  }

  // grade → { count, latest styleId } for tallies + chip colour
  const tallies = useMemo(() => {
    const map: Record<string, { count: number; latest: StyleId; at: number }> = {};
    for (const b of session?.boulder_entries ?? []) {
      const at = b.logged_at ? parseUTC(b.logged_at).getTime() : 0;
      const cur = map[b.grade];
      if (!cur) map[b.grade] = { count: 1, latest: sendTypeToStyle(b.send_type), at };
      else {
        cur.count += 1;
        if (at >= cur.at) { cur.latest = sendTypeToStyle(b.send_type); cur.at = at; }
      }
    }
    return map;
  }, [session?.boulder_entries]);

  const feed = useMemo(() => {
    return [...(session?.boulder_entries ?? [])]
      .sort((a, b) => (parseUTC(b.logged_at ?? "").getTime()) - (parseUTC(a.logged_at ?? "").getTime()))
      .slice(0, 12);
  }, [session?.boulder_entries]);

  if (!session) return <div className="page"><p className="muted">Loading…</p></div>;

  const running = Boolean(session.started_at) && !session.ended_at;
  const hasEntries = session.boulder_entries.length > 0;
  const where = (session.location || "SESSION").toUpperCase();
  const dateLabel = format(new Date(session.date), "EEE · d MMM").toUpperCase();

  const recentCards = recents
    .filter((c) => c.kind === "boulder")
    .slice(0, 2);

  return (
    <div className="paper-plain no-scrollbar" style={{ overflow: "auto", paddingBottom: 24 }}>
      {/* Top strip */}
      {running ? (
        <SessionStrip where={where} elapsed={fmtElapsed(session.started_at!, now)} date={dateLabel} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", background: "var(--ink)", color: "var(--cream)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontFamily: "var(--font-banner)", fontSize: 11, color: "var(--mustard)", letterSpacing: "0.1em" }}>★ NEW SESSION</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{where}</div>
          </div>
          <button onClick={startTimer} style={{ background: "var(--red)", color: "var(--cream)", boxShadow: "3px 3px 0 var(--mustard)" }}>
            ● START TIMER
          </button>
        </div>
      )}

      <ModeToggle active="boulder" onChange={(m) => setLeadHint(m === "lead")} />
      {leadHint && (
        <div style={{ padding: "0 16px 4px" }}>
          <p className="muted" style={{ fontSize: 12 }}>
            Lead quick-log lands next. For now, log routes in{" "}
            <Link to={`/sessions/${sessionId}/edit`}>Full Log ↗</Link>.
          </p>
        </div>
      )}

      {/* Recents */}
      {recentCards.length > 0 && (
        <div style={{ padding: "4px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.1em" }}>★ +1 A RECENT</div>
            <div style={{ flex: 1, height: 0, borderTop: "2px dashed var(--ink-2)", opacity: 0.4 }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {recentCards.map((c, i) => {
              const st = STYLE_BY_ID[sendTypeToStyle(c.send_type)];
              return (
                <RecentChip
                  key={i}
                  grade={c.grade}
                  style={st.label}
                  color={st.color}
                  text={st.text}
                  onClick={() => commit(c.grade, sendTypeToStyle(c.send_type))}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Tap a grade */}
      <div style={{ padding: "14px 16px 0", textAlign: "center" }}>
        <Ribbon color={selected ? "var(--red)" : "var(--mustard)"} textColor={selected ? "var(--cream)" : "var(--ink)"}>
          {selected ? `★ ${selected} — PICK A STYLE ★` : "★ TAP A GRADE ★"}
        </Ribbon>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: "12px 18px 4px" }}>
        {GRADES.map((g) => {
          const t = tallies[g];
          const isSel = selected === g;
          const color = t ? STYLE_BY_ID[t.latest].color : "var(--cream)";
          return (
            <div key={g} style={{ display: "flex", justifyContent: "center", position: "relative" }}>
              {isSel && (
                <div style={{ position: "absolute", inset: -12, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                  <StarBurst size={96} color="var(--red)" />
                </div>
              )}
              <div style={{ position: "relative", zIndex: 1, transform: isSel ? "scale(1.06)" : "none", transition: "transform 160ms ease" }}>
                <GradeChip grade={g} color={color} tally={t?.count ?? 0} onClick={() => selectGrade(g)} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Style row */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 11, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 8 }}>
          THEN — HOW'D IT GO?
        </div>
        <div style={{ opacity: selected ? 1 : 0.45, transition: "opacity 160ms ease", pointerEvents: selected ? "auto" : "none" }}>
          <StyleRibbonRow onPick={(styleId) => selected && commit(selected, styleId)} />
        </div>
      </div>

      {/* Feed or empty encouragement */}
      {hasEntries ? (
        <div style={{ padding: "18px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.1em" }}>
              THIS SESSION · {session.boulder_entries.length} TICKS
            </div>
            <div style={{ flex: 1, height: 0, borderTop: "2px dashed var(--ink-2)", opacity: 0.4 }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {feed.map((b: BoulderEntry) => {
              const st = STYLE_BY_ID[sendTypeToStyle(b.send_type)];
              return (
                <FeedEntry key={b.id} grade={b.grade} style={st.label} color={st.color} text={st.text} time={timeAgo(b.logged_at, now)} />
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ padding: "26px 28px 0", textAlign: "center" }}>
          <div style={{ fontFamily: "var(--font-hand)", fontSize: 18, color: "var(--ink-2)", transform: "rotate(-1deg)", display: "inline-block" }}>
            empty session.<br />
            <span style={{ color: "var(--red)" }}>go climb something.</span>
          </div>
        </div>
      )}

      {/* Full log link */}
      <div style={{ padding: "22px 16px 0", textAlign: "center" }}>
        <Link to={`/sessions/${sessionId}/edit`} style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.06em" }}>
          FULL LOG · WARMUP, LEAD, BOARD ↗
        </Link>
      </div>

      <AfterCommitOverlay tick={commitTick} onDone={() => setCommitTick(null)} />
    </div>
  );
}
