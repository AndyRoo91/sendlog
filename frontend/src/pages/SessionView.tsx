import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type {
  SessionDetail, WarmupEntry, FingerboardEntry, BoulderEntry,
  LeadRouteEntry, StrengthEntry, EntryPhoto, Gym,
} from "../api/client";
import { fmtDay } from "../lib/dates";
import PhotoUploader from "../components/PhotoUploader";
import ProtocolPicker from "../components/ProtocolPicker";
import { photoUrl, thumbUrl } from "../lib/photos";
import { sendTypeToStyle, STYLE_BY_ID, ConfirmSheet } from "../ui";

const BOULDER_SEND_TYPES = [
  { value: "flash", label: "Flash" },
  { value: "redpoint", label: "Send" },
  { value: "working", label: "Working" },
  { value: "fall", label: "Fall" },
];

// ─── Grade constants ──────────────────────────────────────────────────────────

const BOULDER_GRADES = [
  "V0","V1","V2","V3","V4","V5","V6","V7","V8","V9",
  "V10","V11","V12","V13","V14","V15","V16",
];
const EWBANK_GRADES = Array.from({ length: 38 }, (_, i) => String(i + 1));
const YDS_GRADES = [
  "5.6","5.7","5.8","5.9",
  "5.10a","5.10b","5.10c","5.10d","5.11a","5.11b","5.11c","5.11d",
  "5.12a","5.12b","5.12c","5.12d","5.13a","5.13b","5.13c","5.13d",
  "5.14a","5.14b","5.14c","5.14d","5.15a","5.15b","5.15c","5.15d",
];
const FRENCH_GRADES = [
  "5a","5b","5c","6a","6a+","6b","6b+","6c","6c+",
  "7a","7a+","7b","7b+","7c","7c+","8a","8a+","8b","8b+","8c","8c+","9a","9a+","9b","9b+","9c",
];
const GRADE_OPTIONS: Record<string, string[]> = { ewbank: EWBANK_GRADES, yds: YDS_GRADES, french: FRENCH_GRADES };
const DEFAULT_GRADE: Record<string, string> = { ewbank: "20", yds: "5.10a", french: "6b" };
const STRENGTH_EXERCISES = ["Pull-up","Weighted pull-up","Lock-off (L)","Lock-off (R)","One-arm lock-off","Front lever"];
const SEND_TYPES = [
  { value: "onsight", label: "Onsight" }, { value: "flash", label: "Flash" },
  { value: "redpoint", label: "Redpoint" }, { value: "pinkpoint", label: "Pinkpoint" },
  { value: "working", label: "Working / Hangdog" }, { value: "toprope", label: "Top-rope" },
];
const SEND_LABEL: Record<string, string> = {
  onsight: "OS", flash: "Flash", redpoint: "RP", pinkpoint: "PP", working: "Working", toprope: "TR",
};
const IS_SEND = new Set(["onsight", "flash", "redpoint", "pinkpoint"]);

// ─── Shared UI helpers ────────────────────────────────────────────────────────

function EntryActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="gap-row" style={{ marginTop: 6 }}>
      <button className="btn-secondary btn-sm" onClick={onEdit}>Edit</button>
      <button className="btn-danger btn-sm" onClick={onDelete}>Delete</button>
    </div>
  );
}

// ─── Warmup section ───────────────────────────────────────────────────────────

