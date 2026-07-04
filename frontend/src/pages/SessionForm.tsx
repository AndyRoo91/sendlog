import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { Gym } from "../api/client";
import { lastGymId, rememberGym } from "../lib/lastUsed";


export default function SessionForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState("");
  const [gymId, setGymId] = useState<number | null>(null);
  const [partner, setPartner] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [partners, setPartners] = useState<string[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);

  useEffect(() => {
    api.listLocations().then(setLocations).catch(() => {});
    api.listPartners().then(setPartners).catch(() => {});
    api.listGyms().then((gs) => {
      setGyms(gs);
      // New sessions default to the last gym you logged at (if it still exists).
      if (!id) {
        const last = lastGymId();
        if (last != null && gs.some((g) => g.id === last)) setGymId(last);
      }
    }).catch(() => {});
    if (id) {
      api.getSession(Number(id)).then((s) => {
        setDate(s.date);
        setLocation(s.location ?? "");
        setGymId(s.gym_id ?? null);
        setPartner(s.partner ?? "");
        setDuration(s.duration_minutes?.toString() ?? "");
        setNotes(s.notes ?? "");
      });
    }
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      date,
      location: location || null,
      gym_id: gymId,
      partner: partner || null,
      duration_minutes: duration ? Number(duration) : null,
      notes: notes || null,
    };
    try {
      if (isEdit) {
        await api.patchSession(Number(id), payload);
        rememberGym(gymId);
        navigate(`/sessions/${id}`);
      } else {
        const result = await api.createSession(payload);
        rememberGym(gymId);
        navigate(`/sessions/${result.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <h1 style={{ marginBottom: 24 }}>{isEdit ? "Edit Session" : "Start Session"}</h1>
      <form onSubmit={handleSubmit}>
        <div className="card gap-col boil-frame">
          <div className="grid-3">
            <div>
              <label>Date *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label>Location / Crag</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Centenary Glen" list="location-suggestions" autoComplete="off" />
              <datalist id="location-suggestions">
                {locations.map((l) => <option key={l} value={l} />)}
              </datalist>
            </div>
            <div>
              <label>Duration (min)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="90" min="1" />
            </div>
          </div>
          <div className="grid-2">
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
                placeholder="Sam, Alex…" list="partner-suggestions" autoComplete="off" />
              <datalist id="partner-suggestions">
                {partners.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
          </div>
          <div>
            <label>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Goals, conditions, how you're feeling…" />
          </div>
          <div className="gap-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save" : "Start Session →"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
