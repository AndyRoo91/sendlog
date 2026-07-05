import { useEffect, useState } from "react";
import { fmtDay } from "../lib/dates";
import { api } from "../api/client";
import type { Gym, Wall, WallSet, Circuit } from "../api/client";
import { ConfirmSheet, Ribbon, Toast } from "../ui";
import { useToast } from "../lib/useToast";
import { STANDARD_COLORS, colorName } from "../lib/holdColors";
import { onKey } from "../lib/a11y";

function angleLabel(angle?: number | null): string {
  if (angle == null) return "";
  if (angle === 0) return "vertical";
  if (angle < 0) return `${Math.abs(angle)}° slab`;
  return `${angle}° overhang`;
}

/** "2026-03-15" → "Mar 15" without UTC drift. */
function setDate(iso: string): string {
  return fmtDay(iso, "MMM d");
}

function progressLabel(s: WallSet): string {
  return s.problem_count != null ? `${s.tick_count}/${s.problem_count} done` : `${s.tick_count} logged`;
}

function ColorDot({ hex, size = 13 }: { hex: string; size?: number }) {
  return (
    <span aria-hidden="true" style={{
      display: "inline-block", width: size, height: size, borderRadius: "50%",
      background: hex, border: "1.5px solid var(--ink)", flex: "0 0 auto",
    }} />
  );
}

/** One colour circuit: tick count, editable total, clear. */
function CircuitRow({ setId, c, onChanged, onError }: {
  setId: number; c: Circuit; onChanged: () => void; onError: (m: string) => void;
}) {
  const [total, setTotal] = useState(c.total_count?.toString() ?? "");

  async function saveTotal() {
    const v = total === "" ? null : Number(total);
    if (v === (c.total_count ?? null)) return;
    try { await api.upsertCircuit(setId, { color: c.color, total_count: v }); onChanged(); }
    catch { onError("Couldn't update the circuit."); }
  }
  async function clear() {
    if (c.circuit_id == null) return;
    try { await api.deleteCircuit(c.circuit_id); onChanged(); }
    catch { onError("Couldn't clear the circuit."); }
  }

  return (
    <div className="gap-row" style={{ gap: 6, alignItems: "center", marginTop: 3 }}>
      <ColorDot hex={c.color} />
      {/* colour name in text — rows shouldn't differ by dot colour alone */}
      <span className="muted" style={{ fontSize: 10, fontFamily: "var(--font-banner)", letterSpacing: "0.05em", minWidth: 44 }}>
        {colorName(c.color).toUpperCase()}
      </span>
      <span className="muted" style={{ fontSize: 12, fontFamily: "var(--font-banner)" }}>{c.tick_count}</span>
      <span className="muted" style={{ fontSize: 11 }}>/</span>
      <input type="number" value={total} onChange={(e) => setTotal(e.target.value)} onBlur={saveTotal}
        placeholder="?" title="Total of this colour"
        style={{ width: 46, padding: "1px 5px", fontFamily: "var(--font-hand)", fontSize: 13 }} />
      <span className="muted" style={{ fontSize: 11 }}>{c.total_count != null ? "done" : "logged"}</span>
      {c.circuit_id != null && (
        <span role="button" tabIndex={0} onClick={clear}
          className="muted" style={{ fontSize: 11, cursor: "pointer", marginLeft: 2 }}>✕</span>
      )}
    </div>
  );
}

