import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { RouteSummary } from "../api/client";
import { Ribbon } from "../ui";

export default function RoutesList() {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.listRoutes().then((r) => { setRoutes(r); setLoading(false); });
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.createRoute({ name, grade: grade || null, grade_system: "ewbank", location: location || null });
      navigate(`/routes/${r.id}`);
    } finally { setSaving(false); }
  }

  return (
    <div className="page">
      <div className="gap-row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <h1>Projects</h1>
        <button className="btn-primary" onClick={() => setOpen(!open)}>{open ? "Cancel" : "+ Project"}</button>
      </div>

      {open && (
        <form onSubmit={create} className="card gap-col" style={{ marginBottom: 16 }}>
          <div className="grid-3">
            <div><label>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kachoong" required /></div>
            <div><label>Grade</label><input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="21" /></div>
            <div><label>Crag</label><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Arapiles" /></div>
          </div>
          <div className="gap-row" style={{ justifyContent: "flex-end" }}>
            <button type="submit" className="btn-primary" disabled={saving || !name}>{saving ? "…" : "Create →"}</button>
          </div>
        </form>
      )}

      {loading && <p className="muted">Loading…</p>}
      {!loading && routes.length === 0 && !open && (
        <div className="card"><p className="muted" style={{ fontSize: 13 }}>No projects yet. Create one and pin your high-points on a photo to track progress across sessions.</p></div>
      )}

      <div className="gap-col">
        {routes.map((r) => (
          <Link key={r.id} to={`/routes/${r.id}`} style={{ textDecoration: "none" }}>
            <div className="card gap-row" style={{ cursor: "pointer", alignItems: "center" }}>
              {r.topo_filename ? (
                <img src={`/photos/${r.topo_filename}`} alt="" style={{ width: 56, height: 56, objectFit: "cover", border: "var(--b) solid var(--ink)", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 56, height: 56, border: "var(--b) dashed var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📷</div>
              )}
              <div style={{ flex: 1 }}>
                <div className="gap-row" style={{ gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{r.name}</span>
                  {r.grade && <Ribbon color="var(--cobalt)" style={{ transform: "scale(0.8)" }}>{r.grade}</Ribbon>}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {r.location ? `${r.location} · ` : ""}{r.pin_count} pin{r.pin_count === 1 ? "" : "s"}
                  {r.last_pin_date ? ` · last ${r.last_pin_date}` : ""}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
