from datetime import date as DateType, datetime
from typing import Any
from pydantic import BaseModel


class WarmupEntryBase(BaseModel):
    activity: str
    duration_minutes: int | None = None
    notes: str | None = None


class WarmupEntryCreate(WarmupEntryBase):
    pass


class WarmupEntry(WarmupEntryBase):
    id: int
    session_id: int
    model_config = {"from_attributes": True}


class FingerboardEntryBase(BaseModel):
    edge_mm: int | None = None
    added_weight_kg: float | None = None
    hang_duration_s: int | None = None
    num_sets: int | None = None
    notes: str | None = None


class FingerboardEntryCreate(FingerboardEntryBase):
    pass


class FingerboardEntry(FingerboardEntryBase):
    id: int
    session_id: int
    model_config = {"from_attributes": True}


class EntryPhoto(BaseModel):
    id: int
    entry_type: str
    entry_id: int
    filename: str
    model_config = {"from_attributes": True}


class LimitBoulderEntryBase(BaseModel):
    grade: str
    send_type: str = "redpoint"
    attempts: int | None = None
    notes: str | None = None


class LimitBoulderEntryCreate(LimitBoulderEntryBase):
    route_id: int | None = None


class LimitBoulderEntry(LimitBoulderEntryBase):
    id: int
    session_id: int
    photos: list[EntryPhoto] = []
    logged_at: datetime | None = None
    route_id: int | None = None
    model_config = {"from_attributes": True}


class StrengthEntryBase(BaseModel):
    exercise: str
    reps: int | None = None
    added_weight_kg: float | None = None
    notes: str | None = None


class StrengthEntryCreate(StrengthEntryBase):
    pass


class StrengthEntry(StrengthEntryBase):
    id: int
    session_id: int
    model_config = {"from_attributes": True}


class LeadRouteEntryBase(BaseModel):
    route_name: str | None = None
    grade: str
    grade_system: str = "ewbank"
    send_type: str = "redpoint"
    attempts: int | None = None
    falls: int | None = None
    notes: str | None = None
    route_id: int | None = None
    rating: int | None = None   # 1..5 friend-sticker rating


class LeadRouteEntryCreate(LeadRouteEntryBase):
    pass


class LeadRouteEntry(LeadRouteEntryBase):
    id: int
    session_id: int
    photos: list[EntryPhoto] = []
    logged_at: datetime | None = None
    model_config = {"from_attributes": True}


class SessionBase(BaseModel):
    date: DateType
    location: str | None = None
    duration_minutes: int | None = None
    notes: str | None = None
    mood: int | None = None  # 1..5 self-rating


class SessionCreate(SessionBase):
    warmup_entries: list[WarmupEntryCreate] = []
    fingerboard_entries: list[FingerboardEntryCreate] = []
    boulder_entries: list[LimitBoulderEntryCreate] = []
    strength_entries: list[StrengthEntryCreate] = []
    lead_route_entries: list[LeadRouteEntryCreate] = []


class SessionUpdate(SessionBase):
    warmup_entries: list[WarmupEntryCreate] = []
    fingerboard_entries: list[FingerboardEntryCreate] = []
    boulder_entries: list[LimitBoulderEntryCreate] = []
    strength_entries: list[StrengthEntryCreate] = []
    lead_route_entries: list[LeadRouteEntryCreate] = []


class SessionDetail(SessionBase):
    id: int
    started_at: datetime | None = None
    ended_at: datetime | None = None
    warmup_entries: list[WarmupEntry] = []
    fingerboard_entries: list[FingerboardEntry] = []
    boulder_entries: list[LimitBoulderEntry] = []
    strength_entries: list[StrengthEntry] = []
    lead_route_entries: list[LeadRouteEntry] = []
    model_config = {"from_attributes": True}


class SessionPatch(BaseModel):
    date: DateType | None = None
    location: str | None = None
    duration_minutes: int | None = None
    notes: str | None = None
    mood: int | None = None


class SessionSummary(SessionBase):
    id: int
    started_at: datetime | None = None
    ended_at: datetime | None = None
    model_config = {"from_attributes": True}


class RecentCombo(BaseModel):
    kind: str            # "boulder" | "lead"
    grade: str
    grade_system: str
    send_type: str
    count: int
    last_logged_at: datetime | None = None
    last_route_name: str | None = None  # lead only


class ProgressPoint(BaseModel):
    date: DateType
    value: float
    label: str


class LeadPyramidRow(BaseModel):
    grade: str
    onsight: int = 0
    flash: int
    redpoint: int


class BoulderPyramidRow(BaseModel):
    grade: str
    flash: int = 0
    send: int = 0


class MoodSendRatePoint(BaseModel):
    mood: int            # 1..5
    send_rate: float     # 0..100 (avg % across sessions at this mood)
    sessions: int


class LocationBreakdownRow(BaseModel):
    location: str
    sessions: int
    total_ticks: int
    send_rate: float     # 0..100


class AttemptsHistogramRow(BaseModel):
    bucket: str          # "1", "2", "3", "4", "5+"
    count: int