function WarmupSection({ sessionId, entries, onChange }: {
  sessionId: number;
  entries: WarmupEntry[];
  onChange: (entries: WarmupEntry[]) => void;
}) {
  const blank = () => ({ activity: "", duration_minutes: null as number | null, notes: null as string | null });
  const [form, setForm] = useState(blank());
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function startEdit(e: WarmupEntry) {
    setForm({ activity: e.activity, duration_minutes: e.duration_minutes ?? null, notes: e.notes ?? null });
    setEditId(e.id!);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editId) {
        const updated = await api.updateWarmup(editId, form);
        onChange(entries.map((e) => e.id === editId ? updated : e));
      } else {
        const created = await api.addWarmup(sessionId, form);
        onChange([...entries, created]);
      }
      setForm(blank()); setEditId(null); setOpen(false);
    } finally { setSaving(false); }
  }

  async function remove(id: number) {
    await api.deleteWarmup(id);
    onChange(entries.filter((e) => e.id !== id));
  }

  return (
    <div className="card gap-col">
      <div className="section-header">
        <h2>Warmup / Stretching</h2>
        <button className="btn-secondary btn-sm" onClick={() => { setForm(blank()); setEditId(null); setOpen(!open); }}>
          {open && !editId ? "Cancel" : "+ Add"}
        </button>
      </div>

      {entries.map((e) => editId === e.id ? (
        <InlineWarmupForm key={e.id} form={form} setForm={setForm} saving={saving}
          onSave={save} onCancel={() => { setEditId(null); setOpen(false); }} />
      ) : (
        <div key={e.id} style={{ borderLeft: "3px solid var(--accent2)", paddingLeft: 12 }}>
          <strong>{e.activity}</strong>
          {e.duration_minutes && <span className="muted"> — {e.duration_minutes} min</span>}
          {e.notes && <p className="muted" style={{ fontSize: 13 }}>{e.notes}</p>}
          <EntryActions onEdit={() => startEdit(e)} onDelete={() => remove(e.id!)} />
        </div>
      ))}

      {open && !editId && (
        <InlineWarmupForm form={form} setForm={setForm} saving={saving}
          onSave={save} onCancel={() => setOpen(false)} />
      )}
      {entries.length === 0 && !open && <p className="muted" style={{ fontSize: 13 }}>No entries yet.</p>}
    </div>
  );
}

function InlineWarmupForm({ form, setForm, saving, onSave, onCancel }: {
  form: { activity: string; duration_minutes: number | null; notes: string | null };
  setForm: (f: any) => void; saving: boolean; onSave: () => void; onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="card gap-col" style={{ padding: 12, background: "var(--surface2)" }}>
      <div className="grid-2">
        <div>
          <label>Activity *</label>
          <input ref={ref} value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })}
            placeholder="e.g. foam roll, dynamic stretch" />
        </div>
        <div>
          <label>Duration (min)</label>
          <input type="number" value={form.duration_minutes ?? ""}
            onChange={(e) => setForm({ ...form, duration_minutes: e.target.value ? Number(e.target.value) : null })}
            placeholder="10" min="1" />
        </div>
      </div>
      <div>
        <label>Notes</label>
        <input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} placeholder="Optional" />
      </div>
      <div className="gap-row" style={{ justifyContent: "flex-end" }}>
        <button className="btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn-primary btn-sm" onClick={onSave} disabled={saving || !form.activity}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Fingerboard section ──────────────────────────────────────────────────────

function FingerboardSection({ sessionId, entries, onChange }: {
  sessionId: number; entries: FingerboardEntry[]; onChange: (e: FingerboardEntry[]) => void;
}) {
  const blank = () => ({ edge_mm: null as number|null, added_weight_kg: null as number|null, hang_duration_s: null as number|null, num_sets: null as number|null, notes: null as string|null });
  const [form, setForm] = useState(blank());
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function startEdit(e: FingerboardEntry) {
    setForm({ edge_mm: e.edge_mm??null, added_weight_kg: e.added_weight_kg??null, hang_duration_s: e.hang_duration_s??null, num_sets: e.num_sets??null, notes: e.notes??null });
    setEditId(e.id!); setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editId) {
        const u = await api.updateFingerboard(editId, form);
        onChange(entries.map((e) => e.id === editId ? u : e));
      } else {
        const c = await api.addFingerboard(sessionId, form);
        onChange([...entries, c]);
      }
      setForm(blank()); setEditId(null); setOpen(false);
    } finally { setSaving(false); }
  }

  async function remove(id: number) {
    await api.deleteFingerboard(id);
    onChange(entries.filter((e) => e.id !== id));
  }

  return (
    <div className="card gap-col">
      <div className="section-header">
        <h2>Fingerboard</h2>
        <button className="btn-secondary btn-sm" onClick={() => { setForm(blank()); setEditId(null); setOpen(!open); }}>
          {open && !editId ? "Cancel" : "+ Add"}
        </button>
      </div>
      {entries.map((e) => editId === e.id ? (
        <InlineFbForm key={e.id} form={form} setForm={setForm} saving={saving}
          onSave={save} onCancel={() => { setEditId(null); setOpen(false); }} />
      ) : (
        <div key={e.id} style={{ borderLeft: "3px solid var(--accent)", paddingLeft: 12 }}>
          <div className="gap-row">
            {e.edge_mm && <span className="tag tag-blue">{e.edge_mm}mm</span>}
            {e.added_weight_kg != null && <span style={{ fontWeight: 600 }}>+{e.added_weight_kg} kg</span>}
            {e.hang_duration_s && <span className="muted">{e.hang_duration_s}s</span>}
            {e.num_sets && <span className="muted">× {e.num_sets} sets</span>}
          </div>
          {e.notes && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{e.notes}</p>}
          <EntryActions onEdit={() => startEdit(e)} onDelete={() => remove(e.id!)} />
        </div>
      ))}
      {open && !editId && <InlineFbForm form={form} setForm={setForm} saving={saving} onSave={save} onCancel={() => setOpen(false)} />}
      {entries.length === 0 && !open && <p className="muted" style={{ fontSize: 13 }}>No entries yet.</p>}
    </div>
  );
}

