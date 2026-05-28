import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { RouteSummary } from "../api/client";
import { thumbUrl } from "../lib/photos";
import { Ribbon } from "../ui";

export default function RoutesList() {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [newKind, setNewKind] = useState<"lead" | "boulder">("lead");
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
      const r = await api.createRoute({
        name, kind: newKind,
        grade: grade || null,
        grade_system: newKind === "boulder" ? "vscale" : "ewbank",
        location: location || null,
      });
      navigate(`/routes/${r.id}`);
    } finally { setSaving(false); }
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? routes.filter((r) =>
        r.name.toLowerCase().includes(q) ||
        (r.grade ?? "").toLowerCase().includes(q) ||
        (r.location ?? "").toLowerCase().includes(q)
      )
    : routes;
  const leads = filtered.filter((r) => r.kind !== "boulder");
  const boulders = filtered.filter((r) => r.kind === "boulder");

  function RouteCard({ r }: { r: RouteSummary }) {
    return (
      <Link key={r.id} to={`/routes/${r.id}`} style={{ textDecoration: "none" }}>
        <div className="card gap-row" style={{ cursor: "pointer", alignItems: "center" }}>
          {r.topo_filename ? (
            <img src={thumbUrl(r.topo_filename)} alt="" style={{ width: 56, height: 56, objectFit: "cover", border: "var(--b) solid var(--ink)", flexShrink: 0 }} />
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
    );
  }

  return (
    <div className="page">
      <div className="gap-row" style={{ justifyContent: "space-between", marginBottom: 20 }}>
        <h1>Projects</h1>
        <button className="btn-primary" onClick={() => setOpen(!open)}>{open ? "Cancel" : "+ Project"}</button>
      </div>

      {!loading && routes.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Search by name, grade, crag…"
            style={{ fontFamily: "var(--font-hand)", fontSize: 15 }}
          />
        </div>
      )}

      {open && (
        <form onSubmit={create} className="card gap-col" style={{ marginBottom: 16 }}>
          {/* Kind toggle */}
          <div style={{ display: "flex", gap: 8 }}>
            {(["lead", "boulder"] as const).map((k) => (
              <div key={k} className="chunky" onClick={() => setNewKind(k)}
                style={{
                  flex: 1, textAlign: "center", padding: "8px 0",
                  fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.08em",
                  background: newKind === k ? "var(--ink)" : "var(--cream)",
                  color: newKind === k ? "var(--mustard)" : "var(--ink-2)",
                  boxShadow: newKind === k ? "3px 3px 0 var(--red)" : "2px 2px 0 var(--ink-2)",
                }}>
                {k === "lead" ? "⬆ LEAD" : "🪨 BOULDER"}
              </div>
            ))}
          </div>
          <div className="grid-3">
            <div><label>Name *</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={newKind === "boulder" ? "The Sitter" : "Kachoong"} required /></div>
            <div><label>Grade</label><input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={newKind === "boulder" ? "V7" : "21"} /></div>
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
      {!loading && routes.length > 0 && q && leads.length === 0 && boulders.length === 0 && (
        <div className="card"><p className="muted" style={{ fontSize: 13 }}>No projects match "{query}".</p></div>
      )}

      {leads.length > 0 && (
        <>
          <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.1em", color: "var(--ink-2)", marginBottom: 8, marginTop: 4 }}>
            ⬆ LEAD PROJECTS · {leads.length}
          </div>
          <div className="gap-col" style={{ marginBottom: 20 }}>
            {leads.map((r) => <RouteCard key={r.id} r={r} />)}
          </div>
        </>
      )}

      {boulders.length > 0 && (
        <>
          <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.1em", color: "var(--ink-2)", marginBottom: 8 }}>
            🪨 BOULDER PROBLEMS · {boulders.length}
          </div>
          <div className="gap-col">
            {boulders.map((r) => <RouteCard key={r.id} r={r} />)}
          </div>
        </>
      )}
    </div>
  );
}
