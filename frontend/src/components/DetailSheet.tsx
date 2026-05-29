import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { BoulderEntry, LeadRouteEntry, EntryPhoto, RouteSummary } from "../api/client";
import { GradeChip, StyleRibbonRow, STYLE_BY_ID, STYLE_TO_SEND_TYPE, sendTypeToStyle, StickerRating } from "../ui";
import type { StyleId } from "../ui";
import type { GradeSystem } from "../lib/grades";
import PhotoUploader from "./PhotoUploader";
import { onKey } from "../lib/a11y";

export interface DetailTarget {
  kind: "boulder" | "lead";
  entry?: BoulderEntry | LeadRouteEntry;
  grade?: string;
  gradeSystem?: GradeSystem;
}

interface Props {
  sessionId: number;
  target: DetailTarget;
  onClose: () => void;
  onSavedBoulder: (entry: BoulderEntry) => void;
  onSavedLead: (entry: LeadRouteEntry) => void;
  onDeleted: (kind: "boulder" | "lead", id: number) => void;
}

function Stepper({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label>{label}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div role="button" tabIndex={0} aria-label={`Decrease ${label}`} className="chunky"
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream)", boxShadow: "2px 2px 0 var(--ink)" }}
          onClick={() => onChange(Math.max(min, value - 1))}
          onKeyDown={onKey(() => onChange(Math.max(min, value - 1)))}>–</div>
        <div aria-live="polite" style={{ fontFamily: "var(--font-display)", fontSize: 22, minWidth: 28, textAlign: "center" }}>{value}</div>
        <div role="button" tabIndex={0} aria-label={`Increase ${label}`} className="chunky"
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--mustard)", boxShadow: "2px 2px 0 var(--ink)" }}
          onClick={() => onChange(value + 1)}
          onKeyDown={onKey(() => onChange(value + 1))}>+</div>
      </div>
    </div>
  );
}

