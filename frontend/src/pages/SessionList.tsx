import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { SessionSummary } from "../api/client";
import { fmtDay } from "../lib/dates";
import { Ribbon, Toast, PullToRefresh } from "../ui";
import { useToast } from "../lib/useToast";
import { usePullToRefresh } from "../lib/usePullToRefresh";

export default function SessionList() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [query, setQuery] = useState("");
  const { message: toastMsg, toast, dismiss: dismissToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const s = await api.listSessions();
    setSessions(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    api.listSessions().then((s) => { setSessions(s); setLoading(false); });
  }, []);
  const ptr = usePullToRefresh(load);

  const q = query.trim().toLowerCase();
  const visible = q
    ? sessions.filter((s) =>
        s.date.includes(q) ||
        (s.location ?? "").toLowerCase().includes(q) ||
        (s.notes ?? "").toLowerCase().includes(q)
      )
    : sessions;

  async function handleExport() {
    try {
      const blob = await api.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `sendlog-export-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed.");
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const result = await api.importData(payload);
      toast(`Imported ${result.sessions_imported} sessions + ${result.routes_imported} routes.`);
      const updated = await api.listSessions();
      setSessions(updated);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Import failed — check the file format.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="page">
      <div aria-hidden="true" className="ghost-word">SESSIONS</div>
      <PullToRefresh distance={ptr.distance} phase={ptr.phase} threshold={ptr.threshold} />
      <div className="gap-row" style={{ justifyContent: "space-between", marginBottom: 22, alignItems: "flex-start" }}>
        <Ribbon color="var(--cobalt)" textColor="var(--cream)">★ SESSIONS ★</Ribbon>
        <Link to="/sessions/new">
          <button className="btn-primary">+ Log Session</button>
        </Link>
      </div>

      {!loading && sessions.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Search by date, location, notes…"
            style={{ fontFamily: "var(--font-hand)", fontSize: 15 }}
          />
        </div>
      )}

      {loading && <p className="muted">Loading…</p>}
      {!loading && sessions.length === 0 && (
        <div className="card-flat offset-ink" style={{ padding: 16 }}>
          <p className="muted">No sessions yet. <Link to="/sessions/new">Log your first one!</Link></p>
        </div>
      )}
      {!loading && sessions.length > 0 && visible.length === 0 && (
        <div className="card-flat offset-ink" style={{ padding: 16 }}>
          <p className="muted">No sessions match "{query}".</p>
        </div>
      )}

      <div className="gap-col">
        {visible.map((s, i) => (
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
                    {fmtDay(s.date, "EEE · MMM d yyyy").toUpperCase()}
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

      {/* Data backup row */}
      <div style={{ marginTop: 32, opacity: 0.7 }}>
        <div className="rough-rule" style={{ marginBottom: 16 }} />
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.1em", color: "var(--ink-2)", marginBottom: 10 }}>
          ★ DATA BACKUP
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-secondary btn-sm" onClick={handleExport}>
            ↓ EXPORT JSON
          </button>
          <button className="btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? "IMPORTING…" : "↑ IMPORT JSON"}
          </button>
          <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={handleImport} />
        </div>
      </div>

      <Toast message={toastMsg} onDismiss={dismissToast} />
    </div>
  );
}
