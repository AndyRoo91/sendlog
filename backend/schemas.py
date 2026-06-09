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
    wall_id: int | None = None   # gym wall this tick is on
    hold_color: str | None = None  # hex hold/circuit colour


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
    wall_id: int | None = None  # gym wall this tick is on


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
    gym_id: int | None = None  # optional first-class venue
    duration_minutes: int | None = None
    notes: str | None = None
    mood: int | None = None  # 1..5 self-rating
    partner: str | None = None  # free-text "climbed with…"


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
    gym_id: int | None = None
    duration_minutes: int | None = None
    notes: str | None = None
    mood: int | None = None
    partner: str | None = None


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


class SendDetail(BaseModel):
    """One individual send — feeds the pyramid bar drill-down sheet."""
    grade: str
    send_type: str
    date: DateType
    session_id: int
    route_name: str | None = None
    attempts: int | None = None


class DailyActivity(BaseModel):
    """One calendar day's climbing tick volume — feeds the contribution heatmap."""
    date: DateType
    ticks: int


class SessionIntensity(BaseModel):
    """One session's volume vs its hardest send — feeds the volume/intensity scatter.
    Grades live on two scales, so boulder + lead are carried separately."""
    date: DateType
    total_ticks: int
    hardest_boulder: int | None = None       # V-scale ladder index
    hardest_lead: int | None = None          # Ewbank number
    hardest_boulder_label: str | None = None
    hardest_lead_label: str | None = None


class TrainingLoadPoint(BaseModel):
    """Acute:chronic workload ratio for one active day — overtraining/injury signal.
    acute = avg daily load over the last 7 days, chronic = over the last 28."""
    date: DateType
    acute: float
    chronic: float
    ratio: float


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
    # Phase M additions
    daily_activity: list[DailyActivity] = []
    session_intensity: list[SessionIntensity] = []
    lead_sends: list[SendDetail] = []        # individual sends for pyramid drill-down
    boulder_sends: list[SendDetail] = []
    training_load: list[TrainingLoadPoint] = []   # acute:chronic workload ratio


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


class RouteNote(BaseModel):
    """A single beta / progress note on a project, newest last."""
    id: int
    route_id: int
    user_id: int
    username: str   # denormalised for display (not in DB — populated on read)
    text: str
    created_at: datetime


class RouteNoteCreate(BaseModel):
    text: str


class RouteDetail(RouteBase):
    id: int
    topo_filename: str | None = None
    pins: list[RoutePin] = []
    ticks: list[LeadRouteEntry] = []
    boulder_ticks: list[LimitBoulderEntry] = []
    photos: list[EntryPhoto] = []
    notes_log: list[RouteNote] = []   # beta / progress notes thread
    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Gyms + walls (Phase P)
# ---------------------------------------------------------------------------

class WallSetCreate(BaseModel):
    label: str | None = None
    set_on: DateType | None = None   # defaults to today server-side
    problem_count: int | None = None


class WallSetUpdate(BaseModel):
    label: str | None = None
    set_on: DateType | None = None
    problem_count: int | None = None


class Circuit(BaseModel):
    """A colour circuit within a set. tick_count is derived from the colour tags;
    total_count (optional) is the denominator for N/total progress."""
    color: str
    total_count: int | None = None
    label: str | None = None
    tick_count: int = 0
    circuit_id: int | None = None   # SetCircuit row id when a total was set


class CircuitUpsert(BaseModel):
    color: str
    total_count: int | None = None
    label: str | None = None


class WallSet(BaseModel):
    id: int
    wall_id: int
    label: str | None = None
    set_on: DateType
    problem_count: int | None = None
    tick_count: int = 0   # distinct ticks logged on this wall since set_on
    circuits: list[Circuit] = []   # per-colour breakdown within this set
    model_config = {"from_attributes": True}


class WallBase(BaseModel):
    name: str
    angle: int | None = None   # degrees from vertical (− slab, 0 vertical, + overhang)


class WallCreate(WallBase):
    pass


class WallUpdate(BaseModel):
    name: str | None = None
    angle: int | None = None


class Wall(WallBase):
    id: int
    gym_id: int
    sets: list[WallSet] = []           # set history, oldest first
    current_set: WallSet | None = None  # newest by set_on, with tick_count
    model_config = {"from_attributes": True}


class GymBase(BaseModel):
    name: str


class GymCreate(GymBase):
    pass


class GymUpdate(BaseModel):
    name: str | None = None


class Gym(GymBase):
    id: int
    floorplan_filename: str | None = None  # reserved for a later floorplan feature
    walls: list[Wall] = []
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


class ReactionSummary(BaseModel):
    """Aggregate of one emoji's reactions on a single feed event."""
    emoji: str
    count: int
    reacted: bool                   # True if the viewing user gave this reaction
    reaction_id: int | None = None  # their row ID (for DELETE), or None if not reacted


class ReactionOut(BaseModel):
    """Newly created reaction row returned from POST /api/feed/react."""
    id: int
    feed_key: str
    user_id: int
    emoji: str
    model_config = {"from_attributes": True}


class ReactPayload(BaseModel):
    feed_key: str
    emoji: str


class FeedEvent(BaseModel):
    """One item in the shared instance feed. Derived from existing data — a logged
    session or an unlocked achievement — and tagged with the climber it belongs to."""
    kind: str                       # "session" | "achievement"
    user_id: int
    username: str
    at: datetime                    # sort key (session start/date or unlock time)
    feed_key: str                   # stable event identifier for reactions

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
    partner: str | None = None      # "climbed with…" tag from the session

    # achievement events
    code: str | None = None
    title: str | None = None
    emoji: str | None = None

    # reactions (populated by _build_feed, keyed by viewing user)
    reactions: list[ReactionSummary] = []


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
    weekly_session_goal: int | None = None
    weekly_tick_goal: int | None = None
    model_config = {"from_attributes": True}


class FeedSharingUpdate(BaseModel):
    share: bool


class GoalsUpdate(BaseModel):
    weekly_session_goal: int | None = None
    weekly_tick_goal: int | None = None


class WeeklyProgress(BaseModel):
    week_start: DateType
    sessions: int
    ticks: int
    session_goal: int | None = None
    tick_goal: int | None = None


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