/** Colour-circuit breakdown for the current set, with an add-colour palette. */
function CircuitList({ set, onChanged, onError }: {
  set: WallSet; onChanged: () => void; onError: (m: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const used = new Set(set.circuits.map((c) => c.color));

  async function addColor(hex: string) {
    try { await api.upsertCircuit(set.id, { color: hex, total_count: null }); setAdding(false); onChanged(); }
    catch { onError("Couldn't add the circuit."); }
  }

  return (
    <div style={{ marginTop: 6 }}>
      {set.circuits.length > 0 && (
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 9, letterSpacing: "0.08em", color: "var(--ink-2)" }}>
          CIRCUITS
        </div>
      )}
      {set.circuits.map((c) => (
        <CircuitRow key={c.color} setId={set.id} c={c} onChanged={onChanged} onError={onError} />
      ))}
      {adding ? (
        <div className="gap-row" style={{ gap: 6, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
          {STANDARD_COLORS.filter((sc) => !used.has(sc.hex)).map((sc) => (
            <span key={sc.hex} role="button" tabIndex={0} title={sc.name} aria-label={`Add ${sc.name} circuit`}
              onClick={() => addColor(sc.hex)} onKeyDown={onKey(() => addColor(sc.hex))} style={{ cursor: "pointer" }}>
              <ColorDot hex={sc.hex} size={18} />
            </span>
          ))}
          <span role="button" tabIndex={0} onClick={() => setAdding(false)}
            className="muted" style={{ fontSize: 11, cursor: "pointer" }}>cancel</span>
        </div>
      ) : (
        <span role="button" tabIndex={0} onClick={() => setAdding(true)}
          className="muted" style={{ fontSize: 11, cursor: "pointer", fontStyle: "italic", display: "inline-block", marginTop: 4 }}>
          + circuit
        </span>
      )}
    </div>
  );
}

/** Set history + reset control for one wall. */
function SetSection({ wall, onChanged, onError }: {
  wall: Wall; onChanged: () => void; onError: (m: string) => void;
}) {
  const cur = wall.current_set ?? null;
  const [showHistory, setShowHistory] = useState(false);
  const [count, setCount] = useState(cur?.problem_count?.toString() ?? "");

  async function markReset() {
    try { await api.createSet(wall.id, {}); onChanged(); }
    catch { onError("Couldn't record the reset."); }
  }
  async function saveCount() {
    if (!cur) return;
    const v = count === "" ? null : Number(count);
    if (v === (cur.problem_count ?? null)) return;
    try { await api.updateSet(cur.id, { problem_count: v }); onChanged(); }
    catch { onError("Couldn't update the set."); }
  }

  const past = wall.sets.filter((s) => !cur || s.id !== cur.id);

  return (
    <div style={{ marginTop: 6, paddingLeft: 10, borderLeft: "2px solid var(--ink-2)" }}>
      {cur ? (
        <div className="gap-row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.06em", color: "var(--sea)" }}>
            ★ SET {setDate(cur.set_on)}{cur.label ? ` · ${cur.label}` : ""}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>{progressLabel(cur)}</span>
          <span className="muted" style={{ fontSize: 11 }}>of</span>
          <input type="number" value={count} onChange={(e) => setCount(e.target.value)} onBlur={saveCount}
            placeholder="?" title="Total problems in this set"
            style={{ width: 54, padding: "2px 6px", fontFamily: "var(--font-hand)", fontSize: 14 }} />
          <button className="btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: 10 }} onClick={markReset}>↻ RESET</button>
        </div>
      ) : (
        <button className="btn-secondary btn-sm" style={{ padding: "3px 9px", fontSize: 10 }} onClick={markReset}>
          ↻ MARK A RESET
        </button>
      )}

      {cur && <CircuitList set={cur} onChanged={onChanged} onError={onError} />}

      {past.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <span role="button" tabIndex={0} onClick={() => setShowHistory((v) => !v)}
            className="muted" style={{ fontSize: 11, cursor: "pointer", fontStyle: "italic" }}>
            {showHistory ? "▾" : "▸"} {past.length} past set{past.length === 1 ? "" : "s"}
          </span>
          {showHistory && past.map((s) => (
            <div key={s.id} className="muted" style={{ fontSize: 11, marginTop: 2 }}>
              {setDate(s.set_on)}{s.label ? ` · ${s.label}` : ""} — {progressLabel(s)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WallRow({ wall, onChanged, onError }: {
  wall: Wall; onChanged: () => void; onError: (m: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(wall.name);
  const [angle, setAngle] = useState(wall.angle?.toString() ?? "");

  async function save() {
    if (!name.trim()) { onError("Wall name can't be empty."); return; }
    try {
      await api.updateWall(wall.id, { name: name.trim(), angle: angle === "" ? null : Number(angle) });
      setEditing(false);
      onChanged();
    } catch { onError("Couldn't save the wall."); }
  }

  async function remove() {
    try { await api.deleteWall(wall.id); onChanged(); }
    catch { onError("Couldn't delete the wall."); }
  }

  if (editing) {
    return (
      <div className="gap-row" style={{ gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wall name"
          style={{ flex: "1 1 120px", fontFamily: "var(--font-hand)", fontSize: 15 }} />
        <input type="number" value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="angle°"
          style={{ width: 80, fontFamily: "var(--font-hand)", fontSize: 15 }} />
        <button className="btn-primary btn-sm" onClick={save}>Save</button>
        <button className="btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="gap-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.05em" }}>{wall.name}</span>
          {wall.angle != null && (
            <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{angleLabel(wall.angle)}</span>
          )}
        </div>
        <div className="gap-row" style={{ gap: 6 }}>
          <button className="btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => setEditing(true)}>Edit</button>
          <button className="btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: 11 }} onClick={remove}>✕</button>
        </div>
      </div>
      <SetSection wall={wall} onChanged={onChanged} onError={onError} />
    </div>
  );
}

function GymCard({ gym, onChanged, onError }: {
  gym: Gym; onChanged: () => void; onError: (m: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState(gym.name);
  const [wallName, setWallName] = useState("");
  const [wallAngle, setWallAngle] = useState("");

  async function rename() {
    if (!name.trim()) { onError("Gym name can't be empty."); return; }
    try { await api.updateGym(gym.id, name.trim()); setRenaming(false); onChanged(); }
    catch { onError("Couldn't rename the gym."); }
  }

  async function removeGym() {
    setConfirmingDelete(false);
    try { await api.deleteGym(gym.id); onChanged(); }
    catch { onError("Couldn't delete the gym."); }
  }

  async function addWall(e: React.FormEvent) {
    e.preventDefault();
    if (!wallName.trim()) return;
    try {
      await api.createWall(gym.id, wallName.trim(), wallAngle === "" ? null : Number(wallAngle));
      setWallName(""); setWallAngle("");
      onChanged();
    } catch { onError("Couldn't add the wall."); }
  }

  return (
    <div className="card-flat offset-ink" style={{ padding: 16 }}>
      <div className="gap-row" style={{ justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        {renaming ? (
          <div className="gap-row" style={{ gap: 8, flex: 1, flexWrap: "wrap" }}>
            <input value={name} onChange={(e) => setName(e.target.value)}
              style={{ flex: "1 1 140px", fontFamily: "var(--font-hand)", fontSize: 16 }} />
            <button className="btn-primary btn-sm" onClick={rename}>Save</button>
            <button className="btn-secondary btn-sm" onClick={() => { setName(gym.name); setRenaming(false); }}>Cancel</button>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "var(--font-banner)", fontSize: 15, letterSpacing: "0.06em" }}>{gym.name}</div>
            <div className="gap-row" style={{ gap: 6 }}>
              <button className="btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => setRenaming(true)}>Rename</button>
              <button className="btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => setConfirmingDelete(true)}>Delete</button>
            </div>
          </>
        )}
      </div>

      {confirmingDelete && (
        <ConfirmSheet title={`DELETE "${gym.name.toUpperCase()}"?`}
          message="The gym and its walls go. Sessions stay — they just lose the gym tag."
          onConfirm={removeGym} onCancel={() => setConfirmingDelete(false)} />
      )}

      <div style={{ marginTop: 10 }}>
        <div className="rough-rule" style={{ marginBottom: 8 }} />
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.1em", color: "var(--ink-2)" }}>
          WALLS ({gym.walls.length})
        </div>
        {gym.walls.length === 0 && (
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>No walls yet — build one below.</p>
        )}
        {gym.walls.map((w) => (
          <WallRow key={w.id} wall={w} onChanged={onChanged} onError={onError} />
        ))}

        <form onSubmit={addWall} className="gap-row" style={{ gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <input value={wallName} onChange={(e) => setWallName(e.target.value)} placeholder="+ wall (e.g. Cave)"
            style={{ flex: "1 1 120px", fontFamily: "var(--font-hand)", fontSize: 15 }} />
          <input type="number" value={wallAngle} onChange={(e) => setWallAngle(e.target.value)} placeholder="angle°"
            title="Degrees from vertical: − slab, 0 vertical, + overhang"
            style={{ width: 80, fontFamily: "var(--font-hand)", fontSize: 15 }} />
          <button type="submit" className="btn-primary btn-sm" disabled={!wallName.trim()}>Add</button>
        </form>
      </div>
    </div>
  );
}

export default function GymsPage() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const { message: toastMsg, toast, dismiss } = useToast();

  function reload() { api.listGyms().then(setGyms).catch(() => toast("Couldn't load gyms.")); }
  useEffect(() => { api.listGyms().then(setGyms).catch(() => {}).finally(() => setLoading(false)); }, []);

  async function addGym(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try { await api.createGym(newName.trim()); setNewName(""); reload(); }
    catch { toast("Couldn't add the gym."); }
  }

  return (
    <div className="page">
      <div aria-hidden="true" className="ghost-word">GYMS</div>
      <div style={{ marginBottom: 20 }}>
        <Ribbon color="var(--cobalt)" textColor="var(--cream)">★ GYMS ★</Ribbon>
      </div>

      <form onSubmit={addGym} className="gap-row" style={{ gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="+ Add a gym"
          style={{ flex: "1 1 160px", fontFamily: "var(--font-hand)", fontSize: 16 }} />
        <button type="submit" className="btn-primary" disabled={!newName.trim()}>Add Gym</button>
      </form>

      {loading && <p className="muted">chalking up…</p>}
      {!loading && gyms.length === 0 && (
        <div className="card-flat offset-ink" style={{ padding: 16 }}>
          <p className="muted" style={{ fontSize: 13 }}>
            No gyms yet. Add your regular gyms and their walls — you'll be able to tag sessions to them,
            and they're the foundation for set/reset tracking next.
          </p>
        </div>
      )}

      <div className="gap-col">
        {gyms.map((g) => (
          <GymCard key={g.id} gym={g} onChanged={reload} onError={toast} />
        ))}
      </div>

      <Toast message={toastMsg} onDismiss={dismiss} />
    </div>
  );
}
