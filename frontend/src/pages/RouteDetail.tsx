import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, formatDistanceToNowStrict } from "date-fns";
import { api } from "../api/client";
import type { RouteDetail as RouteDetailT, RouteNote, RoutePin, EntryPhoto } from "../api/client";
import { pinKind } from "../lib/pins";
import { photoUrl } from "../lib/photos";
import { STYLE_BY_ID, sendTypeToStyle, Lightbox, StickerRating } from "../ui";
import { useAuth } from "../lib/auth";
import TopoPinEditor from "../components/TopoPinEditor";
import PhotoUploader from "../components/PhotoUploader";
import ColourPickOverlay from "../components/ColourPickOverlay";

function PinOverlay({ pins }: { pins: RoutePin[] }) {
  const ordered = [...pins].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  const latest = ordered.length ? ordered[ordered.length - 1].date : "";
  return (
    <>
      {ordered.map((p, i) => {
        const k = pinKind(p.kind);
        const faded = p.date < latest;
        const dark = k.id === "highpoint" || k.id === "crux";
        return (
          <div key={p.id} style={{
            position: "absolute", left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: "translate(-50%,-50%)",
            width: 22, height: 22, borderRadius: "50%", background: k.color, border: "2px solid var(--ink)",
            color: dark ? "var(--ink)" : "var(--cream)", fontFamily: "var(--font-display)", fontSize: 11,
            display: "flex", alignItems: "center", justifyContent: "center", opacity: faded ? 0.45 : 1,
            boxShadow: "1px 1px 0 var(--ink)",
          }}>{k.star ? "★" : i + 1}</div>
        );
      })}
    </>
  );
}

