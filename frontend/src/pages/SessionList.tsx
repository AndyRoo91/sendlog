import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { SessionSummary } from "../api/client";
import { format } from "date-fns";
import { Ribbon } from "../ui";

export default function SessionList() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listSessions().then((s) => { setSessions(s); setLoading(false); });
  }, []);

  return (
    <div className="page">
      <div className="gap-row" style={{ justifyContent: "space-between", marginBottom: 22, alignItems: "flex-start" }}>
        <Ribbon color="var(--cobalt)" textColor="var(--cream)">★ SESSIONS ★</Ribbon>
        <Link to="/sessions/new">
          <button className="btn-primary">+ Log Session</button>
        </Link>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {!loading && sessions.length === 0 && (
        <div className="card-flat offset-ink" style={{ padding: 16 }}>
          <p className="muted">No sessions yet. <Link to="/sessions/new">Log your first one!</Link></p>
        </div>
      )}

      <div className="gap-col">
        {sessions.map((s, i) => (
          <Link key={s.id} to={`/sessions/${s.id}`} style={{ textDecoration: "none" }}>
            <div className="card-flat offset-ink" style={{
              padding: "14px 16px", cursor: "pointer",
              transform: `rotate(${i % 2 === 0 ? -0.4 : 0.3}deg)`,
            }}>
              <div className="gap-row" style={{ justifyContent: "space-between" }}>
                <div>
                  <span style={{
                    fontFamily: "var(--font-banner)", fontSize: 13, letterSpacing: "0.06em",
                  }}>
                    {format(new Date(s.date), "EEE · MMM d yyyy").toUpperCase()}
                  </span>
                  {s.location && (
                    <span className="muted" style={{ marginLeft: 10, fontSize: 13 }}>{s.location}</span>
                  )}
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
