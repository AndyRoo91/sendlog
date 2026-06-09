"""Built-in training-plan templates (Phase Q3).

A template defines a repeating weekly structure. Generating a plan replays the
weekly sessions across ``weeks``, offset from the chosen start date by each
session's ``day`` (0 = first day of the week).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class PlannedItem:
    day: int        # days from the start of each week (0 = week start)
    title: str
    focus: str


@dataclass(frozen=True)
class PlanTemplate:
    key: str
    name: str
    description: str
    weeks: int
    weekly: list[PlannedItem]
    phases: list[str]   # one phase label per week (base/build/power/peak/deload/skill)


TEMPLATES: list[PlanTemplate] = [
    PlanTemplate(
        key="power_endurance",
        name="4-Week Power Endurance",
        description="Three sessions a week building anaerobic capacity: limit work, "
                    "circuits, then mileage.",
        weeks=4,
        weekly=[
            PlannedItem(0, "Limit bouldering", "Hard, low-volume problems near your max."),
            PlannedItem(2, "4×4s / circuits", "Power-endurance: four boulders ×four, minimal rest."),
            PlannedItem(4, "Lead volume", "Mileage on moderate routes, steady pump."),
        ],
        phases=["build", "build", "build", "peak"],
    ),
    PlanTemplate(
        key="max_strength",
        name="4-Week Max Strength",
        description="Two heavy fingerboard days bracketing a limit-bouldering day each week.",
        weeks=4,
        weekly=[
            PlannedItem(0, "Max hangs", "Heavy fingerboard: 7–10s near-max, full rest."),
            PlannedItem(2, "Limit bouldering", "Max-effort problems, long rests."),
            PlannedItem(4, "Max hangs", "Heavy fingerboard: 7–10s near-max, full rest."),
        ],
        phases=["build", "build", "build", "peak"],
    ),
    PlanTemplate(
        key="base_fitness",
        name="3-Week Base",
        description="A gentle re-entry block — volume and easy mileage to rebuild a base.",
        weeks=3,
        weekly=[
            PlannedItem(0, "Volume bouldering", "Lots of easy-to-moderate problems."),
            PlannedItem(2, "Endurance laps", "Up-down-up laps on easy routes."),
            PlannedItem(5, "Easy mileage", "Relaxed session, movement quality."),
        ],
        phases=["base", "base", "base"],
    ),
    PlanTemplate(
        key="lead_redpoint",
        name="5-Week Lead Redpoint",
        description="Push your lead grade — bouldering power feeds route projecting, then "
                    "full redpoint burns. Keep a hard route as your project throughout.",
        weeks=5,
        weekly=[
            PlannedItem(0, "Limit bouldering", "Power for the hard moves — boulder near your max."),
            PlannedItem(2, "Route projecting", "Work a route 1–2 grades above your onsight level; "
                                               "rehearse and link the cruxes."),
            PlannedItem(4, "Redpoint burns", "Full redpoint attempts on your project, long rests "
                                             "between goes."),
        ],
        phases=["build", "build", "power", "peak", "peak"],
    ),
    PlanTemplate(
        key="lead_endurance",
        name="4-Week Lead Endurance",
        description="Build a lead engine: an aerobic base from continuous laps, plus "
                    "power-endurance intervals and route mileage.",
        weeks=4,
        weekly=[
            PlannedItem(0, "ARC laps", "20–30 min of continuous easy climbing — up-down-climb laps "
                                       "at a mild, sustainable pump. Never come off the wall."),
            PlannedItem(2, "4×4s", "Power-endurance intervals: four boulders ×four, minimal rest."),
            PlannedItem(4, "Route laps", "2–3 laps on a route around your onsight grade, full "
                                         "recovery between."),
        ],
        phases=["base", "build", "build", "peak"],
    ),
    PlanTemplate(
        key="technique",
        name="3-Week Technique",
        description="Movement quality over grade. Deliberate, low-intensity practice — footwork, "
                    "efficiency and breadth of movement.",
        weeks=3,
        weekly=[
            PlannedItem(0, "Silent feet & flagging", "Easy volume with deliberate footwork — place "
                                                     "feet silently and use flags to stay in balance."),
            PlannedItem(2, "Perfect repeats", "Climb a moderate route, then repeat it more "
                                              "efficiently. Downclimb for control."),
            PlannedItem(4, "Varied movement", "Slabs, overhangs, dynos, drop-knees — chase breadth "
                                              "of movement, not difficulty."),
        ],
        phases=["skill", "skill", "skill"],
    ),
]

BY_KEY = {t.key: t for t in TEMPLATES}


def phase_for(template_key: str, week: int) -> str | None:
    """The phase label for a 1-based plan week, or None if unknown."""
    t = BY_KEY.get(template_key)
    if not t or not t.phases:
        return None
    return t.phases[min(max(week, 1), len(t.phases)) - 1]