function InlineFbForm({ form, setForm, saving, onSave, onCancel }: any) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const n = (v: string) => v ? Number(v) : null;
  return (
    <div className="card gap-col" style={{ padding: 12, background: "var(--surface2)" }}>
      <ProtocolPicker form={form} setForm={setForm} />
      <div className="grid-3">
        <div><label>Edge (mm)</label>
          <input ref={ref} type="number" value={form.edge_mm ?? ""} onChange={(e) => setForm({ ...form, edge_mm: n(e.target.value) })} placeholder="20" min="1" /></div>
        <div><label>Added weight (kg)</label>
          <input type="number" step="0.5" value={form.added_weight_kg ?? ""} onChange={(e) => setForm({ ...form, added_weight_kg: n(e.target.value) })} placeholder="0" /></div>
        <div><label>Hang (s)</label>
          <input type="number" value={form.hang_duration_s ?? ""} onChange={(e) => setForm({ ...form, hang_duration_s: n(e.target.value) })} placeholder="10" min="1" /></div>
      </div>
      <div className="grid-2">
        <div><label>Sets</label>
          <input type="number" value={form.num_sets ?? ""} onChange={(e) => setForm({ ...form, num_sets: n(e.target.value) })} placeholder="5" min="1" /></div>
        <div><label>Notes</label>
          <input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} placeholder="Optional" /></div>
      </div>
      <div className="gap-row" style={{ justifyContent: "flex-end" }}>
        <button className="btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn-primary btn-sm" onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Lead routes section ──────────────────────────────────────────────────────

