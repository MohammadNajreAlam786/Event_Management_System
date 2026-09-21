"""Phase 5 - AI planning analyzer scenario tests.

Covers the required test matrix (well-prepared / incomplete tasks / resource
gaps / schedule conflict / budget concern / team gap / empty). "AI service
unavailable" is a backend test (see backend/__phase5_tests.mjs).

Run from the ai-service directory:
    .venv/Scripts/python.exe tests/test_analyzer.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.schemas import AnalyzeRequest          # noqa: E402
from services.analyzer import analyze              # noqa: E402

PASS = 0
FAIL = 0


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


def req(**kw):
    return AnalyzeRequest(**kw)


def cats(items, key):
    return [getattr(x, key) for x in items]


# ------------------------------------------------------------------ Test 1


def test_well_prepared():
    r = analyze(req(
        event={"title": "Alumni Meet", "startDate": "2026-12-01T09:00:00Z", "status": "PLANNED"},
        tasks=[
            {"title": "Book venue", "priority": "HIGH", "status": "COMPLETED"},
            {"title": "Confirm caterer", "priority": "MEDIUM", "status": "COMPLETED"},
            {"title": "Brief volunteers on registration and AV", "priority": "MEDIUM", "status": "COMPLETED"},
            {"title": "Set up venue seating and signage", "priority": "MEDIUM", "status": "COMPLETED"},
            {"title": "Contingency: backup speaker + spare mics", "priority": "LOW", "status": "COMPLETED"},
        ],
        schedule=[
            {"title": "Registration", "startTime": "2026-12-01T09:00:00Z", "endTime": "2026-12-01T09:45:00Z", "type": "REGISTRATION", "location": "Foyer", "conflictCount": 0},
            {"title": "Welcome", "startTime": "2026-12-01T10:00:00Z", "endTime": "2026-12-01T11:00:00Z", "type": "CEREMONY", "location": "Hall", "conflictCount": 0},
            {"title": "Lunch", "startTime": "2026-12-01T12:30:00Z", "endTime": "2026-12-01T13:30:00Z", "type": "MEAL", "location": "Lawn", "conflictCount": 0},
        ],
        resources=[
            {"name": "PA system", "category": "TECHNICAL", "status": "AVAILABLE", "quantity": 1, "estimatedUnitCost": 500, "estimatedTotalCost": 500},
            {"name": "Catering", "category": "FOOD", "status": "AVAILABLE", "quantity": 150, "estimatedUnitCost": 200, "estimatedTotalCost": 30000},
        ],
        budget=[
            {"category": "VENUE", "estimatedAmount": 20000, "actualAmount": 20000, "status": "PAID"},
            {"category": "FOOD", "estimatedAmount": 30000, "actualAmount": 29000, "status": "APPROVED"},
            {"category": "MISCELLANEOUS", "estimatedAmount": 5000, "actualAmount": None, "status": "APPROVED"},
        ],
        team=[
            {"name": "R", "role": "Registration desk", "responsibility": "check-in", "status": "CONFIRMED"},
            {"name": "S", "role": "AV lead", "responsibility": "sound and stage", "status": "CONFIRMED"},
            {"name": "T", "role": "Coordinator", "responsibility": "overall lead on the day", "status": "ACTIVE"},
        ],
        readiness={"overallScore": 92, "status": "READY",
                   "components": {"tasks": 100, "schedule": 100, "resources": 100, "budget": 67, "team": 100},
                   "weights": {"tasks": 30, "schedule": 20, "resources": 20, "budget": 15, "team": 15}},
    ))
    check("T1 well-prepared: overall priority is LOW", r.priority == "LOW", r.priority)
    check("T1 well-prepared: no fabricated risks", len(r.risks) == 0, f"{cats(r.risks, 'title')}")
    check("T1 well-prepared: few recommendations (<=2)", len(r.recommendations) <= 2, f"{len(r.recommendations)}: {cats(r.recommendations, 'title')}")
    check("T1 well-prepared: readiness assessment cites 92%", "92" in r.readinessAssessment)


# ------------------------------------------------------------------ Test 2


def test_incomplete_tasks():
    r = analyze(req(
        event={"title": "Hackathon", "startDate": "2026-09-16T09:00:00Z", "status": "PLANNED"},
        tasks=[
            {"title": "Finalise judging rubric", "priority": "CRITICAL", "status": "TODO", "dueDate": "2026-09-01T00:00:00Z", "overdue": True},
            {"title": "Order prizes", "priority": "HIGH", "status": "TODO"},
            {"title": "Set up scoring sheet", "priority": "HIGH", "status": "TODO"},
            {"title": "Email participants", "priority": "MEDIUM", "status": "COMPLETED"},
        ],
        readiness={"overallScore": 20, "status": "NOT_READY", "components": {"tasks": 25, "schedule": 0, "resources": 0, "budget": 0, "team": 0}},
    ))
    check("T2 incomplete: TASK risk raised for the overdue item", "TASK" in cats(r.risks, "category"))
    check("T2 incomplete: overdue TASK risk is CRITICAL (overdue + critical priority)",
          any(x.category == "TASK" and x.severity == "CRITICAL" for x in r.risks))
    check("T2 incomplete: a TASK recommendation about the open critical work",
          any(x.category == "TASK" and "critical" in x.title.lower() for x in r.recommendations))
    check("T2 incomplete: overall priority CRITICAL", r.priority == "CRITICAL", r.priority)


# ------------------------------------------------------------------ Test 3


def test_resource_gaps():
    r = analyze(req(
        event={"title": "Tech Talk", "startDate": "2026-10-10T09:00:00Z"},
        schedule=[
            {"title": "Talk", "startTime": "2026-10-10T10:00:00Z", "endTime": "2026-10-10T11:30:00Z", "type": "SESSION", "location": "Room 1", "conflictCount": 0},
        ],
        resources=[
            {"name": "Projector", "category": "TECHNICAL", "status": "REQUIRED", "quantity": 1, "estimatedUnitCost": 0, "estimatedTotalCost": 0},
            {"name": "Mic", "category": "TECHNICAL", "status": "ORDERED", "quantity": 2, "estimatedUnitCost": 0, "estimatedTotalCost": 0},
        ],
        readiness={"overallScore": 30, "status": "NOT_READY", "components": {"tasks": 0, "schedule": 100, "resources": 0, "budget": 0, "team": 0}},
    ))
    check("T3 resource gaps: a RESOURCE recommendation about unconfirmed equipment",
          any(x.category == "RESOURCE" for x in r.recommendations), cats(r.recommendations, "title"))
    check("T3 resource gaps: technical-not-confirmed is HIGH priority",
          any(x.category == "RESOURCE" and x.priority == "HIGH" for x in r.recommendations))


# ------------------------------------------------------------------ Test 4


def test_schedule_conflict():
    r = analyze(req(
        event={"title": "Fest", "startDate": "2026-11-02T09:00:00Z"},
        schedule=[
            {"title": "Panel", "startTime": "2026-11-02T10:00:00Z", "endTime": "2026-11-02T12:00:00Z", "type": "SESSION", "location": "Hall", "conflictCount": 1},
            {"title": "Demo", "startTime": "2026-11-02T11:00:00Z", "endTime": "2026-11-02T13:00:00Z", "type": "WORKSHOP", "location": "Lab", "conflictCount": 1},
        ],
        readiness={"overallScore": 12, "status": "NOT_READY", "components": {"tasks": 0, "schedule": 60, "resources": 0, "budget": 0, "team": 0}},
    ))
    check("T4 schedule conflict: a SCHEDULE risk is raised", "SCHEDULE" in cats(r.risks, "category"))
    check("T4 schedule conflict: risk explains overlap (not invents a new one)",
          any("overlap" in x.title.lower() or "overlap" in x.description.lower() for x in r.risks if x.category == "SCHEDULE"))


# ------------------------------------------------------------------ Test 5


def test_budget_concern():
    r = analyze(req(
        event={"title": "Gala", "startDate": "2026-12-20T18:00:00Z"},
        budget=[
            {"category": "VENUE", "estimatedAmount": 50000, "actualAmount": 68000, "status": "PAID"},
            {"category": "FOOD", "estimatedAmount": 30000, "actualAmount": 31000, "status": "PAID"},
            {"category": "DECORATION", "estimatedAmount": 10000, "actualAmount": None, "status": "PLANNED"},
        ],
        readiness={"overallScore": 20, "status": "NOT_READY", "components": {"tasks": 0, "schedule": 0, "resources": 0, "budget": 67, "team": 0}},
    ))
    check("T5 budget: a BUDGET risk/recommendation is present",
          "BUDGET" in cats(r.risks, "category") or "BUDGET" in cats(r.recommendations, "category"))
    check("T5 budget: overspend recognised as a risk",
          any(x.category == "BUDGET" and ("over" in x.title.lower() or "exceed" in x.description.lower()) for x in r.risks))


# ------------------------------------------------------------------ Test 6


def test_team_gap():
    r = analyze(req(
        event={"title": "Open Day", "startDate": "2026-10-01T09:00:00Z"},
        schedule=[
            {"title": "Registration", "startTime": "2026-10-01T09:00:00Z", "endTime": "2026-10-01T10:00:00Z", "type": "REGISTRATION", "location": "Gate", "conflictCount": 0},
            {"title": "Tours", "startTime": "2026-10-01T10:00:00Z", "endTime": "2026-10-01T12:00:00Z", "type": "SESSION", "location": "Campus", "conflictCount": 0},
        ],
        team=[
            {"name": "Guide 1", "role": "Tour guide", "responsibility": "lead a tour group", "status": "CONFIRMED"},
        ],
        readiness={"overallScore": 30, "status": "NOT_READY", "components": {"tasks": 0, "schedule": 100, "resources": 0, "budget": 0, "team": 100}},
    ))
    check("T6 team gap: a TEAM recommendation about missing coverage",
          any(x.category == "TEAM" for x in r.recommendations), cats(r.recommendations, "title"))
    check("T6 team gap: registration coverage flagged",
          any("registration" in (x.title + x.description).lower() for x in r.recommendations if x.category == "TEAM"))


# ------------------------------------------------------------------ Test 7


def test_empty_planning():
    r = analyze(req(event={"title": "Blank Event", "startDate": "2026-11-30T09:00:00Z"},
                    readiness={"overallScore": 0, "status": "NOT_READY", "components": {}}))
    check("T7 empty: does not crash and returns a response", isinstance(r.summary, str))
    check("T7 empty: has useful missing-preparation recommendations (>=3)", len(r.recommendations) >= 3, str(len(r.recommendations)))
    check("T7 empty: recommendations span multiple areas",
          len(set(cats(r.recommendations, "category"))) >= 3, str(set(cats(r.recommendations, "category"))))
    check("T7 empty: summary says planning has not started", "not started" in r.summary.lower())
    check("T7 empty: no fabricated CRITICAL findings",
          all(x.priority != "CRITICAL" for x in r.recommendations) and all(x.severity != "CRITICAL" for x in r.risks))


# ------------------------------------------------------------------ shape / determinism


def test_response_shape_and_determinism():
    payload = dict(
        event={"title": "Shape Check", "startDate": "2026-10-05T09:00:00Z"},
        tasks=[{"title": "Do a thing", "priority": "MEDIUM", "status": "TODO"}],
        readiness={"overallScore": 40, "status": "PARTIALLY_READY", "components": {"tasks": 0}},
    )
    a = analyze(req(**payload))
    b = analyze(req(**payload))
    check("shape: method is rule-based", a.method == "rule-based")
    check("shape: engine string present", a.engine.startswith("heuristic"))
    check("shape: every recommendation has all 6 fields",
          all(all([x.category, x.priority, x.title, x.description, x.reason, x.suggestedAction]) for x in a.recommendations))
    check("shape: every risk has all 5 fields",
          all(all([x.category, x.severity, x.title, x.description, x.mitigation]) for x in a.risks))
    check("deterministic: same input -> same output", a.model_dump() == b.model_dump())


if __name__ == "__main__":
    for fn in [
        test_well_prepared,
        test_incomplete_tasks,
        test_resource_gaps,
        test_schedule_conflict,
        test_budget_concern,
        test_team_gap,
        test_empty_planning,
        test_response_shape_and_determinism,
    ]:
        fn()
    print(f"\n==== {PASS} passed, {FAIL} failed ====")
    sys.exit(0 if FAIL == 0 else 1)