function BetaNotes({
  routeId,
  notes,
  currentUserId,
  onChange,
}: {
  routeId: number;
  notes: RouteNote[];
  currentUserId: number;
  onChange: (notes: RouteNote[]) => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    try {
      const note = await api.addRouteNote(routeId, text.trim());
      onChange([...notes, note]);
      setText("");
    } finally { setSaving(false); }
  }

  async function remove(id: number) {
    await api.deleteRouteNote(id);
    onChange(notes.filter((n) => n.id !== id));
  }

  const whenNote = (at: string) => {
    const iso = /[zZ]|[+-]\d\d:\d\d$/.test(at) ? at : at + "Z";
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ marginBottom: 12 }}>Beta notes</h2>
      {notes.length === 0 && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          No beta yet — add crux tips, sequence notes, conditions…
        </p>
      )}
      <div className="gap-col" style={{ marginBottom: 12 }}>
        {notes.map((n) => (
          <div key={n.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <span style={{
                fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.08em",
                color: "var(--ink-2)", marginRight: 6,
              }}>{n.username.toUpperCase()}</span>
              <span className="muted" style={{ fontSize: 11 }}>{whenNote(n.created_at)}</span>
              <p style={{ fontSize: 14, marginTop: 3 }}>{n.text}</p>
            </div>
            {n.user_id === currentUserId && (
              <button className="btn-secondary btn-sm" style={{ padding: "2px 7px", fontSize: 11 }}
                onClick={() => remove(n.id)}>✕</button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={add} className="gap-row" style={{ gap: 8 }}>
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder="Add a beta note…"
          style={{ flex: 1, fontFamily: "var(--font-hand)", fontSize: 15 }}
        />
        <button type="submit" className="btn-primary btn-sm" disabled={saving || !text.trim()}>
          {saving ? "…" : "Add"}
        </button>
      </form>
    </div>
  );
}

export default function RouteDetail() {
  const { id } = useParams<{ id: string }>();
  const routeId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [route, setRoute] = useState<RouteDetailT | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => { api.getRoute(routeId).then(setRoute); }, [routeId]);

  async function uploadTopo(file: File) {
    setUploading(true);
    try { setRoute(await api.uploadTopo(routeId, file)); }
    finally { setUploading(false); }
  }

  async function handleDelete() {
    if (!route || !confirm("Delete this project and its pins?")) return;
    await api.deleteRoute(routeId);
    navigate("/routes");
  }

  async function handleSetTopo(photoId: number) {
    const updated = await api.topoFromPhoto(routeId, photoId);
    setRoute(updated);
  }

  if (!route) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <div className="gap-row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <Link to="/routes" style={{ fontSize: 13 }}>← Projects</Link>
        <button className="btn-danger btn-sm" onClick={handleDelete}>Delete</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h1>{route.name}</h1>
        <div className="muted" style={{ fontSize: 13 }}>
          {route.grade ? `${route.grade} ${route.grade_system}` : ""}{route.location ? ` · ${route.location}` : ""}
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.1em",
            color: "var(--ink-2)",
          }}>★ RATING</span>
          <StickerRating
            seed={route.id}
            value={route.rating}
            onChange={async (next) => {
              // Optimistic update; revert on failure.
              const prev = route.rating ?? null;
              setRoute({ ...route, rating: next });
              try {
                await api.updateRoute(route.id, { rating: next });
              } catch {
                setRoute({ ...route, rating: prev });
              }
            }}
          />
        </div>
      </div>

      {/* Topo + pins */}
      <div className="card" style={{ marginBottom: 16 }}>
        {route.topo_filename ? (
          <>
            <div style={{ position: "relative", display: "inline-block", width: "100%", cursor: "zoom-in" }}
              onClick={() => setLightbox(photoUrl(route.topo_filename!))}>
              <img src={`/photos/${route.topo_filename}`} alt="Route topo"
                style={{ display: "block", width: "100%", border: "var(--b) solid var(--ink)" }} />
              <PinOverlay pins={route.pins} />
            </div>
            <div className="gap-row" style={{ justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>{route.pins.length} pin{route.pins.length === 1 ? "" : "s"} across sessions</span>
              <div className="gap-row" style={{ gap: 6 }}>
                <button className="btn-secondary btn-sm" onClick={() => setPicking(true)}>🎨 Find same colour</button>
                <button className="btn-primary btn-sm" onClick={() => setEditing(true)}>📍 Add / edit pins</button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Add a photo of the route, then drop pins where you fall to track your high-point over time.</p>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => e.target.files?.[0] && uploadTopo(e.target.files[0])} />
            <button className="btn-primary" disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? "Uploading…" : "📷 Upload topo photo"}
            </button>
          </div>
        )}
      </div>

      {/* Gallery photos */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 10 }}>Photos</h3>
        <PhotoUploader
          entryType="route"
          entryId={routeId}
          photos={route.photos ?? []}
          onChange={(photos: EntryPhoto[]) => setRoute({ ...route, photos })}
          onSetTopo={handleSetTopo}
        />
      </div>

      {/* Linked ticks */}
      {route.kind === "boulder" ? (
        route.boulder_ticks.length > 0 && (
          <div className="card">
            <h2 style={{ marginBottom: 12 }}>Session history</h2>
            <div className="gap-col">
              {route.boulder_ticks.map((t) => {
                const st = STYLE_BY_ID[sendTypeToStyle(t.send_type)];
                return (
                  <div key={t.id} className="gap-row" style={{ gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{t.grade}</span>
                    <span className="tag" style={{ background: st.color, color: st.text }}>{st.label}</span>
                    {t.logged_at && <span className="muted" style={{ fontSize: 12 }}>{format(new Date(t.logged_at.endsWith("Z") ? t.logged_at : t.logged_at + "Z"), "MMM d")}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        route.ticks.length > 0 && (
          <div className="card">
            <h2 style={{ marginBottom: 12 }}>Session history</h2>
            <div className="gap-col">
              {route.ticks.map((t) => {
                const st = STYLE_BY_ID[sendTypeToStyle(t.send_type)];
                return (
                  <div key={t.id} className="gap-row" style={{ gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{t.grade}</span>
                    <span className="tag" style={{ background: st.color, color: st.text }}>{st.label}</span>
                    {t.falls != null && t.falls > 0 && <span className="muted" style={{ fontSize: 12 }}>{t.falls} falls</span>}
                    {t.logged_at && <span className="muted" style={{ fontSize: 12 }}>{format(new Date(t.logged_at.endsWith("Z") ? t.logged_at : t.logged_at + "Z"), "MMM d")}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      <BetaNotes
        routeId={routeId}
        notes={route.notes_log ?? []}
        currentUserId={user?.id ?? -1}
        onChange={(notes) => setRoute({ ...route, notes_log: notes })}
      />

      {editing && route.topo_filename && (
        <TopoPinEditor
          routeId={routeId}
          topoFilename={route.topo_filename}
          pins={route.pins}
          onChange={(pins) => setRoute({ ...route, pins })}
          onClose={() => setEditing(false)}
        />
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      {picking && route.topo_filename && (
        <ColourPickOverlay
          imageSrc={`/photos/${route.topo_filename}`}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
