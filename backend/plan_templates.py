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
    ),
]

BY_KEY = {t.key: t for t in TEMPLATES}
