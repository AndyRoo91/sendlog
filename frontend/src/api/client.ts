export interface EntryPhoto {
  id: number;
  entry_type: string;
  entry_id: number;
  filename: string;
}

export interface WarmupEntry {
  id?: number;
  session_id?: number;
  activity: string;
  duration_minutes?: number | null;
  notes?: string | null;
}

export interface FingerboardEntry {
  id?: number;
  session_id?: number;
  edge_mm?: number | null;
  added_weight_kg?: number | null;
  hang_duration_s?: number | null;
  num_sets?: number | null;
  notes?: string | null;
}

export interface BoulderEntry {
  id?: number;
  session_id?: number;
  grade: string;
  sent: boolean;
  attempts?: number | null;
  notes?: string | null;
  photos?: EntryPhoto[];
}

export interface StrengthEntry {
  id?: number;
  session_id?: number;
  exercise: string;
  reps?: number | null;
  added_weight_kg?: number | null;
  notes?: string | null;
}

export interface LeadRouteEntry {
  id?: number;
  session_id?: number;
  route_name?: string | null;
  grade: string;
  grade_system: "ewbank" | "yds" | "french";
  send_type: string;
  attempts?: number | null;
  falls?: number | null;
  notes?: string | null;
  photos?: EntryPhoto[];
}

export interface SessionSummary {
  id: number;
  date: string;
  location?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
}

export interface SessionDetail extends SessionSummary {
  warmup_entries: WarmupEntry[];
  fingerboard_entries: FingerboardEntry[];
  boulder_entries: BoulderEntry[];
  strength_entries: StrengthEntry[];
  lead_route_entries: LeadRouteEntry[];
}

export interface SessionPayload {
  date: string;
  location?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  warmup_entries: WarmupEntry[];
  fingerboard_entries: FingerboardEntry[];
  boulder_entries: BoulderEntry[];
  strength_entries: StrengthEntry[];
  lead_route_entries: LeadRouteEntry[];
}

export interface ProgressPoint {
  date: string;
  value: number;
  label: string;
}

export interface ProgressData {
  fingerboard_max_weight: ProgressPoint[];
  boulder_max_grade: ProgressPoint[];
  strength_max_weight: ProgressPoint[];
  lead_max_grade_ewbank: ProgressPoint[];
  lead_max_grade_yds: ProgressPoint[];
  lead_max_grade_french: ProgressPoint[];
}

const BASE = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface SessionHeader {
  date: string;
  location?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
}

export const api = {
  listSessions: () => req<SessionSummary[]>("/sessions"),
  getSession: (id: number) => req<SessionDetail>(`/sessions/${id}`),
  createSession: (payload: SessionHeader) =>
    req<SessionDetail>("/sessions", { method: "POST", body: JSON.stringify(payload) }),
  patchSession: (id: number, payload: Partial<SessionHeader>) =>
    req<SessionDetail>(`/sessions/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSession: (id: number) =>
    req<void>(`/sessions/${id}`, { method: "DELETE" }),
  getProgress: () => req<ProgressData>("/progress"),

  addWarmup: (sessionId: number, payload: Omit<WarmupEntry, "id" | "session_id">) =>
    req<WarmupEntry>(`/sessions/${sessionId}/warmup`, { method: "POST", body: JSON.stringify(payload) }),
  updateWarmup: (id: number, payload: Omit<WarmupEntry, "id" | "session_id">) =>
    req<WarmupEntry>(`/warmup/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteWarmup: (id: number) => req<void>(`/warmup/${id}`, { method: "DELETE" }),

  addFingerboard: (sessionId: number, payload: Omit<FingerboardEntry, "id" | "session_id">) =>
    req<FingerboardEntry>(`/sessions/${sessionId}/fingerboard`, { method: "POST", body: JSON.stringify(payload) }),
  updateFingerboard: (id: number, payload: Omit<FingerboardEntry, "id" | "session_id">) =>
    req<FingerboardEntry>(`/fingerboard/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteFingerboard: (id: number) => req<void>(`/fingerboard/${id}`, { method: "DELETE" }),

  addBoulder: (sessionId: number, payload: Omit<BoulderEntry, "id" | "session_id" | "photos">) =>
    req<BoulderEntry>(`/sessions/${sessionId}/boulder`, { method: "POST", body: JSON.stringify(payload) }),
  updateBoulder: (id: number, payload: Omit<BoulderEntry, "id" | "session_id" | "photos">) =>
    req<BoulderEntry>(`/boulder/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteBoulder: (id: number) => req<void>(`/boulder/${id}`, { method: "DELETE" }),

  addLead: (sessionId: number, payload: Omit<LeadRouteEntry, "id" | "session_id" | "photos">) =>
    req<LeadRouteEntry>(`/sessions/${sessionId}/lead`, { method: "POST", body: JSON.stringify(payload) }),
  updateLead: (id: number, payload: Omit<LeadRouteEntry, "id" | "session_id" | "photos">) =>
    req<LeadRouteEntry>(`/lead/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteLead: (id: number) => req<void>(`/lead/${id}`, { method: "DELETE" }),

  addStrength: (sessionId: number, payload: Omit<StrengthEntry, "id" | "session_id">) =>
    req<StrengthEntry>(`/sessions/${sessionId}/strength`, { method: "POST", body: JSON.stringify(payload) }),
  updateStrength: (id: number, payload: Omit<StrengthEntry, "id" | "session_id">) =>
    req<StrengthEntry>(`/strength/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteStrength: (id: number) => req<void>(`/strength/${id}`, { method: "DELETE" }),

  uploadPhoto: async (entryType: "lead" | "boulder", entryId: number, file: File): Promise<EntryPhoto> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/photos/upload?entry_type=${entryType}&entry_id=${entryId}`, {
      method: "POST", body: form,
    });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json();
  },
  deletePhoto: (photoId: number) => req<void>(`/photos/${photoId}`, { method: "DELETE" }),
};