function LeadSection({ sessionId, entries, onChange }: {
  sessionId: number; entries: LeadRouteEntry[]; onChange: (e: LeadRouteEntry[]) => void;
}) {
  const blank = (): Omit<LeadRouteEntry,"id"|"session_id"|"photos"> => ({
    route_name: null, grade: "20", grade_system: "ewbank", send_type: "redpoint",
    attempts: null, falls: null, notes: null,
  });
  const [form, setForm] = useState(blank());
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function startEdit(e: LeadRouteEntry) {
    setForm({ route_name: e.route_name??null, grade: e.grade, grade_system: e.grade_system,
      send_type: e.send_type, attempts: e.attempts??null, falls: e.falls??null, notes: e.notes??null });
    setEditId(e.id!); setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editId) {
        const u = await api.updateLead(editId, form);
        onChange(entries.map((e) => e.id === editId ? { ...u, photos: e.photos } : e));
      } else {
        const c = await api.addLead(sessionId, form);
        onChange([...entries, { ...c, photos: [] }]);
      }
      setForm(blank()); setEditId(null); setOpen(false);
    } finally { setSaving(false); }
  }

  async function remove(entry: LeadRouteEntry) {
    await api.deleteLead(entry.id!);
    onChange(entries.filter((e) => e.id !== entry.id));
  }

  function updatePhotos(entryId: number, photos: EntryPhoto[]) {
    onChange(entries.map((e) => e.id === entryId ? { ...e, photos } : e));
  }

  return (
    <div className="card gap-col">
      <div className="section-header">
        <h2>Lead Routes</h2>
        <button className="btn-secondary btn-sm" onClick={() => { setForm(blank()); setEditId(null); setOpen(!open); }}>
          {open && !editId ? "Cancel" : "+ Add"}
        </button>
      </div>
      {entries.map((e) => editId === e.id ? (
        <InlineLeadForm key={e.id} form={form} setForm={setForm} saving={saving}
          onSave={save} onCancel={() => { setEditId(null); setOpen(false); }} />
      ) : (
        <div key={e.id} style={{ borderLeft: "3px solid var(--accent)", paddingLeft: 12 }}>
          <div className="gap-row">
            <span style={{ fontWeight: 700, fontSize: 17 }}>{e.grade}</span>
            <span className="muted" style={{ fontSize: 12, textTransform: "uppercase" }}>{e.grade_system}</span>
            <span className={`tag ${IS_SEND.has(e.send_type) ? "tag-green" : "tag-red"}`}>
              {SEND_LABEL[e.send_type] ?? e.send_type}
            </span>
            {e.route_name && <span style={{ fontWeight: 500 }}>{e.route_name}</span>}
            {e.attempts && <span className="muted">{e.attempts} att.</span>}
            {e.falls != null && e.falls > 0 && <span className="muted">{e.falls} falls</span>}
          </div>
          {e.notes && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{e.notes}</p>}
          {(e.photos ?? []).length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {(e.photos ?? []).map((p) => (
                <a key={p.id} className="print-photo-wrap" href={photoUrl(p.filename)} target="_blank" rel="noreferrer">
                  <img src={thumbUrl(p.filename)} alt="" className="print-photo" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                </a>
              ))}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <PhotoUploader entryType="lead" entryId={e.id!} photos={e.photos ?? []}
              onChange={(photos) => updatePhotos(e.id!, photos)} />
          </div>
          <EntryActions onEdit={() => startEdit(e)} onDelete={() => remove(e)} />
        </div>
      ))}
      {open && !editId && <InlineLeadForm form={form} setForm={setForm} saving={saving} onSave={save} onCancel={() => setOpen(false)} />}
      {entries.length === 0 && !open && <p className="muted" style={{ fontSize: 13 }}>No entries yet.</p>}
    </div>
  );
}

