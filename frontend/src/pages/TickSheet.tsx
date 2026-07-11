import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onKey } from "../lib/a11y";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fmtDay, parseUTC } from "../lib/dates";
import { api } from "../api/client";
import type { SessionDetail, BoulderEntry, LeadRouteEntry, RecentCombo, Wall } from "../api/client";
import {
  SessionStrip, ModeToggle,
  FeedEntry, RecentChip, Ribbon, AfterCommitOverlay, AchievementOverlay, Toast,
  STYLE_BY_ID, STYLE_TO_SEND_TYPE, sendTypeToStyle,
  Crag, RestTimer, asSpecies,
} from "../ui";
import { useAuth } from "../lib/auth";
import type { StyleId, CommitTick, ClimbMode } from "../ui";
import type { Achievement } from "../api/client";
import { useToast } from "../lib/useToast";
import { enqueue, dequeue, TICK_SYNCED_EVENT } from "../lib/syncQueue";
import type { TickSyncedDetail } from "../lib/syncQueue";
import { BOULDER_GRADES, boulderGradeWindow, leadGradeWindow, gradeOrder } from "../lib/grades";
import type { GradeSystem } from "../lib/grades";
import { STANDARD_COLORS, colorName } from "../lib/holdColors";
import { lastWallId, lastColor, rememberWall, rememberColor } from "../lib/lastUsed";
import DetailSheet from "../components/DetailSheet";
import type { DetailTarget } from "../components/DetailSheet";
import GradeChipSlot from "../components/GradeChipSlot";
import StylePicker from "../components/StylePicker";

const LEAD_SYSTEMS: GradeSystem[] = ["ewbank", "yds", "french"];

// Deterministic card tilt table — cycles through feed/recent chips for a pinboard feel.
const CARD_TILTS = [-1.2, 0.8, -1.8, 1.0, -0.5, 1.5, -0.9, 0.4, -1.6, 1.1, -0.7, 1.8];
function cardTilt(i: number) { return CARD_TILTS[i % CARD_TILTS.length]; }

function fmtElapsed(startISO: string, now: number): string {
  const secs = Math.max(0, Math.floor((now - parseUTC(startISO).getTime()) / 1000));
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
function timeAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return "";
  const secs = Math.max(0, Math.floor((now - parseUTC(iso).getTime()) / 1000));
  if (secs < 60) return "now";
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), rem = m % 60;
  return rem ? `${h}h${rem}` : `${h}h`;
}

type AnyEntry = BoulderEntry | LeadRouteEntry;

