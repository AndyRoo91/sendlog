import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { SessionSummary } from "../api/client";
import { format } from "date-fns";

export default function Dashboard() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listSessions().then((s) => { setSessions(s); setLoading(false); });
  }, []);

  const recent = sessions.slice(0, 5);
  const totalSessions = sessions.length;
  const thisMonth = sessions.filter((s) => {
    const d = new Date(s.date);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  return (
    <div className="page">
      <div className="gap-row" style={{ justifyContent: "space-between", marginBottom: 24 }}>
        <h1>Dashboard</h1>
        <Link to="/sessions/new">
          <button className="btn-primary">+ Log Session</button>
        </Link>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Total Sessions</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{totalSessions}</div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>This Month</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{thisMonth}</div>
        </div>
        <div className="card">
          <div className="muted" style={{ fontSize: 13, marginBottom: 4 }}>Last Session</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>
            {sessions[0] ? format(new Date(sessions[0].date), "MMM d") : "—"}
          </div>
        </div>
      </div>

      <Link to="/routes" style={{ textDecoration: "none" }}>
        <div className="card gap-row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 24, cursor: "pointer" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>📍 Projects</div>
            <div className="muted" style={{ fontSize: 12 }}>Track high-points on a route photo across sessions</div>
          </div>
          <span style={{ fontFamily: "var(--font-banner)", fontSize: 18 }}>→</span>
        </div>
      </Link>

      <div className="card">
        <div className="section-header">
          <h2>Recent Sessions</h2>
          <Link to="/sessions" style={{ fontSize: 13 }}>View all</Link>
        </div>
        {loading && <p className="muted">Loading…</p>}
        {!loading && recent.length === 0 && (
          <p className="muted">No sessions yet. <Link to="/sessions/new">Log your first one!</Link></p>
        )}
        <div className="gap-col">
          {recent.map((s) => (
            <Link key={s.id} to={`/sessions/${s.id}`} style={{ textDecoration: "none" }}>
              <div className="card" style={{ padding: "14px 16px", cursor: "pointer" }}>
                <div className="gap-row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{format(new Date(s.date), "EEE, MMM d yyyy")}</span>
                    {s.location && <span className="muted" style={{ marginLeft: 10 }}>{s.location}</span>}
                  </div>
                  {s.duration_minutes && (
                    <span className="muted" style={{ fontSize: 13 }}>{s.duration_minutes} min</span>
                  )}
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
