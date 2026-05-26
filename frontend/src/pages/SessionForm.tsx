import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";

export default function SessionForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      api.getSession(Number(id)).then((s) => {
        setDate(s.date);
        setLocation(s.location ?? "");
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
      duration_minutes: duration ? Number(duration) : null,
      notes: notes || null,
    };
    try {
      if (isEdit) {
        await api.patchSession(Number(id), payload);
        navigate(`/sessions/${id}`);
      } else {
        const result = await api.createSession(payload);
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
        <div className="card gap-col">
          <div className="grid-3">
            <div>
              <label>Date *</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div>
              <label>Location / Gym</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Centenary Glen" />
            </div>
            <div>
              <label>Duration (min)</label>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="90" min="1" />
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
