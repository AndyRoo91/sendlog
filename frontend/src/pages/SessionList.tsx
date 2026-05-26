import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { SessionSummary } from "../api/client";
import { format } from "date-fns";

export default function SessionList() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listSessions().then((s) => { setSessions(s); setLoading(false); });
  }, []);

  return (
    <div className="page">
      <div className="gap-row" style={{ justifyContent: "space-between", marginBottom: 24 }}>
        <h1>Sessions</h1>
        <Link to="/sessions/new">
          <button className="btn-primary">+ Log Session</button>
        </Link>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {!loading && sessions.length === 0 && (
        <div className="card">
          <p className="muted">No sessions yet. <Link to="/sessions/new">Log your first one!</Link></p>
        </div>
      )}
      <div className="gap-col">
        {sessions.map((s) => (
          <Link key={s.id} to={`/sessions/${s.id}`} style={{ textDecoration: "none" }}>
            <div className="card" style={{ cursor: "pointer" }}>
              <div className="gap-row" style={{ justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{format(new Date(s.date), "EEE, MMM d yyyy")}</span>
                  {s.location && <span className="muted" style={{ marginLeft: 10 }}>{s.location}</span>}
                </div>
                {s.duration_minutes && (
                  <span className="muted" style={{ fontSize: 13 }}>{s.duration_minutes} min</span>
                )}
              </div>
              {s.notes && <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>{s.notes}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