class PBTimelinePoint(BaseModel):
    date: DateType
    lead_pb: int | None = None        # running max Ewbank number (int) sent so far
    boulder_pb: int | None = None     # running max V-scale ladder index sent so far
    lead_grade: str | None = None
    boulder_grade: str | None = None


class ProgressData(BaseModel):
    fingerboard_max_weight: list[ProgressPoint]
    boulder_max_grade: list[ProgressPoint]
    strength_max_weight: list[ProgressPoint]
    # Lead (Ewbank only)
    lead_onsight_progression: list[ProgressPoint] = []
    lead_flash_progression: list[ProgressPoint]
    lead_redpoint_progression: list[ProgressPoint]
    lead_send_pyramid: list[LeadPyramidRow]
    # Boulder (V-scale)
    boulder_send_pyramid: list[BoulderPyramidRow] = []
    # Volume / trends
    session_volume: list[ProgressPoint] = []
    send_rate: list[ProgressPoint] = []
    falls_trend: list[ProgressPoint] = []
    # Phase I additions
    mood_vs_send_rate: list[MoodSendRatePoint] = []
    location_breakdown: list[LocationBreakdownRow] = []
    attempts_histogram: list[AttemptsHistogramRow] = []
    pb_timeline: list[PBTimelinePoint] = []


# --- Routes (projects) + pins ---

class RoutePinBase(BaseModel):
    date: DateType
    x: float
    y: float
    kind: str = "highpoint"
    note: str | None = None


class RoutePinCreate(RoutePinBase):
    pass


class RoutePinUpdate(BaseModel):
    date: DateType | None = None
    x: float | None = None
    y: float | None = None
    kind: str | None = None
    note: str | None = None


class RoutePin(RoutePinBase):
    id: int
    route_id: int
    model_config = {"from_attributes": True}


class RouteBase(BaseModel):
    name: str
    kind: str = "lead"
    grade: str | None = None
    grade_system: str = "ewbank"
    location: str | None = None
    notes: str | None = None
    rating: int | None = None   # 1..3 friend-sticker rating


class RouteCreate(RouteBase):
    pass


class RouteUpdate(BaseModel):
    name: str | None = None
    kind: str | None = None
    grade: str | None = None
    grade_system: str | None = None
    location: str | None = None
    notes: str | None = None
    rating: int | None = None


class RouteSummary(RouteBase):
    id: int
    topo_filename: str | None = None
    pin_count: int = 0
    last_pin_date: DateType | None = None
    model_config = {"from_attributes": True}


class RouteDetail(RouteBase):
    id: int
    topo_filename: str | None = None
    pins: list[RoutePin] = []
    ticks: list[LeadRouteEntry] = []
    boulder_ticks: list[LimitBoulderEntry] = []
    photos: list[EntryPhoto] = []
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Export / Import
# ---------------------------------------------------------------------------

class ImportPayload(BaseModel):
    """Accepted body for POST /api/import. Uses Any so unknown future fields
    are ignored gracefully."""
    version: int = 1
    sessions: list[Any] = []
    routes: list[Any] = []


class ImportResult(BaseModel):
    sessions_imported: int
    routes_imported: int


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------

class Achievement(BaseModel):
    code: str
    title: str
    description: str
    emoji: str
    unlocked: bool
    unlocked_at: datetime | None = None


class AchievementCheckResult(BaseModel):
    newly_unlocked: list[Achievement]


class FeedEvent(BaseModel):
    """One item in the shared instance feed. Derived from existing data — a logged
    session or an unlocked achievement — and tagged with the climber it belongs to."""
    kind: str                       # "session" | "achievement"
    user_id: int
    username: str
    at: datetime                    # sort key (session start/date or unlock time)

    # session events
    session_id: int | None = None
    date: DateType | None = None
    location: str | None = None
    total_ticks: int = 0
    boulder_sends: int = 0
    lead_sends: int = 0
    hardest_boulder: str | None = None
    hardest_lead: str | None = None
    training_only: bool = False     # board/strength day, no boulder/lead ticks
    is_pb: bool = False             # this session set a new all-time PB for the user

    # achievement events
    code: str | None = None
    title: str | None = None
    emoji: str | None = None


class BuddyState(BaseModel):
    """Climbing-buddy mood for the Dashboard greeting, computed from session data."""
    state: str          # one of the CragState values the frontend knows how to draw
    reason: str         # machine-readable trigger, e.g. "new_pb", "high_falls"
    days_since: int     # days since the most recent session (0 = today)
    build: int = 0      # 0..3 physique tier from all-time hardest send (scrawny→jacked)


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class AuthCredentials(BaseModel):
    username: str
    password: str


class AuthUser(BaseModel):
    """Public user shape — never includes hashes."""
    id: int
    username: str
    is_admin: bool
    has_pin: bool
    share_to_feed: bool = True
    model_config = {"from_attributes": True}


class FeedSharingUpdate(BaseModel):
    share: bool


class PasswordChange(BaseModel):
    old_password: str
    new_password: str


class PinSet(BaseModel):
    """Set or replace a PIN. Requires the user's current password as a guard
    so a stolen-cookie session can't lower the security bar."""
    password: str
    pin: str


class PinClear(BaseModel):
    password: str


class PinVerify(BaseModel):
    pin: str
