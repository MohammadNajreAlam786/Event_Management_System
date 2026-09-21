"""Phase 11 - future-event improvement recommendation engine tests.

Exercises the real rule-based engine (services/improvement.py) directly with
realistic Phase 10 analytics + Phase 4 planning shapes. Covers: each category
firing / not firing, missing-data limitations, the "almost no data" empty
state, shape validation, wording safety (no unsupported claims), evidence
grounding (values match the input, nothing invented), and determinism.

Run from the ai-service directory:
    .venv/Scripts/python.exe tests/test_improvement.py
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.schemas import ImprovementRequest          # noqa: E402
from services.improvement import generate_improvements, self_check  # noqa: E402

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
    return ImprovementRequest(**kw)


def cats(items, key="category"):
    return [getattr(x, key) for x in items]


BANNED = [
    r"\bwill definitely\b",
    r"\bguarantee",
    r"predicted .* will be exactly",
    r"this event will fail",
]


def assert_no_unsupported_claims(items, field="recommendation"):
    for it in items:
        text = getattr(it, field, "") + " " + getattr(it, "expectedBenefit", "")
        for pattern in BANNED:
            if re.search(pattern, text, re.IGNORECASE):
                return False, f"{pattern!r} matched in {text!r}"
    return True, ""


# ------------------------------------------------------------------ Test 1: rich data


def test_rich_completed_event():
    r = generate_improvements(req(
        event={"title": "Bootcamp", "category": "WORKSHOP", "venue": "Hall", "status": "COMPLETED", "maxParticipants": 10},
        registrations={"total": 8, "cancelled": 2, "allTime": 10},
        attendance={"present": 5, "absent": 3, "rate": 62.5},
        feedback={"total": 4, "averageRating": 3.0, "ratingDistribution": {"1": 0, "2": 1, "3": 1, "4": 1, "5": 1}},
        sentiment={"positive": 1, "neutral": 1, "negative": 2, "analyzed": 4, "unanalyzed": 0, "positivePct": 25, "neutralPct": 25, "negativePct": 50},
        certificates={"issued": 3, "eligible": 5, "issuanceRate": 60},
        participation={"feedbackParticipationRate": 80, "attendedParticipants": 5},
        tasks=[{"title": "a", "status": "TODO"}, {"title": "b", "status": "COMPLETED"}, {"title": "c", "status": "TODO"}],
        schedule=[{"title": "s1", "conflictCount": 1}, {"title": "s2", "conflictCount": 0}],
        resources=[{"name": "Mic", "status": "NOT_AVAILABLE"}],
        budget=[{"category": "VENUE", "estimatedAmount": 1000, "actualAmount": None}],
        team=[{"name": "x", "status": "INVITED"}],
        readiness={"overallScore": 50, "status": "PARTIALLY_READY"},
    ))
    check("T1 multiple categories fire", len(r.recommendations) >= 6, len(r.recommendations))
    check("T1 sorted by priority (HIGH first)", all(
        r.recommendations[i].priority != "LOW" or r.recommendations[i + 1].priority == "LOW"
        for i in range(len(r.recommendations) - 1)
    ) and r.recommendations[0].priority == "HIGH")
    check("T1 SCHEDULING fired (conflict recorded)", "SCHEDULING" in cats(r.recommendations))
    check("T1 VENUE_AND_RESOURCES fired (resource unavailable)", "VENUE_AND_RESOURCES" in cats(r.recommendations))
    check("T1 VOLUNTEER_AND_TEAM fired (invited member + incomplete tasks)", cats(r.recommendations).count("VOLUNTEER_AND_TEAM") == 2)
    check("T1 BUDGET_AND_COST fired (missing actual)", "BUDGET_AND_COST" in cats(r.recommendations))
    check("T1 ATTENDANCE_IMPROVEMENT fired (62.5% < 70)", "ATTENDANCE_IMPROVEMENT" in cats(r.recommendations))
    check("T1 FEEDBACK_AND_EXPERIENCE fired (low rating + negative sentiment)", cats(r.recommendations).count("FEEDBACK_AND_EXPERIENCE") == 2)
    check("T1 CERTIFICATE_AND_POST_EVENT fired (60% issuance)", "CERTIFICATE_AND_POST_EVENT" in cats(r.recommendations))
    check("T1 CAPACITY_PLANNING did not fire (8/10 = 80%, within normal band)", "CAPACITY_PLANNING" not in cats(r.recommendations))
    check("T1 strengths present (registration fill, low cancellation)", len(r.strengths) >= 1, [s.title for s in r.strengths])
    check("T1 improvementAreas mirror the recommendation problems", len(r.improvementAreas) >= 6)
    ok, detail = assert_no_unsupported_claims(r.recommendations)
    check("T1 no unsupported claim wording", ok, detail)
    for rec in r.recommendations:
        check(f"T1 every recommendation has sourceMetrics: {rec.title[:30]}", len(rec.sourceMetrics) > 0)
        check(f"T1 every recommendation has non-empty evidence: {rec.title[:30]}", isinstance(rec.evidence, dict) and len(rec.evidence) > 0)
        check(f"T1 confidence is a valid evidence-strength label: {rec.title[:30]}", rec.confidence in ("LOW", "MEDIUM", "HIGH"))
        check(f"T1 priority is valid: {rec.title[:30]}", rec.priority in ("LOW", "MEDIUM", "HIGH"))


# ------------------------------------------------------------------ Test 2: evidence grounding


def test_evidence_matches_input():
    r = generate_improvements(req(
        event={"status": "COMPLETED", "maxParticipants": 20},
        registrations={"total": 18, "cancelled": 0, "allTime": 18},
        attendance={"present": 10, "absent": 8, "rate": 55.6},
    ))
    att = next((x for x in r.recommendations if x.category == "ATTENDANCE_IMPROVEMENT"), None)
    check("T2 attendance recommendation fired", att is not None)
    if att:
        check("T2 evidence.registered matches input exactly", att.evidence["registered"] == 18, att.evidence)
        check("T2 evidence.present matches input exactly", att.evidence["present"] == 10, att.evidence)
        check("T2 evidence.attendanceRate matches input exactly", att.evidence["attendanceRate"] == 55.6, att.evidence)


# ------------------------------------------------------------------ Test 3: capacity over/under


def test_capacity_under_and_over():
    under = generate_improvements(req(event={"status": "COMPLETED", "maxParticipants": 100}, registrations={"total": 20, "cancelled": 0, "allTime": 20}))
    check("T3 under-registration -> CAPACITY_PLANNING fires", "CAPACITY_PLANNING" in cats(under.recommendations))

    over = generate_improvements(req(event={"status": "COMPLETED", "maxParticipants": 20}, registrations={"total": 20, "cancelled": 0, "allTime": 20}))
    check("T3 full capacity -> CAPACITY_PLANNING fires (over-demand angle)", "CAPACITY_PLANNING" in cats(over.recommendations))

    matched = generate_improvements(req(event={"status": "COMPLETED", "maxParticipants": 20}, registrations={"total": 15, "cancelled": 0, "allTime": 15}))
    check("T3 well-matched capacity -> no CAPACITY_PLANNING recommendation", "CAPACITY_PLANNING" not in cats(matched.recommendations))
    check("T3 well-matched capacity -> strength recorded", any("matched" in s.title.lower() for s in matched.strengths))

    no_cap = generate_improvements(req(event={"status": "COMPLETED"}, registrations={"total": 5, "cancelled": 0, "allTime": 5}))
    check("T3 no maxParticipants -> no capacity recommendation, limitation noted", "CAPACITY_PLANNING" not in cats(no_cap.recommendations) and any("capacity" in lim.lower() for lim in no_cap.limitations))


# ------------------------------------------------------------------ Test 4: missing planning data -> limitations, no crash


def test_missing_planning_sections():
    r = generate_improvements(req(
        event={"status": "COMPLETED"},
        registrations={"total": 5, "cancelled": 0, "allTime": 5},
        attendance={"present": 5, "absent": 0, "rate": 100},
    ))
    check("T4 no crash with empty tasks/schedule/resources/budget/team", isinstance(r.recommendations, list))
    check("T4 limitation: no schedule data", any("scheduling" in lim.lower() and "no run-of-show" in lim.lower() for lim in r.limitations), r.limitations)
    check("T4 limitation: no resource data", any("resource data was unavailable" in lim.lower() for lim in r.limitations))
    check("T4 limitation: no team data", any("team/volunteer data was unavailable" in lim.lower() for lim in r.limitations))
    check("T4 limitation: no budget data", any("budget data was unavailable" in lim.lower() for lim in r.limitations))
    check("T4 limitation: no task data", any("preparation task data was unavailable" in lim.lower() for lim in r.limitations))
    check("T4 no invented SCHEDULING/BUDGET/TEAM/VENUE recommendation", not ({"SCHEDULING", "BUDGET_AND_COST", "VOLUNTEER_AND_TEAM", "VENUE_AND_RESOURCES"} & set(cats(r.recommendations))))


def test_missing_feedback_and_sentiment():
    r = generate_improvements(req(
        event={"status": "COMPLETED"},
        registrations={"total": 5, "cancelled": 0, "allTime": 5},
        attendance={"present": 5, "absent": 0, "rate": 100},
        feedback={"total": 0},
    ))
    check("T5 no feedback -> no feedback recommendation", "FEEDBACK_AND_EXPERIENCE" not in cats(r.recommendations))
    check("T5 limitation: no feedback submitted", any("no feedback was submitted" in lim.lower() for lim in r.limitations))

    r2 = generate_improvements(req(
        event={"status": "COMPLETED"},
        registrations={"total": 5, "cancelled": 0, "allTime": 5},
        attendance={"present": 5, "absent": 0, "rate": 100},
        feedback={"total": 3, "averageRating": 4.0},
        sentiment={"positive": 0, "neutral": 0, "negative": 0, "analyzed": 0, "unanalyzed": 3},
    ))
    check("T5b unanalysed sentiment -> limitation noted, no invented sentiment recommendation", any("sentiment analysis was unavailable for 3" in lim.lower() for lim in r2.limitations))


# ------------------------------------------------------------------ Test 5: empty analytics -> safe empty state


def test_almost_no_data():
    r = generate_improvements(req(event={"status": "COMPLETED"}))
    check("T6 empty event -> no recommendations, no strengths, no areas", r.recommendations == [] and r.strengths == [] and r.improvementAreas == [])
    check("T6 empty event -> exactly one clear limitation", len(r.limitations) == 1 and "almost no recorded data" in r.limitations[0])


# ------------------------------------------------------------------ Test 6: certificates


def test_certificates():
    incomplete = generate_improvements(req(event={"status": "COMPLETED"}, certificates={"issued": 4, "eligible": 10, "issuanceRate": 40}))
    check("T7 low issuance -> HIGH priority recommendation", any(x.category == "CERTIFICATE_AND_POST_EVENT" and x.priority == "HIGH" for x in incomplete.recommendations))

    complete = generate_improvements(req(event={"status": "COMPLETED"}, certificates={"issued": 5, "eligible": 5, "issuanceRate": 100}))
    check("T7 full issuance -> no recommendation, strength recorded", "CERTIFICATE_AND_POST_EVENT" not in cats(complete.recommendations) and any("complete" in s.title.lower() for s in complete.strengths))

    none_eligible = generate_improvements(req(event={"status": "COMPLETED"}, certificates={"issued": 0, "eligible": 0, "issuanceRate": 0}))
    check("T7 zero eligible -> no certificate recommendation or strength", "CERTIFICATE_AND_POST_EVENT" not in cats(none_eligible.recommendations) and not any("certificate" in s.title.lower() for s in none_eligible.strengths))


# ------------------------------------------------------------------ Test 7: shape + determinism


def test_shape_and_determinism():
    payload = dict(
        event={"title": "Shape", "status": "COMPLETED", "maxParticipants": 10},
        registrations={"total": 8, "cancelled": 1, "allTime": 9},
        attendance={"present": 4, "absent": 4, "rate": 50},
        feedback={"total": 2, "averageRating": 2.0, "ratingDistribution": {"1": 1, "2": 1}},
        sentiment={"positive": 0, "neutral": 0, "negative": 2, "analyzed": 2, "unanalyzed": 0, "positivePct": 0, "neutralPct": 0, "negativePct": 100},
        certificates={"issued": 1, "eligible": 4, "issuanceRate": 25},
        participation={"feedbackParticipationRate": 50, "attendedParticipants": 4},
    )
    a = generate_improvements(req(**payload))
    b = generate_improvements(req(**payload))
    check("T8 method is rule-based", a.method == "rule-based")
    check("T8 engine string present", a.engine.startswith("heuristic-improvement"))
    check("T8 deterministic: same input -> same output", a.model_dump() == b.model_dump())
    check("T8 every recommendation has all required fields", all(
        x.category and x.title and x.priority and x.recommendation and x.reason and x.confidence and x.sourceMetrics
        for x in a.recommendations
    ))
    check("T8 every strength/area has title+detail+sourceMetrics", all(
        n.title and n.detail and isinstance(n.sourceMetrics, list) for n in (a.strengths + a.improvementAreas)
    ))
    ok, detail = assert_no_unsupported_claims(a.recommendations)
    check("T8 no unsupported claims", ok, detail)


def test_self_check():
    check("T9 self_check passes", self_check() is True)


if __name__ == "__main__":
    for fn in [
        test_rich_completed_event,
        test_evidence_matches_input,
        test_capacity_under_and_over,
        test_missing_planning_sections,
        test_missing_feedback_and_sentiment,
        test_almost_no_data,
        test_certificates,
        test_shape_and_determinism,
        test_self_check,
    ]:
        fn()
    print(f"\n==== {PASS} passed, {FAIL} failed ====")
    sys.exit(0 if FAIL == 0 else 1)
