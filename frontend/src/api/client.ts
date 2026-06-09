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
  route_id?: number | null;
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
  rating?: number | null;   // 1..5 friend-sticker rating
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
  kind: string;
  grade?: string | null;
  grade_system: string;
  location?: string | null;
  notes?: string | null;
  topo_filename?: string | null;
  rating?: number | null;       // 1..3 friend-sticker rating
  pin_count: number;
  last_pin_date?: string | null;
}

export interface RouteNote {
  id: number;
  route_id: number;
  user_id: number;
  username: string;
  text: string;
  created_at: string;
}

export interface RouteDetail extends RouteSummary {
  pins: RoutePin[];
  ticks: LeadRouteEntry[];
  boulder_ticks: BoulderEntry[];
  photos: EntryPhoto[];
  notes_log: RouteNote[];
}

export interface RoutePayload {
  name: string;
  kind?: string;
  grade?: string | null;
  grade_system?: string;
  location?: string | null;
  notes?: string | null;
  rating?: number | null;
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
  last_route_name?: string | null;
}

export interface SessionSummary {
  id: number;
  date: string;
  location?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  mood?: number | null;   // 1..5 self-rating
  partner?: string | null;  // "climbed with…"
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
  onsight: number;
  flash: number;
  redpoint: number;
}

export interface BoulderPyramidRow {
  grade: string;
  flash: number;
  send: number;
}

export interface Achievement {
  code: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  unlocked_at?: string | null;
}

export interface MoodSendRatePoint {
  mood: number;        // 1..5
  send_rate: number;   // 0..100
  sessions: number;
}

export interface LocationBreakdownRow {
  location: string;
  sessions: number;
  total_ticks: number;
  send_rate: number;
}

export interface AttemptsHistogramRow {
  bucket: string;   // "1", "2", "3", "4", "5+"
  count: number;
}

export interface PBTimelinePoint {
  date: string;
  lead_pb?: number | null;
  boulder_pb?: number | null;
  lead_grade?: string | null;
  boulder_grade?: string | null;
}

export type ProgressRange = "6w" | "6mo" | "1y" | "all";

export interface ProgressData {
  fingerboard_max_weight: ProgressPoint[];
  boulder_max_grade: ProgressPoint[];
  strength_max_weight: ProgressPoint[];
  lead_onsight_progression: ProgressPoint[];
  lead_flash_progression: ProgressPoint[];
  lead_redpoint_progression: ProgressPoint[];
  lead_send_pyramid: LeadPyramidRow[];
  boulder_send_pyramid: BoulderPyramidRow[];
  session_volume: ProgressPoint[];
  send_rate: ProgressPoint[];
  falls_trend: ProgressPoint[];
  mood_vs_send_rate: MoodSendRatePoint[];
  location_breakdown: LocationBreakdownRow[];
  attempts_histogram: AttemptsHistogramRow[];
  pb_timeline: PBTimelinePoint[];
}

export interface BuddyState {
  state: string;       // a CragState the frontend knows how to draw
  reason: string;      // machine-readable trigger, e.g. "new_pb"
  days_since: number;  // days since the most recent session (0 = today)
  build: number;       // 0..3 physique tier from all-time hardest send
}

const BASE = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",   // send/store the session cookie
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface AuthUser {
  id: number;
  username: string;
  is_admin: boolean;
  has_pin: boolean;
  share_to_feed: boolean;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reacted: boolean;
  reaction_id: number | null;
}

export interface ReactionOut {
  id: number;
  feed_key: string;
  user_id: number;
  emoji: string;
}

export interface FeedEvent {
  kind: "session" | "achievement";
  user_id: number;
  username: string;
  at: string;
  feed_key: string;
  // session events
  session_id?: number | null;
  date?: string | null;
  location?: string | null;
  total_ticks: number;
  boulder_sends: number;
  lead_sends: number;
  hardest_boulder?: string | null;
  hardest_lead?: string | null;
  training_only: boolean;
  is_pb: boolean;
  partner?: string | null;      // "climbed with…" tag
  // achievement events
  code?: string | null;
  title?: string | null;
  emoji?: string | null;
  // reactions / props
  reactions: ReactionSummary[];
}

export class AuthError extends Error {
  constructor(message: string) { super(message); this.name = "AuthError"; }
}

export interface SessionHeader {
  date: string;
  location?: string | null;
  duration_minutes?: number | null;
  notes?: string | null;
  mood?: number | null;
  partner?: string | null;
}

export const api = {
  // --- Auth ---
  me: () => req<AuthUser>("/auth/me"),
  register: (username: string, password: string) =>
    req<AuthUser>("/auth/register", { method: "POST", body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    req<AuthUser>("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  logout: () => req<void>("/auth/logout", { method: "POST" }),
  changePassword: (old_password: string, new_password: string) =>
    req<void>("/auth/me/password", {
      method: "POST",
      body: JSON.stringify({ old_password, new_password }),
    }),
  setPin: (password: string, pin: string) =>
    req<void>("/auth/me/pin", {
      method: "POST",
      body: JSON.stringify({ password, pin }),
    }),
  clearPin: (password: string) =>
    req<void>("/auth/me/pin", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }),
  verifyPin: (pin: string) =>
    req<void>("/auth/verify_pin", {
      method: "POST",
      body: JSON.stringify({ pin }),
    }),
  setFeedSharing: (share: boolean) =>
    req<AuthUser>("/auth/me/feed_sharing", {
      method: "POST",
      body: JSON.stringify({ share }),
    }),

  getFeed: (limit = 50) => req<FeedEvent[]>(`/feed?limit=${limit}`),
  addReaction: (feed_key: string, emoji: string) =>
    req<ReactionOut>("/feed/react", {
      method: "POST",
      body: JSON.stringify({ feed_key, emoji }),
    }),
  removeReaction: (reaction_id: number) =>
    req<void>(`/feed/react/${reaction_id}`, { method: "DELETE" }),

  listSessions: () => req<SessionSummary[]>("/sessions"),
  listLocations: () => req<string[]>("/locations"),
  listRouteNames: () => req<string[]>("/route_names"),

  getBuddy: () => req<BuddyState>("/buddy"),
  listAchievements: () => req<Achievement[]>("/achievements"),
  checkAchievements: () =>
    req<{ newly_unlocked: Achievement[] }>("/achievements/check", { method: "POST" }),
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
  getProgress: (range: ProgressRange = "all") =>
    req<ProgressData>(`/progress?range=${range}`),

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

  uploadPhoto: async (entryType: "lead" | "boulder" | "route", entryId: number, file: File): Promise<EntryPhoto> => {
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

  // --- Route beta notes ---
  addRouteNote: (routeId: number, text: string) =>
    req<RouteNote>(`/routes/${routeId}/notes`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  deleteRouteNote: (noteId: number) =>
    req<void>(`/route_notes/${noteId}`, { method: "DELETE" }),

  // --- Partners ---
  listPartners: () => req<string[]>("/partners"),

  // --- Export / Import ---
  exportData: async (): Promise<Blob> => {
    const res = await fetch(`${BASE}/export`);
    if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
    return res.blob();
  },
  importData: (payload: object) =>
    req<{ sessions_imported: number; routes_imported: number }>("/import", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
