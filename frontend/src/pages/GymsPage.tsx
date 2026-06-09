import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Gym, Wall } from "../api/client";
import { Ribbon, Toast } from "../ui";
import { useToast } from "../lib/useToast";

function angleLabel(angle?: number | null): string {
  if (angle == null) return "";
  if (angle === 0) return "vertical";
  if (angle < 0) return `${Math.abs(angle)}° slab`;
  return `${angle}° overhang`;
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
    <div className="gap-row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
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
  );
}

function GymCard({ gym, onChanged, onError }: {
  gym: Gym; onChanged: () => void; onError: (m: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(gym.name);
  const [wallName, setWallName] = useState("");
  const [wallAngle, setWallAngle] = useState("");

  async function rename() {
    if (!name.trim()) { onError("Gym name can't be empty."); return; }
    try { await api.updateGym(gym.id, name.trim()); setRenaming(false); onChanged(); }
    catch { onError("Couldn't rename the gym."); }
  }

  async function removeGym() {
    if (!confirm(`Delete "${gym.name}" and its walls? Sessions stay, just lose the gym tag.`)) return;
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
              <button className="btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: 11 }} onClick={removeGym}>Delete</button>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 10, borderTop: "2px dashed var(--ink-2)", paddingTop: 8 }}>
        <div style={{ fontFamily: "var(--font-banner)", fontSize: 10, letterSpacing: "0.1em", color: "var(--ink-2)" }}>
          WALLS ({gym.walls.length})
        </div>
        {gym.walls.length === 0 && (
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>No walls yet — add one below.</p>
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
      <div style={{ marginBottom: 20 }}>
        <Ribbon color="var(--cobalt)" textColor="var(--cream)">★ GYMS ★</Ribbon>
      </div>

      <form onSubmit={addGym} className="gap-row" style={{ gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="+ Add a gym"
          style={{ flex: "1 1 160px", fontFamily: "var(--font-hand)", fontSize: 16 }} />
        <button type="submit" className="btn-primary" disabled={!newName.trim()}>Add Gym</button>
      </form>

      {loading && <p className="muted">Loading…</p>}
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