function InlineLeadForm({ form, setForm, saving, onSave, onCancel }: any) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const n = (v: string) => v ? Number(v) : null;
  return (
    <div className="card gap-col" style={{ padding: 12, background: "var(--surface2)" }}>
      <div className="grid-2">
        <div><label>Route name</label>
          <input ref={ref} value={form.route_name ?? ""} onChange={(e) => setForm({ ...form, route_name: e.target.value || null })} placeholder="Optional" /></div>
        <div><label>Grade system</label>
          <select value={form.grade_system} onChange={(e) => setForm({ ...form, grade_system: e.target.value, grade: DEFAULT_GRADE[e.target.value] })}>
            <option value="ewbank">Ewbank (AU)</option>
            <option value="yds">YDS (5.x)</option>
            <option value="french">French</option>
          </select></div>
      </div>
      <div className="grid-3">
        <div><label>Grade</label>
          <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
            {(GRADE_OPTIONS[form.grade_system] ?? EWBANK_GRADES).map((g: string) => <option key={g}>{g}</option>)}
          </select></div>
        <div><label>Send type</label>
          <select value={form.send_type} onChange={(e) => setForm({ ...form, send_type: e.target.value })}>
            {SEND_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select></div>
        <div><label>Attempts</label>
          <input type="number" value={form.attempts ?? ""} onChange={(e) => setForm({ ...form, attempts: n(e.target.value) })} placeholder="1" min="1" /></div>
      </div>
      <div className="grid-2">
        <div><label>Falls</label>
          <input type="number" value={form.falls ?? ""} onChange={(e) => setForm({ ...form, falls: n(e.target.value) })} placeholder="0" min="0" /></div>
        <div><label>Notes</label>
          <input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} placeholder="Beta, crux…" /></div>
      </div>
      <div className="gap-row" style={{ justifyContent: "flex-end" }}>
        <button className="btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn-primary btn-sm" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

// ─── Boulder section ──────────────────────────────────────────────────────────

function BoulderSection({ sessionId, entries, onChange }: {
  sessionId: number; entries: BoulderEntry[]; onChange: (e: BoulderEntry[]) => void;
}) {
  const blank = (): Omit<BoulderEntry,"id"|"session_id"|"photos"> => ({ grade: "V5", send_type: "redpoint", attempts: null, notes: null });
  const [form, setForm] = useState(blank());
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function startEdit(e: BoulderEntry) {
    setForm({ grade: e.grade, send_type: e.send_type, attempts: e.attempts??null, notes: e.notes??null });
    setEditId(e.id!); setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editId) {
        const u = await api.updateBoulder(editId, form);
        onChange(entries.map((e) => e.id === editId ? { ...u, photos: e.photos } : e));
      } else {
        const c = await api.addBoulder(sessionId, form);
        onChange([...entries, { ...c, photos: [] }]);
      }
      setForm(blank()); setEditId(null); setOpen(false);
    } finally { setSaving(false); }
  }

  async function remove(entry: BoulderEntry) {
    await api.deleteBoulder(entry.id!);
    onChange(entries.filter((e) => e.id !== entry.id));
  }

  function updatePhotos(entryId: number, photos: EntryPhoto[]) {
    onChange(entries.map((e) => e.id === entryId ? { ...e, photos } : e));
  }

  return (
    <div className="card gap-col">
      <div className="section-header">
        <h2>Limit Bouldering</h2>
        <button className="btn-secondary btn-sm" onClick={() => { setForm(blank()); setEditId(null); setOpen(!open); }}>
          {open && !editId ? "Cancel" : "+ Add"}
        </button>
      </div>
      {entries.map((e) => editId === e.id ? (
        <InlineBoulderForm key={e.id} form={form} setForm={setForm} saving={saving}
          onSave={save} onCancel={() => { setEditId(null); setOpen(false); }} />
      ) : (
        <div key={e.id} style={{ borderLeft: "3px solid var(--accent2)", paddingLeft: 12 }}>
          <div className="gap-row">
            <span style={{ fontWeight: 700, fontSize: 17 }}>{e.grade}</span>
            <span className="tag" style={{ background: STYLE_BY_ID[sendTypeToStyle(e.send_type)].color, color: STYLE_BY_ID[sendTypeToStyle(e.send_type)].text }}>
              {STYLE_BY_ID[sendTypeToStyle(e.send_type)].label}
            </span>
            {e.attempts && <span className="muted">{e.attempts} attempts</span>}
          </div>
          {e.notes && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{e.notes}</p>}
          {(e.photos ?? []).length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {(e.photos ?? []).map((p) => (
                <a key={p.id} className="print-photo-wrap" href={photoUrl(p.filename)} target="_blank" rel="noreferrer">
                  <img src={thumbUrl(p.filename)} alt="" className="print-photo" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                </a>
              ))}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            <PhotoUploader entryType="boulder" entryId={e.id!} photos={e.photos ?? []}
              onChange={(photos) => updatePhotos(e.id!, photos)} />
          </div>
          <EntryActions onEdit={() => startEdit(e)} onDelete={() => remove(e)} />
        </div>
      ))}
      {open && !editId && <InlineBoulderForm form={form} setForm={setForm} saving={saving} onSave={save} onCancel={() => setOpen(false)} />}
      {entries.length === 0 && !open && <p className="muted" style={{ fontSize: 13 }}>No entries yet.</p>}
    </div>
  );
}

