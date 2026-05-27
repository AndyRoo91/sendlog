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
  send_type: string;
  attempts?: number | null;
  notes?: string | null;
  photos?: EntryPhoto[];
  logged_at?: string | null;
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
  logged_at?: string | null;
  route_id?: number | null;
}

export interface RoutePin {
  id: number;
  route_id: number;
  date: string;
  x: number;
  y: number;
  kind: string;
  note?: string | null;
}

export interface RouteSummary {
  id: number;
  name: string;
  grade?: string | null;
  grade_system: string;
  location?: string | null;
  notes?: string | null;
  topo_filename?: string | null;
  pin_count: number;
  last_pin_date?: string | null;
}

export interface RouteDetail extends RouteSummary {
  pins: RoutePin[];
  ticks: LeadRouteEntry[];
}

export interface RoutePayload {
  name: string;
  grade?: string | null;
  grade_system?: string;
  location?: string | null;
  notes?: string | null;
}

export interface PinPayload {
  date: string;
  x: number;
  y: number;
  kind: string;
  note?: string | null;
}

export interface RecentCombo {
  kind: "boulder" | "lead";
  grade: string;
  grade_system: string;
  send_type: string;
  count: number;
  last_logged_at?: string | null;
}

export interface SessionSummary {
  id: number;
  date: string;
  location?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
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

export interface LeadPyramidRow {
  grade: string;
  flash: number;
  redpoint: number;
}

export interface ProgressData {
  fingerboard_max_weight: ProgressPoint[];
  boulder_max_grade: ProgressPoint[];
  strength_max_weight: ProgressPoint[];
  lead_flash_progression: ProgressPoint[];
  lead_redpoint_progression: ProgressPoint[];
  lead_send_pyramid: LeadPyramidRow[];
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
  startSession: (id: number) =>
    req<SessionDetail>(`/sessions/${id}/start`, { method: "POST" }),
  endSession: (id: number) =>
    req<SessionDetail>(`/sessions/${id}/end`, { method: "POST" }),
  getRecentCombos: (id: number) =>
    req<RecentCombo[]>(`/sessions/${id}/recent_combos`),
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

  // --- Routes (projects) + pins ---
  listRoutes: () => req<RouteSummary[]>("/routes"),
  getRoute: (id: number) => req<RouteDetail>(`/routes/${id}`),
  createRoute: (payload: RoutePayload) =>
    req<RouteDetail>("/routes", { method: "POST", body: JSON.stringify(payload) }),
  updateRoute: (id: number, payload: Partial<RoutePayload>) =>
    req<RouteDetail>(`/routes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteRoute: (id: number) => req<void>(`/routes/${id}`, { method: "DELETE" }),
  uploadTopo: async (routeId: number, file: File): Promise<RouteDetail> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/routes/${routeId}/topo`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.json();
  },
  topoFromPhoto: (routeId: number, photoId: number) =>
    req<RouteDetail>(`/routes/${routeId}/topo/from-photo?photo_id=${photoId}`, { method: "POST" }),
  addPin: (routeId: number, payload: PinPayload) =>
    req<RoutePin>(`/routes/${routeId}/pins`, { method: "POST", body: JSON.stringify(payload) }),
  updatePin: (pinId: number, payload: Partial<PinPayload>) =>
    req<RoutePin>(`/pins/${pinId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deletePin: (pinId: number) => req<void>(`/pins/${pinId}`, { method: "DELETE" }),
};
