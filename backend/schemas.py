from datetime import date
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
    sent: bool = False
    attempts: int | None = None
    notes: str | None = None


class LimitBoulderEntryCreate(LimitBoulderEntryBase):
    pass


class LimitBoulderEntry(LimitBoulderEntryBase):
    id: int
    session_id: int
    photos: list[EntryPhoto] = []
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


class LeadRouteEntryCreate(LeadRouteEntryBase):
    pass


class LeadRouteEntry(LeadRouteEntryBase):
    id: int
    session_id: int
    photos: list[EntryPhoto] = []
    model_config = {"from_attributes": True}


class SessionBase(BaseModel):
    date: date
    location: str | None = None
    duration_minutes: int | None = None
    notes: str | None = None


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
    warmup_entries: list[WarmupEntry] = []
    fingerboard_entries: list[FingerboardEntry] = []
    boulder_entries: list[LimitBoulderEntry] = []
    strength_entries: list[StrengthEntry] = []
    lead_route_entries: list[LeadRouteEntry] = []
    model_config = {"from_attributes": True}


class SessionPatch(BaseModel):
    date: date | None = None
    location: str | None = None
    duration_minutes: int | None = None
    notes: str | None = None


class SessionSummary(SessionBase):
    id: int
    model_config = {"from_attributes": True}


class ProgressPoint(BaseModel):
    date: date
    value: float
    label: str


class ProgressData(BaseModel):
    fingerboard_max_weight: list[ProgressPoint]
    boulder_max_grade: list[ProgressPoint]
    strength_max_weight: list[ProgressPoint]
    lead_max_grade_ewbank: list[ProgressPoint]
    lead_max_grade_yds: list[ProgressPoint]
    lead_max_grade_french: list[ProgressPoint]