function InlineBoulderForm({ form, setForm, saving, onSave, onCancel }: any) {
  const n = (v: string) => v ? Number(v) : null;
  return (
    <div className="card gap-col" style={{ padding: 12, background: "var(--surface2)" }}>
      <div className="grid-3">
        <div><label>Grade</label>
          <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
            {BOULDER_GRADES.map((g) => <option key={g}>{g}</option>)}
          </select></div>
        <div><label>Send type</label>
          <select value={form.send_type} onChange={(e) => setForm({ ...form, send_type: e.target.value })}>
            {BOULDER_SEND_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select></div>
        <div><label>Attempts</label>
          <input type="number" value={form.attempts ?? ""} onChange={(e) => setForm({ ...form, attempts: n(e.target.value) })} placeholder="3" min="1" /></div>
      </div>
      <div><label>Notes</label>
        <input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} placeholder="Beta, holds…" /></div>
      <div className="gap-row" style={{ justifyContent: "flex-end" }}>
        <button className="btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn-primary btn-sm" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

// ─── Strength section ─────────────────────────────────────────────────────────

function StrengthSection({ sessionId, entries, onChange }: {
  sessionId: number; entries: StrengthEntry[]; onChange: (e: StrengthEntry[]) => void;
}) {
  const blank = (): Omit<StrengthEntry,"id"|"session_id"> => ({ exercise: "Pull-up", reps: null, added_weight_kg: null, notes: null });
  const [form, setForm] = useState(blank());
  const [editId, setEditId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function startEdit(e: StrengthEntry) {
    setForm({ exercise: e.exercise, reps: e.reps??null, added_weight_kg: e.added_weight_kg??null, notes: e.notes??null });
    setEditId(e.id!); setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      if (editId) {
        const u = await api.updateStrength(editId, form);
        onChange(entries.map((e) => e.id === editId ? u : e));
      } else {
        const c = await api.addStrength(sessionId, form);
        onChange([...entries, c]);
      }
      setForm(blank()); setEditId(null); setOpen(false);
    } finally { setSaving(false); }
  }

  async function remove(id: number) {
    await api.deleteStrength(id);
    onChange(entries.filter((e) => e.id !== id));
  }

  return (
    <div className="card gap-col">
      <div className="section-header">
        <h2>Strength</h2>
        <button className="btn-secondary btn-sm" onClick={() => { setForm(blank()); setEditId(null); setOpen(!open); }}>
          {open && !editId ? "Cancel" : "+ Add"}
        </button>
      </div>
      {entries.map((e) => editId === e.id ? (
        <InlineStrengthForm key={e.id} form={form} setForm={setForm} saving={saving}
          onSave={save} onCancel={() => { setEditId(null); setOpen(false); }} />
      ) : (
        <div key={e.id} style={{ borderLeft: "3px solid var(--accent)", paddingLeft: 12 }}>
          <div className="gap-row">
            <strong>{e.exercise}</strong>
            {e.reps && <span className="muted">{e.reps} reps</span>}
            {e.added_weight_kg != null && e.added_weight_kg > 0 && <span>+{e.added_weight_kg} kg</span>}
          </div>
          {e.notes && <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>{e.notes}</p>}
          <EntryActions onEdit={() => startEdit(e)} onDelete={() => remove(e.id!)} />
        </div>
      ))}
      {open && !editId && <InlineStrengthForm form={form} setForm={setForm} saving={saving} onSave={save} onCancel={() => setOpen(false)} />}
      {entries.length === 0 && !open && <p className="muted" style={{ fontSize: 13 }}>No entries yet.</p>}
    </div>
  );
}

function InlineStrengthForm({ form, setForm, saving, onSave, onCancel }: any) {
  const n = (v: string) => v ? Number(v) : null;
  return (
    <div className="card gap-col" style={{ padding: 12, background: "var(--surface2)" }}>
      <div className="grid-3">
        <div><label>Exercise</label>
          <select value={form.exercise} onChange={(e) => setForm({ ...form, exercise: e.target.value })}>
            {STRENGTH_EXERCISES.map((ex) => <option key={ex}>{ex}</option>)}
          </select></div>
        <div><label>Reps</label>
          <input type="number" value={form.reps ?? ""} onChange={(e) => setForm({ ...form, reps: n(e.target.value) })} placeholder="5" min="1" /></div>
        <div><label>Added weight (kg)</label>
          <input type="number" step="0.5" value={form.added_weight_kg ?? ""} onChange={(e) => setForm({ ...form, added_weight_kg: n(e.target.value) })} placeholder="0" /></div>
      </div>
      <div><label>Notes</label>
        <input value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value || null })} placeholder="Optional" /></div>
      <div className="gap-row" style={{ justifyContent: "flex-end" }}>
        <button className="btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
        <button className="btn-primary btn-sm" onClick={onSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

// ─── Session header (inline edit) ─────────────────────────────────────────────

function SessionHeader({ session, onUpdate }: { session: SessionDetail; onUpdate: (s: SessionDetail) => void }) {
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(session.date);
  const [location, setLocation] = useState(session.location ?? "");
  const [duration, setDuration] = useState(session.duration_minutes?.toString() ?? "");
  const [notes, setNotes] = useState(session.notes ?? "");
  const [partner, setPartner] = useState(session.partner ?? "");
  const [gymId, setGymId] = useState<number | null>(session.gym_id ?? null);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [partners, setPartners] = useState<string[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {});
    api.listPartners().then(setPartners).catch(() => {});
    api.listGyms().then(setGyms).catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    try {
      const updated = await api.patchSession(session.id, {
        date, location: location || null,
        gym_id: gymId,
        duration_minutes: duration ? Number(duration) : null,
        notes: notes || null,
        partner: partner || null,
      });
      onUpdate(updated);
      setEditing(false);
    } finally { setSaving(false); }
  }

  if (editing) {
    return (
      <div className="card gap-col" style={{ marginBottom: 24 }}>
        <div className="grid-3">
          <div><label>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <label>Location</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="Gym / crag" list="sv-location-suggestions" autoComplete="off" />
            <datalist id="sv-location-suggestions">
              {locations.map((l) => <option key={l} value={l} />)}
            </datalist>
          </div>
          <div><label>Duration (min)</label><input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="90" /></div>
        </div>
        {gyms.length > 0 && (
          <div>
            <label>Gym</label>
            <select value={gymId ?? ""} onChange={(e) => setGymId(e.target.value ? Number(e.target.value) : null)}
              style={{ fontFamily: "var(--font-hand)", fontSize: 16 }}>
              <option value="">— none —</option>
              {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label>Climbed with</label>
          <input value={partner} onChange={(e) => setPartner(e.target.value)}
            placeholder="Sam, Alex…" list="sv-partner-suggestions" autoComplete="off" />
          <datalist id="sv-partner-suggestions">
            {partners.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>
        <div><label>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="gap-row" style={{ justifyContent: "flex-end" }}>
          <button className="btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          <button className="btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="gap-row" style={{ justifyContent: "space-between" }}>
        <div>
          <h1>{fmtDay(session.date, "EEEE, MMMM d yyyy")}</h1>
          <div className="gap-row" style={{ marginTop: 4, flexWrap: "wrap" }}>
            {session.gym_id != null && gyms.find((g) => g.id === session.gym_id) && (
              <span className="muted" style={{ fontFamily: "var(--font-banner)", fontSize: 12, letterSpacing: "0.05em" }}>
                🧗 {gyms.find((g) => g.id === session.gym_id)!.name}
              </span>
            )}
            {session.location && <span className="muted">{session.location}</span>}
            {session.duration_minutes && <span className="muted">{session.duration_minutes} min</span>}
            {session.partner && (
              <span className="muted" style={{ fontStyle: "italic" }}>with {session.partner}</span>
            )}
          </div>
          {session.notes && <p style={{ marginTop: 6, fontSize: 14 }}>{session.notes}</p>}
        </div>
        <button className="btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit</button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SessionView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (id) api.getSession(Number(id)).then(setSession);
  }, [id]);

  async function handleDelete() {
    if (!session) return;
    setConfirmingDelete(false);
    setDeleting(true);
    await api.deleteSession(session.id);
    navigate("/sessions");
  }

  if (!session) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <div className="gap-row" style={{ justifyContent: "space-between", marginBottom: 16 }}>
        <Link to={`/sessions/${session.id}`} style={{ fontSize: 13 }}>← Quick Log</Link>
        <button className="btn-danger btn-sm" onClick={() => setConfirmingDelete(true)} disabled={deleting}>
          Delete session
        </button>
      </div>

      {confirmingDelete && (
        <ConfirmSheet title="DELETE SESSION?" message="The session and every tick logged in it go. This can't be undone."
          onConfirm={handleDelete} onCancel={() => setConfirmingDelete(false)} />
      )}

      <SessionHeader session={session} onUpdate={setSession} />

      <div className="gap-col">
        <WarmupSection sessionId={session.id} entries={session.warmup_entries}
          onChange={(e) => setSession({ ...session, warmup_entries: e })} />
        <LeadSection sessionId={session.id} entries={session.lead_route_entries}
          onChange={(e) => setSession({ ...session, lead_route_entries: e })} />
        <BoulderSection sessionId={session.id} entries={session.boulder_entries}
          onChange={(e) => setSession({ ...session, boulder_entries: e })} />
        <FingerboardSection sessionId={session.id} entries={session.fingerboard_entries}
          onChange={(e) => setSession({ ...session, fingerboard_entries: e })} />
        <StrengthSection sessionId={session.id} entries={session.strength_entries}
          onChange={(e) => setSession({ ...session, strength_entries: e })} />
      </div>
    </div>
  );
}