export default function TickSheet() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const { user } = useAuth();
  const [recents, setRecents] = useState<RecentCombo[]>([]);
  const [mode, setMode] = useState<ClimbMode>(
    () => (localStorage.getItem("sendlog.mode") as ClimbMode) || "boulder"
  );
  const [gradeSystem, setGradeSystem] = useState<GradeSystem>(
    () => (localStorage.getItem("sendlog.leadSystem") as GradeSystem) || "ewbank"
  );
  const [routeName, setRouteName] = useState("");
  const [routeNames, setRouteNames] = useState<string[]>([]);
  const [falls, setFalls] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAllBoulder, setShowAllBoulder] = useState(false);
  const [commitTick, setCommitTick] = useState<CommitTick | null>(null);
  const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]);
  // The entry id of the most recent PB tick; FeedEntry pulses while it sits here.
  const [pbEntryId, setPbEntryId] = useState<number | null>(null);
  const pbClearTimer = useRef<number | null>(null);
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [now, setNow] = useState(Date.now());
  const [ending, setEnding] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  // Ids of optimistic entries still waiting to reach the server (negative temp
  // ids). Used to badge them and to route deletes through the queue.
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set());
  const { message: toastMsg, action: toastAction, toast, dismiss: dismissToast } = useToast();
  const confirmEndTimer = useRef<number | null>(null);
  const tickKey = useRef(0);
  // Gym walls for the session's venue + the "current wall" each tick attaches to.
  const [walls, setWalls] = useState<Wall[]>([]);
  const [currentWall, setCurrentWall] = useState<number | null>(null);
  const currentWallRef = useRef<number | null>(null);
  // Hold/circuit colour stamped on each boulder tick (sticky until changed).
  const [currentColor, setCurrentColor] = useState<string | null>(null);
  const currentColorRef = useRef<string | null>(null);
  const gymId = session?.gym_id ?? null;
  function pickWall(id: number | null) {
    setCurrentWall(id); currentWallRef.current = id;
    if (gymId != null) rememberWall(gymId, id);
  }
  function pickColor(hex: string | null) {
    setCurrentColor(hex); currentColorRef.current = hex;
    if (gymId != null) rememberColor(gymId, hex);
  }

  const refreshRecents = useCallback(() => {
    api.getRecentCombos(sessionId).then(setRecents).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    api.getSession(sessionId).then(setSession);
    refreshRecents();
    api.listRouteNames().then(setRouteNames).catch(() => {});
  }, [sessionId, refreshRecents]);

  // Load the session gym's walls so ticks can attach to a wall (gym-set tracking),
  // and restore the last wall + hold colour used at this gym (sticky context).
  useEffect(() => {
    if (gymId == null) return;
    api.listGyms()
      .then((gs) => {
        const ws = gs.find((g) => g.id === gymId)?.walls ?? [];
        setWalls(ws);
        const wall = lastWallId(gymId);
        if (wall != null && ws.some((w) => w.id === wall)) {
          setCurrentWall(wall); currentWallRef.current = wall;
        }
        const color = lastColor(gymId);
        if (color != null) {
          setCurrentColor(color); currentColorRef.current = color;
        }
      })
      .catch(() => {});
  }, [gymId]);

  useEffect(() => { localStorage.setItem("sendlog.mode", mode); }, [mode]);
  useEffect(() => { localStorage.setItem("sendlog.leadSystem", gradeSystem); }, [gradeSystem]);

  useEffect(() => {
    if (!session?.started_at || session.ended_at) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [session?.started_at, session?.ended_at]);

  // Clear any pending timers on unmount (REVIEW.md §4).
  useEffect(() => () => {
    if (confirmEndTimer.current) window.clearTimeout(confirmEndTimer.current);
    if (pbClearTimer.current) window.clearTimeout(pbClearTimer.current);
  }, []);

  // When a queued tick finally syncs in the background, swap our optimistic
  // placeholder (matched by clientId == temp id) for the real server entry.
  useEffect(() => {
    function onSynced(e: Event) {
      const d = (e as CustomEvent<TickSyncedDetail>).detail;
      if (d.sessionId !== sessionId) return;
      const tempId = Number(d.clientId);
      replaceEntry(d.kind, tempId, { ...(d.entry as AnyEntry), photos: [] });
      markPending(tempId, false);
    }
    window.addEventListener(TICK_SYNCED_EVENT, onSynced);
    return () => window.removeEventListener(TICK_SYNCED_EVENT, onSynced);
  }, [sessionId]);

  function markPending(id: number, on: boolean) {
    setPendingIds((p) => {
      const n = new Set(p);
      if (on) n.add(id); else n.delete(id);
      return n;
    });
  }

  function replaceEntry(kind: ClimbMode, oldId: number, next: AnyEntry) {
    setSession((s) => {
      if (!s) return s;
      return kind === "lead"
        ? { ...s, lead_route_entries: s.lead_route_entries.map((e) => (e.id === oldId ? next as LeadRouteEntry : e)) }
        : { ...s, boulder_entries: s.boulder_entries.map((e) => (e.id === oldId ? next as BoulderEntry : e)) };
    });
  }

  function removeLocalEntry(kind: ClimbMode, id: number) {
    setSession((s) => s && (kind === "lead"
      ? { ...s, lead_route_entries: s.lead_route_entries.filter((e) => e.id !== id) }
      : { ...s, boulder_entries: s.boulder_entries.filter((e) => e.id !== id) }));
  }

  // Selection persists until you commit or pick another grade — no auto-deselect,
  // so pausing mid-log (someone talks to you) doesn't drop your pick.
  function selectGrade(g: string) {
    setSelected((cur) => (cur === g ? null : g));
  }

  const commit = useCallback(
    async (grade: string, styleId: StyleId, opts?: { system?: GradeSystem; routeName?: string | null; falls?: number }) => {
      if (!session) return;
      const optimisticStart = session.started_at ?? new Date().toISOString();

      // Detect new session max before the entry is appended.
      const newGradeOrder = gradeOrder(mode === "boulder" ? "vscale" : (opts?.system ?? gradeSystem), grade);
      const currentEntries = mode === "lead" ? session.lead_route_entries : session.boulder_entries;
      const currentMax = currentEntries
        .filter((e) => mode === "boulder" || (e as LeadRouteEntry).grade_system === (opts?.system ?? gradeSystem))
        .map((e) => gradeOrder(mode === "boulder" ? "vscale" : (opts?.system ?? gradeSystem), e.grade))
        .reduce((a, b) => Math.max(a, b), -1);
      const isNewMax = newGradeOrder > currentMax;

      tickKey.current += 1;
      setCommitTick({ grade, styleId, key: tickKey.current, isNewMax });
      setSelected(null);
      // Haptic nudge on commit — short pulse, longer if it's a new max.
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(isNewMax ? [40, 60, 80] : 50);
      }

      const committedMode = mode;
      const wasPB = isNewMax;
      // A unique negative id stands in until the server assigns a real one. It
      // also doubles as the queue clientId so a background sync can find it.
      const tempId = -(Date.now() + tickKey.current);
      const nowISO = new Date().toISOString();
      const wallId = currentWallRef.current;
      const payload =
        committedMode === "lead"
          ? {
              route_name: opts?.routeName ?? null,
              grade,
              grade_system: opts?.system ?? gradeSystem,
              send_type: STYLE_TO_SEND_TYPE[styleId],
              attempts: 1,
              falls: opts?.falls ?? 0,
              notes: null,
              wall_id: wallId,
            }
          : { grade, send_type: STYLE_TO_SEND_TYPE[styleId], attempts: null, notes: null,
              wall_id: wallId, hold_color: currentColorRef.current };

      // Show the tick immediately — even with no signal — so logging never
      // stalls on the network. We reconcile (or roll back) once we know.
      const optimistic = { id: tempId, session_id: sessionId, ...payload, logged_at: nowISO, photos: [] };
      setSession((s) => s && {
        ...s, started_at: s.started_at ?? optimisticStart,
        ...(committedMode === "lead"
          ? { lead_route_entries: [...s.lead_route_entries, optimistic as LeadRouteEntry] }
          : { boulder_entries: [...s.boulder_entries, optimistic as BoulderEntry] }),
      });
      markPending(tempId, true);
      if (committedMode === "lead") setFalls(0);
      setRouteName(""); // clears on every commit, including from RecentChip
      if (wasPB) {
        setPbEntryId(tempId);
        if (pbClearTimer.current) window.clearTimeout(pbClearTimer.current);
        pbClearTimer.current = window.setTimeout(() => setPbEntryId(null), 3000);
      }

      try {
        const created = committedMode === "lead"
          ? await api.addLead(sessionId, payload as Parameters<typeof api.addLead>[1])
          : await api.addBoulder(sessionId, payload as Parameters<typeof api.addBoulder>[1]);
        // Swap the placeholder for the real entry.
        replaceEntry(committedMode, tempId, { ...created, photos: [] });
        markPending(tempId, false);
        if (wasPB && created.id != null) {
          setPbEntryId((cur) => (cur === tempId ? created.id! : cur));
        }
        refreshRecents();
        // Offer a quick undo — deletes the just-logged entry without hunting the feed.
        if (created.id != null) {
          const undoId = created.id;
          toast(`Logged ${grade} · ${STYLE_BY_ID[styleId].label}`, {
            label: "UNDO",
            run: async () => {
              try {
                if (committedMode === "lead") await api.deleteLead(undoId);
                else await api.deleteBoulder(undoId);
                onDeleted(committedMode, undoId);
              } catch {
                toast("Couldn't undo — remove it from the feed instead.");
              }
            },
          });
        }
        // Check for newly-unlocked achievements; queue them for the overlay.
        api.checkAchievements()
          .then((r) => {
            if (r.newly_unlocked.length > 0) {
              setAchievementQueue((q) => [...q, ...r.newly_unlocked]);
            }
          })
          .catch(() => { /* non-blocking — achievements are eventual */ });
      } catch (err) {
        if (err instanceof TypeError) {
          // Network/offline — park the tick and keep its placeholder on screen.
          enqueue({ clientId: String(tempId), sessionId, kind: committedMode, payload, queuedAt: Date.now() });
          toast("Saved offline · will sync when you're back online.", {
            label: "UNDO",
            run: () => {
              dequeue(String(tempId));
              removeLocalEntry(committedMode, tempId);
              markPending(tempId, false);
            },
          });
        } else {
          // Server rejected it — roll the placeholder back.
          removeLocalEntry(committedMode, tempId);
          markPending(tempId, false);
          setCommitTick(null);
          toast(err instanceof Error ? err.message : "that tick didn't stick — give it another go.");
        }
      }
    },
    [session, sessionId, mode, gradeSystem, refreshRecents]
  );

  async function startTimer() {
    try {
      setSession(await api.startSession(sessionId));
      setNow(Date.now());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't start timer — check your connection.");
    }
  }

  async function endSession() {
    setEnding(true);
    try {
      await api.endSession(sessionId);
      navigate(`/sessions/${sessionId}/summary`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't end session — check your connection.");
    } finally { setEnding(false); }
  }

  // End immediately when there's nothing to lose; otherwise arm a two-tap
  // confirm so a stray tap can't end a session full of ticks.
  function requestEnd() {
    const hasEntries =
      (session?.lead_route_entries.length ?? 0) + (session?.boulder_entries.length ?? 0) > 0;
    if (!hasEntries) { endSession(); return; }
    if (confirmEnd) {
      if (confirmEndTimer.current) window.clearTimeout(confirmEndTimer.current);
      setConfirmEnd(false);
      endSession();
      return;
    }
    setConfirmEnd(true);
    if (confirmEndTimer.current) window.clearTimeout(confirmEndTimer.current);
    confirmEndTimer.current = window.setTimeout(() => setConfirmEnd(false), 4000);
  }

  // --- detail sheet upsert helpers ---
  function upsertBoulder(e: BoulderEntry) {
    setSession((s) => {
      if (!s) return s;
      const exists = s.boulder_entries.some((x) => x.id === e.id);
      return { ...s, boulder_entries: exists ? s.boulder_entries.map((x) => x.id === e.id ? e : x) : [...s.boulder_entries, e] };
    });
    refreshRecents();
  }
  function upsertLead(e: LeadRouteEntry) {
    setSession((s) => {
      if (!s) return s;
      const exists = s.lead_route_entries.some((x) => x.id === e.id);
      return { ...s, lead_route_entries: exists ? s.lead_route_entries.map((x) => x.id === e.id ? e : x) : [...s.lead_route_entries, e] };
    });
    refreshRecents();
  }
  function onDeleted(kind: "boulder" | "lead", delId: number) {
    setSession((s) => s && (kind === "boulder"
      ? { ...s, boulder_entries: s.boulder_entries.filter((x) => x.id !== delId) }
      : { ...s, lead_route_entries: s.lead_route_entries.filter((x) => x.id !== delId) }));
    refreshRecents();
  }

  const entries: AnyEntry[] = (mode === "lead" ? session?.lead_route_entries : session?.boulder_entries) ?? [];
  const boulderMaxIdx = useMemo(() => {
    if (mode !== "boulder") return -1;
    return entries
      .map((e) => gradeOrder("vscale", e.grade))
      .reduce((a, b) => Math.max(a, b), -1);
  }, [entries, mode]);
  const grades = mode === "lead"
    ? leadGradeWindow(gradeSystem)
    : (showAllBoulder ? BOULDER_GRADES : boulderGradeWindow(boulderMaxIdx >= 0 ? boulderMaxIdx : null));

  const tallies = useMemo(() => {
    const map: Record<string, { count: number; latest: StyleId; at: number }> = {};
    for (const e of entries) {
      // in lead mode only count entries matching the active grade system
      if (mode === "lead" && (e as LeadRouteEntry).grade_system !== gradeSystem) continue;
      const at = e.logged_at ? parseUTC(e.logged_at).getTime() : 0;
      const cur = map[e.grade];
      if (!cur) map[e.grade] = { count: 1, latest: sendTypeToStyle(e.send_type), at };
      else { cur.count += 1; if (at >= cur.at) { cur.latest = sendTypeToStyle(e.send_type); cur.at = at; } }
    }
    return map;
  }, [entries, mode, gradeSystem]);

  const feed = useMemo(
    () => [...entries].sort((a, b) => parseUTC(b.logged_at ?? "").getTime() - parseUTC(a.logged_at ?? "").getTime()).slice(0, 12),
    [entries]
  );

  if (!session) return <div className="page"><p className="muted">chalking up…</p></div>;

  const running = Boolean(session.started_at) && !session.ended_at;
  const hasEntries = entries.length > 0;
  const where = (session.location || "SESSION").toUpperCase();
  const dateLabel = fmtDay(session.date, "EEE · d MMM").toUpperCase();
  const recentCards = recents.filter((c) => c.kind === mode).slice(0, 2);

  return (
    <div className="paper-plain no-scrollbar" style={{ overflow: "auto", paddingBottom: 110 }}>
      {/* Top strip */}
      {running ? (
        <div>
          <SessionStrip where={where} elapsed={fmtElapsed(session.started_at!, now)} date={dateLabel} />
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
            <button onClick={requestEnd} disabled={ending}
              style={{
                background: confirmEnd ? "var(--red)" : "var(--mustard)",
                color: confirmEnd ? "var(--cream)" : "var(--ink)",
                boxShadow: "3px 3px 0 var(--ink)",
              }}>
              {ending ? "ENDING…" : confirmEnd ? "● TAP AGAIN TO END" : "● END SESSION"}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", background: "var(--ink)", color: "var(--cream)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ fontFamily: "var(--font-banner)", fontSize: 11, color: "var(--mustard)", letterSpacing: "0.1em" }}>★ NEW SESSION</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{where}</div>
          </div>
          <button onClick={startTimer} style={{ background: "var(--red)", color: "var(--cream)", boxShadow: "3px 3px 0 var(--mustard)" }}>● START TIMER</button>
        </div>
      )}

      <ModeToggle active={mode} onChange={(m) => { setMode(m); setSelected(null); }} />

      {/* Gym-set tracking: which wall am I on? Ticks attach to its current set. */}
      {walls.length > 0 && (
        <div style={{ padding: "8px 16px 0" }}>
          <label style={{ display: "block", marginBottom: 4 }}>On wall · optional</label>
          <div className="gap-row" style={{ gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {[{ id: null as number | null, name: "—" }, ...walls].map((w) => {
              const active = currentWall === w.id;
              return (
                <div key={w.id ?? "none"} role="button" tabIndex={0}
                  aria-pressed={active}
                  onClick={() => pickWall(w.id)} onKeyDown={onKey(() => pickWall(w.id))}
                  className="chunky"
                  style={{
                    padding: "5px 11px", whiteSpace: "nowrap", cursor: "pointer",
                    fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.05em",
                    border: "var(--b) solid var(--ink)",
                    color: active ? "var(--cream)" : "var(--ink)",
                    background: active ? "var(--cobalt)" : "transparent",
                    boxShadow: active ? "2px 2px 0 var(--ink)" : "none",
                  }}>
                  {w.name}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Boulder-only: hold/circuit colour. Sticky until changed. */}
      {mode === "boulder" && (
        <div style={{ padding: "8px 16px 0" }}>
          <label style={{ display: "block", marginBottom: 4 }}>
            Hold colour · {currentColor ? colorName(currentColor) : "optional"}
          </label>
          <div className="gap-row" style={{ gap: 7, overflowX: "auto", paddingBottom: 2, alignItems: "center" }}>
            {STANDARD_COLORS.map((c) => {
              const active = currentColor === c.hex;
              return (
                <div key={c.hex} role="button" tabIndex={0} aria-pressed={active} title={c.name}
                  aria-label={`${c.name} holds`}
                  onClick={() => pickColor(active ? null : c.hex)}
                  onKeyDown={onKey(() => pickColor(active ? null : c.hex))}
                  style={{
                    width: 26, height: 26, flex: "0 0 auto", borderRadius: "50%",
                    background: c.hex, cursor: "pointer",
                    border: active ? "3px solid var(--ink)" : "2px solid rgba(26,22,18,0.35)",
                    boxShadow: active ? "0 0 0 2px var(--mustard)" : "none",
                  }} />
              );
            })}
            {/* Custom colour via the native picker. */}
            <label title="Custom colour" aria-label="Custom colour" style={{
              width: 26, height: 26, flex: "0 0 auto", borderRadius: "50%", cursor: "pointer",
              border: "2px dashed var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-banner)", fontSize: 14, color: "var(--ink-2)",
            }}>
              +
              <input type="color" onChange={(e) => pickColor(e.target.value)}
                style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
            </label>
            {currentColor && !STANDARD_COLORS.some((c) => c.hex === currentColor) && (
              <span role="img" aria-label={`Custom colour ${currentColor}`} style={{
                width: 26, height: 26, flex: "0 0 auto", borderRadius: "50%", background: currentColor,
                border: "3px solid var(--ink)", boxShadow: "0 0 0 2px var(--mustard)",
              }} />
            )}
          </div>
        </div>
      )}

      {/* Lead-only: route name + grade system chips */}
      {mode === "lead" && (
        <>
          <div style={{ padding: "4px 16px 0" }}>
            <label>Route name · optional</label>
            <input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="Kachoong"
              list="route-name-suggestions" autoComplete="off"
              style={{ fontFamily: "var(--font-hand)", fontSize: 18 }} />
            <datalist id="route-name-suggestions">
              {routeNames.map((n) => <option key={n} value={n} />)}
            </datalist>
          </div>
          <div style={{ padding: "10px 16px 0", display: "flex", gap: 6 }}>
            {LEAD_SYSTEMS.map((sys) => (
              <div key={sys} className="chunky"
                onClick={() => { setGradeSystem(sys); setSelected(null); }}
                style={{
                  padding: "4px 10px", fontSize: 10, letterSpacing: "0.06em", fontFamily: "var(--font-banner)",
                  background: gradeSystem === sys ? "var(--cobalt)" : "var(--cream)",
                  color: gradeSystem === sys ? "var(--cream)" : "var(--ink-2)",
                  boxShadow: gradeSystem === sys ? "2px 2px 0 var(--ink)" : "none",
                }}>
                {sys.toUpperCase()}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recents */}
      {recentCards.length > 0 && (
        <div style={{ padding: "10px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.1em" }}>★ +1 A RECENT</div>
            <div className="rough-rule" style={{ flex: 1, opacity: 0.4 }} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {recentCards.map((c, i) => {
              const st = STYLE_BY_ID[sendTypeToStyle(c.send_type)];
              // Prefer what the user typed; fall back to the stored name.
              const carriedName = routeName.trim() || c.last_route_name || null;
              return (
                <RecentChip key={i} grade={c.grade} style={st.label} color={st.color} text={st.text}
                  tilt={cardTilt(i)}
                  onClick={() => commit(c.grade, sendTypeToStyle(c.send_type), {
                    system: c.grade_system as GradeSystem,
                    routeName: carriedName,
                  })} />
              );
            })}
          </div>
        </div>
      )}

      {/* Tap a grade — stays mustard on select so the row below doesn't read red-on-red */}
      <div style={{ padding: "14px 16px 0", textAlign: "center" }}>
        <Ribbon color="var(--mustard)" textColor="var(--ink)">
          {selected ? `★ ${selected} — PICK A STYLE ★` : "★ TAP A GRADE ★"}
        </Ribbon>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, padding: "12px 18px 4px" }}>
        {grades.map((g) => {
          const t = tallies[g];
          const color = t ? STYLE_BY_ID[t.latest].color : "var(--cream)";
          return (
            <GradeChipSlot
              key={g}
              grade={g}
              color={color}
              tally={t?.count ?? 0}
              selected={selected === g}
              onTap={() => selectGrade(g)}
              onLong={() => { setSelected(null); setDetail({ kind: mode, grade: g, gradeSystem }); }}
            />
          );
        })}
      </div>

      {mode === "boulder" && BOULDER_GRADES.length > grades.length && (
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <button
            className="btn-sm btn-secondary"
            onClick={() => setShowAllBoulder((v) => !v)}
            style={{ fontSize: 10, padding: "3px 10px" }}
          >
            {showAllBoulder ? "↑ COLLAPSE" : `↓ SHOW ALL ${BOULDER_GRADES.length}`}
          </button>
        </div>
      )}

      {/* Rest-between-burns timer (the style picker now lives in the sticky
          bottom tray — see StylePicker below). */}
      {mode === "lead" && running && (
        <div style={{ padding: "16px 16px 0" }}>
          <RestTimer />
        </div>
      )}

      {/* Feed or empty */}
      {hasEntries ? (
        <div style={{ padding: "18px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, color: "var(--ink-2)", letterSpacing: "0.1em" }}>
              THIS SESSION · {entries.length} {mode === "lead" ? "BURNS" : "TICKS"}
            </div>
            <div className="rough-rule rough-rule-b" style={{ flex: 1, opacity: 0.4 }} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {feed.map((e, i) => {
              const st = STYLE_BY_ID[sendTypeToStyle(e.send_type)];
              const entryId = e.id!;
              // Not yet on the server: temp id (<0) or still flagged pending.
              const isPending = entryId < 0 || pendingIds.has(entryId);
              return (
                <span key={e.id}
                  title={isPending ? "Waiting to sync" : undefined}
                  style={{ position: "relative", opacity: isPending ? 0.6 : 1 }}>
                  {isPending && (
                    <span aria-label="waiting to sync" style={{
                      position: "absolute", top: -4, right: -4, zIndex: 2,
                      fontSize: 11, lineHeight: 1, pointerEvents: "none",
                    }}>⟳</span>
                  )}
                  <FeedEntry grade={e.grade} style={st.label} color={st.color} text={st.text} time={timeAgo(e.logged_at, now)}
                    tilt={cardTilt(i)}
                    isPB={e.id === pbEntryId}
                    dot={mode === "boulder" ? (e as BoulderEntry).hold_color : undefined}
                    onClick={() => {
                      if (isPending) { toast("Still syncing — give it a sec."); return; }
                      setDetail({ kind: mode, entry: e });
                    }}
                    onDelete={async () => {
                      if (isPending) {
                        // Drop it from the queue and the screen without a server call.
                        dequeue(String(entryId));
                        removeLocalEntry(mode, entryId);
                        markPending(entryId, false);
                        toast(`Removed ${e.grade} · ${st.label}`);
                        return;
                      }
                      try {
                        if (mode === "lead") await api.deleteLead(entryId);
                        else await api.deleteBoulder(entryId);
                        onDeleted(mode, entryId);
                        toast(`Deleted ${e.grade} · ${st.label}`);
                      } catch (err) {
                        toast(err instanceof Error ? err.message : "Couldn't delete tick.");
                      }
                    }}
                  />
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ padding: "24px 16px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <Crag state="primed" species={asSpecies(user?.buddy_species)} size={180} showBg={false} uid="ticksheet-empty" />
          <div style={{
            fontFamily: "var(--font-hand)", fontSize: 20, color: "var(--sea)",
            transform: "rotate(-1.2deg)", textAlign: "center", lineHeight: 1.4,
          }}>
            let's get on something
          </div>
        </div>
      )}

      {/* Warmup + board deep-link straight to the section with its add
          form open — one tap instead of full-log-then-hunt. */}
      <div style={{ padding: "22px 16px 0", display: "flex", gap: 10, justifyContent: "center" }}>
        {([
          { hash: "warmup", label: "🔥 WARMUP", wonk: "wonk" },
          { hash: "fingerboard", label: "🤙 BOARD", wonk: "wonk-2" },
        ] as const).map((b) => (
          <Link key={b.hash} to={`/sessions/${sessionId}/edit#${b.hash}`} className={b.wonk} style={{
            fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.08em",
            color: "var(--ink)", textDecoration: "none", background: "var(--cream)",
            border: "var(--b) solid var(--ink)", boxShadow: "2px 2px 0 var(--ink)",
            padding: "9px 16px",
          }}>
            {b.label}
          </Link>
        ))}
      </div>
      <div style={{ padding: "12px 16px 0", textAlign: "center" }}>
        <Link to={`/sessions/${sessionId}/edit`} style={{ fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.06em", color: "var(--ink-2)" }}>
          FULL LOG ↗
        </Link>
      </div>

      {selected && (
        <StylePicker
          mode={mode}
          grade={selected}
          falls={falls}
          onFalls={(n) => setFalls(Math.max(0, n))}
          onPick={(styleId) => commit(selected, styleId, { system: gradeSystem, routeName: routeName || null, falls })}
          onDismiss={() => setSelected(null)}
        />
      )}

      <Toast message={toastMsg} action={toastAction} onDismiss={dismissToast} />
      <AfterCommitOverlay tick={commitTick} onDone={() => setCommitTick(null)} />
      <AchievementOverlay queue={achievementQueue} onDone={() => setAchievementQueue((q) => q.slice(1))} />

      {detail && (
        <DetailSheet
          sessionId={sessionId}
          target={detail}
          onClose={() => setDetail(null)}
          onSavedBoulder={upsertBoulder}
          onSavedLead={upsertLead}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
