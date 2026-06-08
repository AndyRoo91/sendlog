import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { api } from "../api/client";
import type { FeedEvent, ReactionSummary } from "../api/client";
import { Ribbon, Toast, PullToRefresh, Crag } from "../ui";
import { useToast } from "../lib/useToast";
import { usePullToRefresh } from "../lib/usePullToRefresh";
import { useAuth } from "../lib/auth";
import { onKey } from "../lib/a11y";

// A stable colour per climber so each friend reads consistently in the feed.
const NAME_COLORS = ["var(--red)", "var(--mustard)", "var(--sea)", "var(--cobalt)", "var(--couch)"];
function nameColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

/** Interpret naive backend timestamps (UTC) and render "2d ago". */
function whenLabel(at: string): string {
  const iso = /[zZ]|[+-]\d\d:\d\d$/.test(at) ? at : at + "Z";
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

function sessionHeadline(e: FeedEvent): { emoji: string; text: string } {
  if (e.training_only) return { emoji: "🏋️", text: "put in a board session" };
  const where = e.location ? `at ${e.location}` : "a session";
  return { emoji: "🧗", text: `climbed ${where}` };
}

function sessionStats(e: FeedEvent): string {
  if (e.training_only) return "";  // headline already says "board session"
  const parts: string[] = [];
  parts.push(`${e.total_ticks} ${e.total_ticks === 1 ? "tick" : "ticks"}`);
  const sends = e.boulder_sends + e.lead_sends;
  if (sends > 0) parts.push(`${sends} sent`);
  const hardest: string[] = [];
  if (e.hardest_boulder) hardest.push(e.hardest_boulder);
  if (e.hardest_lead) hardest.push(e.hardest_lead);
  if (hardest.length) parts.push(`up to ${hardest.join(" · ")}`);
  return parts.join(" · ");
}

function UsernameChip({ name, isMe }: { name: string; isMe: boolean }) {
  return (
    <span style={{
      fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.08em",
      color: "var(--cream)", background: nameColor(name), padding: "3px 9px",
      boxShadow: "2px 2px 0 var(--ink)", border: "var(--b) solid var(--ink)",
      whiteSpace: "nowrap",
    }}>
      {name.toUpperCase()}{isMe ? " · YOU" : ""}
    </span>
  );
}

const PROPS = ["🔥", "💪", "🎉", "👊", "✨"];

function ReactionRow({
  feedKey,
  initReactions,
  onError,
}: {
  feedKey: string;
  initReactions: ReactionSummary[];
  onError: (msg: string) => void;
}) {
  const [reactions, setReactions] = useState<ReactionSummary[]>(initReactions);

  async function toggle(emoji: string) {
    const hit = reactions.find((r) => r.emoji === emoji);
    if (hit?.reacted) {
      // optimistic remove
      const prev = reactions;
      setReactions((rs) =>
        rs
          .map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, reacted: false, reaction_id: null } : r)
          .filter((r) => r.count > 0)
      );
      try {
        await api.removeReaction(hit.reaction_id!);
      } catch {
        setReactions(prev);
        onError("Couldn't remove props.");
      }
    } else {
      // optimistic add
      const prev = reactions;
      setReactions((rs) => {
        const existing = rs.find((r) => r.emoji === emoji);
        if (existing) return rs.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, reacted: true } : r);
        return [...rs, { emoji, count: 1, reacted: true, reaction_id: null }];
      });
      try {
        const created = await api.addReaction(feedKey, emoji);
        setReactions((rs) => rs.map((r) => r.emoji === emoji ? { ...r, reaction_id: created.id } : r));
      } catch {
        setReactions(prev);
        onError("Couldn't add props.");
      }
    }
  }

  return (
    <div className="gap-row" style={{ marginTop: 10, gap: 5, flexWrap: "wrap" }}>
      {PROPS.map((emoji) => {
        const r = reactions.find((x) => x.emoji === emoji);
        const count = r?.count ?? 0;
        const reacted = r?.reacted ?? false;
        return (
          <div
            key={emoji}
            role="button"
            tabIndex={0}
            aria-pressed={reacted}
            onClick={() => toggle(emoji)}
            onKeyDown={onKey(() => toggle(emoji))}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "3px 8px",
              border: "var(--b) solid var(--ink)",
              background: reacted ? "var(--mustard)" : "transparent",
              boxShadow: reacted ? "2px 2px 0 var(--ink)" : "none",
              cursor: "pointer",
              opacity: count === 0 ? 0.4 : 1,
              transition: "opacity 0.1s, background 0.1s",
            }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>{emoji}</span>
            {count > 0 && (
              <span style={{
                fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.06em",
              }}>{count}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EventCard({ e, i, isMe, onReactionError }: {
  e: FeedEvent; i: number; isMe: boolean;
  onReactionError: (msg: string) => void;
}) {
  const tilt = i % 2 === 0 ? -0.4 : 0.35;
  const isAch = e.kind === "achievement";
  const head = isAch
    ? { emoji: e.emoji ?? "🏅", text: `unlocked "${e.title}"` }
    : sessionHeadline(e);

  return (
    <div className="card-flat offset-ink" style={{
      padding: "13px 15px", transform: `rotate(${tilt}deg)`,
      borderColor: e.is_pb ? "var(--red)" : undefined,
    }}>
      <div className="gap-row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <UsernameChip name={e.username} isMe={isMe} />
        <span className="muted" style={{ fontSize: 11, fontFamily: "var(--font-banner)", letterSpacing: "0.05em" }}>
          {whenLabel(e.at)}
        </span>
      </div>

      <div style={{ marginTop: 9, fontFamily: "var(--font-hand)", fontSize: 18, lineHeight: 1.25 }}>
        <span style={{ marginRight: 6 }}>{head.emoji}</span>{head.text}
      </div>

      {e.kind === "session" && (sessionStats(e) || e.is_pb) && (
        <div className="gap-row" style={{ marginTop: 6, alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {sessionStats(e) && <span className="muted" style={{ fontSize: 13 }}>{sessionStats(e)}</span>}
          {e.is_pb && (
            <span style={{
              fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.1em",
              color: "var(--cream)", background: "var(--red)", padding: "2px 7px",
              boxShadow: "2px 2px 0 var(--ink)", transform: "rotate(-2deg)",
            }}>★ NEW PB</span>
          )}
        </div>
      )}

      <ReactionRow
        feedKey={e.feed_key}
        initReactions={e.reactions}
        onError={onReactionError}
      />
    </div>
  );
}

export default function FeedPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { message: toastMsg, toast, dismiss: dismissToast } = useToast();

  const load = useCallback(async () => {
    try {
      setEvents(await api.getFeed());
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't load the feed.");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    api.getFeed()
      .then(setEvents)
      .catch(() => { /* surfaced on manual refresh */ })
      .finally(() => setLoading(false));
  }, []);
  const ptr = usePullToRefresh(load);

  return (
    <div className="page">
      <PullToRefresh distance={ptr.distance} phase={ptr.phase} threshold={ptr.threshold} />
      <div style={{ marginBottom: 20 }}>
        <Ribbon color="var(--sea)" textColor="var(--cream)">★ THE FEED ★</Ribbon>
      </div>

      {loading && <p className="muted">Loading…</p>}

      {!loading && events.length === 0 && (
        <div className="card-flat offset-ink" style={{ padding: 20, textAlign: "center" }}>
          <Crag state="primed" size={90} showBg={false} uid="feed-empty" />
          <p className="muted" style={{ marginTop: 10 }}>
            Quiet at the crag. Log a session and your crew will see it here.
          </p>
        </div>
      )}

      <div className="gap-col">
        {events.map((e, i) => (
          <EventCard
            key={`${e.kind}-${e.session_id ?? e.code}-${e.user_id}-${e.at}-${e.reactions.length}`}
            e={e} i={i} isMe={e.user_id === user?.id}
            onReactionError={toast}
          />
        ))}
      </div>

      <Toast message={toastMsg} onDismiss={dismissToast} />
    </div>
  );
}