export default function DetailSheet({ sessionId, target, onClose, onSavedBoulder, onSavedLead, onDeleted }: Props) {
  const isLead = target.kind === "lead";
  const entry = target.entry;
  const lead = isLead ? (entry as LeadRouteEntry | undefined) : undefined;

  const grade = entry?.grade ?? target.grade ?? "";
  const gradeSystem: GradeSystem = (lead?.grade_system as GradeSystem) ?? target.gradeSystem ?? "ewbank";

  const [routeName, setRouteName] = useState(lead?.route_name ?? "");
  const [styleId, setStyleId] = useState<StyleId>(entry ? sendTypeToStyle(entry.send_type) : "send");
  const [attempts, setAttempts] = useState<number>(entry?.attempts ?? 1);
  const [falls, setFalls] = useState<number>(lead?.falls ?? 0);
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [photos, setPhotos] = useState<EntryPhoto[]>(entry?.photos ?? []);
  const [rating, setRating] = useState<number | null>(lead?.rating ?? null);
  const [saving, setSaving] = useState(false);

  // project linking (lead only)
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const boulderEntry = !isLead ? (entry as BoulderEntry | undefined) : undefined;
  const [routeId, setRouteId] = useState<number | null>(
    (lead?.route_id ?? boulderEntry?.route_id) ?? null
  );
  const [newProject, setNewProject] = useState("");

  useEffect(() => {
    api.listRoutes().then(setRoutes).catch(() => {});
  }, []);

  const styleDef = STYLE_BY_ID[styleId];

  async function save() {
    setSaving(true);
    try {
      if (isLead) {
        // create a project on the fly if a name was typed
        let linkedId = routeId;
        if (newProject.trim()) {
          const r = await api.createRoute({ name: newProject.trim(), grade, grade_system: gradeSystem });
          linkedId = r.id;
        }
        const payload = {
          route_name: routeName || null, grade, grade_system: gradeSystem,
          send_type: STYLE_TO_SEND_TYPE[styleId], attempts, falls, notes: notes || null,
          route_id: linkedId, rating,
        };
        const saved = lead?.id
          ? await api.updateLead(lead.id, payload)
          : await api.addLead(sessionId, payload);
        onSavedLead({ ...saved, photos });
      } else {
        // create a boulder project on the fly if a name was typed
        let linkedId = routeId;
        if (newProject.trim()) {
          const r = await api.createRoute({ name: newProject.trim(), kind: "boulder", grade, grade_system: "vscale" });
          linkedId = r.id;
        }
        const payload = {
          grade, send_type: STYLE_TO_SEND_TYPE[styleId], attempts, notes: notes || null,
          route_id: linkedId,
        };
        const saved = entry?.id
          ? await api.updateBoulder(entry.id, payload)
          : await api.addBoulder(sessionId, payload);
        onSavedBoulder({ ...saved, photos });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!entry?.id) return;
    if (isLead) { await api.deleteLead(entry.id); onDeleted("lead", entry.id); }
    else { await api.deleteBoulder(entry.id); onDeleted("boulder", entry.id); }
    onClose();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(26,22,18,0.45)" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="no-scrollbar"
        style={{
          position: "absolute", left: 12, right: 12, bottom: 96,
          maxWidth: 416, margin: "0 auto",
          background: "var(--paper)", border: "var(--bw) solid var(--ink)",
          boxShadow: "6px 6px 0 var(--ink)", padding: "16px 16px 18px",
          transform: "rotate(-0.6deg)", maxHeight: "80vh", overflow: "auto",
        }}
      >
        <div style={{ width: 44, height: 5, background: "var(--ink)", margin: "0 auto 12px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <GradeChip grade={grade} color={styleDef.color} />
          <div style={{ flex: 1, lineHeight: 1.2 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>
              {grade}{isLead && <span style={{ fontSize: 12, marginLeft: 8, textTransform: "uppercase", color: "var(--ink-2)" }}>{gradeSystem}</span>}
            </div>
            <div style={{ fontFamily: "var(--font-hand)", fontSize: 15, color: "var(--ink-2)" }}>
              {entry?.id ? "edit this tick" : "log with detail"}
            </div>
          </div>
          <div role="button" tabIndex={0} aria-label="Close" className="chunky" onClick={onClose} onKeyDown={onKey(onClose)} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--cream)", fontFamily: "var(--font-banner)", fontSize: 16 }}>×</div>
        </div>

        {isLead && (
          <div style={{ marginBottom: 10 }}>
            <label>Route name · optional</label>
            <input value={routeName} onChange={(e) => setRouteName(e.target.value)} placeholder="Kachoong" style={{ fontFamily: "var(--font-hand)", fontSize: 16 }} />
          </div>
        )}

        {isLead && (
          <div style={{ marginBottom: 10 }}>
            <label>Project · track high-points</label>
            <select value={routeId ?? ""} onChange={(e) => { setRouteId(e.target.value ? Number(e.target.value) : null); setNewProject(""); }}>
              <option value="">— none —</option>
              {routes.filter((r) => r.kind !== "boulder").map((r) => <option key={r.id} value={r.id}>{r.name}{r.grade ? ` (${r.grade})` : ""}</option>)}
            </select>
            {routeId == null && (
              <input value={newProject} onChange={(e) => setNewProject(e.target.value)} placeholder="…or type a new project name" style={{ marginTop: 6 }} />
            )}
            {routeId != null && (
              <Link to={`/routes/${routeId}`} onClick={onClose} style={{ display: "inline-block", marginTop: 6, fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.06em" }}>
                OPEN PROJECT · MARK HIGH-POINT ↗
              </Link>
            )}
          </div>
        )}

        {!isLead && (
          <div style={{ marginBottom: 10 }}>
            <label>Problem · track high-points</label>
            <select value={routeId ?? ""} onChange={(e) => { setRouteId(e.target.value ? Number(e.target.value) : null); setNewProject(""); }}>
              <option value="">— none —</option>
              {routes.filter((r) => r.kind === "boulder").map((r) => <option key={r.id} value={r.id}>{r.name}{r.grade ? ` (${r.grade})` : ""}</option>)}
            </select>
            {routeId == null && (
              <input value={newProject} onChange={(e) => setNewProject(e.target.value)} placeholder="…or type a new problem name" style={{ marginTop: 6 }} />
            )}
            {routeId != null && (
              <Link to={`/routes/${routeId}`} onClick={onClose} style={{ display: "inline-block", marginTop: 6, fontFamily: "var(--font-banner)", fontSize: 11, letterSpacing: "0.06em" }}>
                OPEN PROBLEM · MARK HIGH-POINT ↗
              </Link>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isLead ? "1fr 1fr" : "1fr", gap: 10, marginBottom: 10 }}>
          <Stepper label="Attempts" value={attempts} min={1} onChange={setAttempts} />
          {isLead && <Stepper label="Falls" value={falls} min={0} onChange={setFalls} />}
        </div>

        <div style={{ marginBottom: 10 }}>
          <label>Style</label>
          <StyleRibbonRow mode={target.kind} selected={styleId} onPick={setStyleId} />
        </div>

        {isLead && (
          <div style={{ marginBottom: 10 }}>
            <label>Friend rating · out of 5</label>
            {/* Seed by entry id so the same tick keeps the same five faces.
                Falls back to session+routeId for new ticks (they get their
                final stable seed once saved). */}
            <StickerRating
              seed={lead?.id ?? (sessionId * 1000 + (routeId ?? 0))}
              value={rating}
              onChange={setRating}
            />
          </div>
        )}

        <div style={{ marginBottom: 10 }}>
          <label>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="beta, crux, conditions…" style={{ fontFamily: "var(--font-hand)", fontSize: 16, minHeight: 56 }} />
        </div>

        {entry?.id && (
          <div style={{ marginBottom: 14 }}>
            <label>Photos</label>
            <PhotoUploader entryType={target.kind} entryId={entry.id} photos={photos} onChange={setPhotos} />
          </div>
        )}

        <div role="button" tabIndex={saving ? -1 : 0} aria-disabled={saving}
          className="chunky" onClick={saving ? undefined : save} onKeyDown={saving ? undefined : onKey(save)}
          style={{ padding: "14px 0", textAlign: "center", fontSize: 18, background: "var(--ink)", color: "var(--mustard)", boxShadow: "4px 4px 0 var(--red)", letterSpacing: "0.04em", opacity: saving ? 0.6 : 1 }}>
          ★ {saving ? "SAVING…" : "SAVE TICK"} ★
        </div>

        {entry?.id && (
          <div role="button" tabIndex={0} onClick={remove} onKeyDown={onKey(remove)}
            style={{ textAlign: "center", marginTop: 12, fontFamily: "var(--font-banner)", fontSize: 12, color: "var(--red)", letterSpacing: "0.06em", cursor: "pointer" }}>
            DELETE TICK
          </div>
        )}
      </div>
    </div>
  );
}
