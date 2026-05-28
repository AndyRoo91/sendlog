"""Achievement definitions + idempotent unlock check.

Definitions live here so the catalogue is easy to extend; the check function
takes the current DB state, inserts any newly-earned ``Achievement`` rows,
and returns them so the frontend can celebrate.
"""
from collections import Counter
from dataclasses import dataclass
from typing import Callable

from sqlalchemy.orm import Session as DBSession

import models

# send_type strings that count as "you actually sent it"
SEND_TYPES = {"redpoint", "pinkpoint", "flash", "onsight"}

# Grade ladders mirrored from main.py — kept local so we don't pull main as a dep.
BOULDER_GRADES = [f"V{i}" for i in range(17)]   # V0..V16
EWBANK_GRADES = [str(n) for n in range(1, 39)]  # 1..38


@dataclass(frozen=True)
class AchievementDef:
    code: str
    title: str
    description: str
    emoji: str
    check: Callable[["EvalState"], bool]


@dataclass
class EvalState:
    """All session/tick data we need to evaluate every achievement, computed once."""
    leads: list
    boulders: list
    fingerboard_session_ids: set[int]
    flash_count_by_session: dict[int, int]
    session_dates_by_id: dict[int, object]  # session_id -> date

    @classmethod
    def from_db(cls, db: DBSession) -> "EvalState":
        leads = db.query(models.LeadRouteEntry).all()
        boulders = db.query(models.LimitBoulderEntry).all()
        fingerboard = db.query(models.FingerboardEntry).all()
        sessions = db.query(models.Session).all()

        flash_by_session: Counter[int] = Counter()
        for e in leads + boulders:
            if e.send_type == "flash":
                flash_by_session[e.session_id] += 1

        return cls(
            leads=leads,
            boulders=boulders,
            fingerboard_session_ids={f.session_id for f in fingerboard},
            flash_count_by_session=dict(flash_by_session),
            session_dates_by_id={s.id: s.date for s in sessions},
        )


def _any_send(entries) -> bool:
    return any(e.send_type in SEND_TYPES for e in entries)


def _has_send_at_or_above(entries, grade: str, ladder: list[str], system: str | None = None) -> bool:
    """True if any entry is a send at or above the named grade (within the given system, if specified)."""
    target = ladder.index(grade)
    for e in entries:
        if e.send_type not in SEND_TYPES:
            continue
        if system is not None and getattr(e, "grade_system", None) != system:
            continue
        try:
            if ladder.index(e.grade) >= target:
                return True
        except ValueError:
            pass
    return False


def _boulder_grade_milestone(grade: str):
    return lambda s: _has_send_at_or_above(s.boulders, grade, BOULDER_GRADES)


def _ewbank_grade_milestone(grade: str):
    return lambda s: _has_send_at_or_above(s.leads, grade, EWBANK_GRADES, system="ewbank")


def _send_it_sunday(s: EvalState) -> bool:
    # Any entry on a Sunday (weekday() == 6) that was a send.
    for e in s.leads + s.boulders:
        if e.send_type not in SEND_TYPES:
            continue
        d = s.session_dates_by_id.get(e.session_id)
        if d is not None and d.weekday() == 6:
            return True
    return False


def _project_slayer(s: EvalState) -> bool:
    for e in s.leads + s.boulders:
        if e.send_type in SEND_TYPES and (e.attempts or 0) >= 5:
            return True
    return False


def _easter_v16(s: EvalState) -> bool:
    return any(e.grade == "V16" for e in s.boulders)


def _easter_grade_38(s: EvalState) -> bool:
    return any(e.grade == "38" and getattr(e, "grade_system", None) == "ewbank" for e in s.leads)


DEFS: list[AchievementDef] = [
    AchievementDef("first_lead", "First Burn",
                   "Log your first lead route.", "🥇",
                   lambda s: bool(s.leads)),
    AchievementDef("first_boulder", "First Pad",
                   "Log your first boulder problem.", "🪨",
                   lambda s: bool(s.boulders)),
    AchievementDef("first_lead_send", "Anchors Clipped",
                   "Send your first lead route.", "🎉",
                   lambda s: _any_send(s.leads)),
    AchievementDef("first_boulder_send", "Top Out",
                   "Send your first boulder problem.", "🤘",
                   lambda s: _any_send(s.boulders)),

    AchievementDef("boulder_v3", "Solid V3",
                   "Send a V3 boulder.", "🟢",
                   _boulder_grade_milestone("V3")),
    AchievementDef("boulder_v5", "Strong V5",
                   "Send a V5 boulder.", "🟡",
                   _boulder_grade_milestone("V5")),
    AchievementDef("boulder_v7", "First V7!",
                   "Send a V7 boulder.", "🔥",
                   _boulder_grade_milestone("V7")),
    AchievementDef("boulder_v9", "Crusher (V9)",
                   "Send a V9 boulder.", "👑",
                   _boulder_grade_milestone("V9")),

    AchievementDef("lead_18", "First 18",
                   "Send a grade 18 lead.", "🟢",
                   _ewbank_grade_milestone("18")),
    AchievementDef("lead_22", "Solid 22",
                   "Send a grade 22 lead.", "🟡",
                   _ewbank_grade_milestone("22")),
    AchievementDef("lead_25", "First 25!",
                   "Send a grade 25 lead.", "🔥",
                   _ewbank_grade_milestone("25")),
    AchievementDef("lead_28", "Wizard (28)",
                   "Send a grade 28 lead.", "🧙",
                   _ewbank_grade_milestone("28")),

    AchievementDef("flash_machine", "Flash Machine",
                   "3 flashes in a single session.", "⚡",
                   lambda s: any(v >= 3 for v in s.flash_count_by_session.values())),
    AchievementDef("century_club", "Century Club",
                   "100 ticks logged.", "💯",
                   lambda s: len(s.leads) + len(s.boulders) >= 100),
    AchievementDef("project_slayer", "Project Slayer",
                   "Send something on attempt 5 or later.", "⚔️",
                   _project_slayer),
    AchievementDef("crimp_lord", "Crimp Lord",
                   "10 sessions with fingerboard work.", "💪",
                   lambda s: len(s.fingerboard_session_ids) >= 10),
    AchievementDef("send_it_sunday", "Send-it Sunday",
                   "Send something on a Sunday.", "☀️",
                   _send_it_sunday),

    AchievementDef("easter_v16", "Sure About That?",
                   "Log a V16. (🤨)", "🤨",
                   _easter_v16),
    AchievementDef("easter_grade_38", "Sure About That?",
                   "Log a grade 38. (🤨)", "🤨",
                   _easter_grade_38),
]

DEF_BY_CODE: dict[str, AchievementDef] = {d.code: d for d in DEFS}


def evaluate_should_be_unlocked(db: DBSession) -> set[str]:
    state = EvalState.from_db(db)
    return {d.code for d in DEFS if d.check(state)}


def check_and_unlock(db: DBSession) -> list[AchievementDef]:
    """Insert any newly-earned achievements and return their defs."""
    should_be = evaluate_should_be_unlocked(db)
    already = {a.code for a in db.query(models.Achievement).all()}
    new_codes = should_be - already
    if not new_codes:
        return []
    for code in new_codes:
        db.add(models.Achievement(code=code))
    db.commit()
    # Return in DEFS order for stable presentation.
    return [d for d in DEFS if d.code in new_codes]
