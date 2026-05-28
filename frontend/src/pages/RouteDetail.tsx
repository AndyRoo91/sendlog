import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format } from "date-fns";
import { api } from "../api/client";
import type { RouteDetail as RouteDetailT, RoutePin, EntryPhoto } from "../api/client";
import { pinKind } from "../lib/pins";
import { photoUrl } from "../lib/photos";
import { STYLE_BY_ID, sendTypeToStyle, Lightbox } from "../ui";
import TopoPinEditor from "../components/TopoPinEditor";
import PhotoUploader from "../components/PhotoUploader";

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

export default function RouteDetail() {
  const { id } = useParams<{ id: string }>();
  const routeId = Number(id);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [route, setRoute] = useState<RouteDetailT | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

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
            <div className="gap-row" style={{ justifyContent: "space-between", marginTop: 12 }}>
              <span className="muted" style={{ fontSize: 12 }}>{route.pins.length} pin{route.pins.length === 1 ? "" : "s"} across sessions</span>
              <button className="btn-primary btn-sm" onClick={() => setEditing(true)}>📍 Add / edit pins</button>
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
    </div>
  );
}
