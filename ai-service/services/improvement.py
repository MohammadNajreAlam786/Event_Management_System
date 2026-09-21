"""Rule-based post-event improvement recommendations (Phase 11).

Deterministic and explainable -- NOT a machine-learning model, NOT an LLM (the
same design choice as the Phase 5 planning analyzer and the Phase 9 sentiment
engine). Every statement is derived directly from the analytics + planning data
the backend supplies: Phase 10's corrected analytics service (registrations,
attendance, feedback, sentiment, certificates) and the existing Phase 4
planning records (tasks, schedule, resources, budget, team, readiness). Nothing
is invented:

  - every recommendation carries `sourceMetrics` naming the exact input fields
    it is based on, and an `evidence` object built ONLY from values copied out
    of the request (arithmetic on real numbers -- e.g. a percentage -- is fine;
    a new unrelated number is not);
  - a category is generated only when the relevant data is present and the
    rule's condition is met -- no data, no recommendation, no guess;
  - wording is deliberately cautious ("consider", "may improve", "the data
    suggests") and never claims a guaranteed outcome;
  - `confidence` is an EVIDENCE STRENGTH derived from the sample size behind a
    metric (§ `_confidence_for`) -- it is documented as exactly that, never
    presented as a statistical confidence interval or a model probability.

This module never touches a database and never calls another service -- it is
a pure function of its input, safe to unit test directly.
"""
from __future__ import annotations

from typing import List

from models.schemas import (
    EventRecommendation,
    ImprovementNote,
    ImprovementRequest,
    ImprovementResponse,
)

PRIORITY_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}


def _rec(category, title, priority, recommendation, reason, evidence, expected_benefit, confidence, source_metrics):
    return EventRecommendation(
        category=category,
        title=title,
        priority=priority,
        recommendation=recommendation,
        reason=reason,
        evidence=evidence,
        expectedBenefit=expected_benefit,
        confidence=confidence,
        sourceMetrics=source_metrics,
    )


def _note(title, detail, source_metrics):
    return ImprovementNote(title=title, detail=detail, sourceMetrics=source_metrics)


def _confidence_for(n: int) -> str:
    """Evidence strength from the sample size behind a metric -- not a statistical confidence interval."""
    if n >= 10:
        return "HIGH"
    if n >= 3:
        return "MEDIUM"
    return "LOW"


def _pct(part: float, whole: float) -> float:
    return round((part / whole) * 100, 1) if whole > 0 else 0.0


# ------------------------------------------------------------------ 1. scheduling


def _rule_scheduling(req: ImprovementRequest, recs, areas, strengths):
    sched = req.schedule
    if not sched:
        return  # absence handled once, in the limitations list -- never guessed here
    conflicts = [s for s in sched if s.conflictCount > 0]
    if conflicts:
        n = len(conflicts)
        areas.append(_note(
            "Schedule timing conflicts were recorded",
            f"{n} of {len(sched)} run-of-show item(s) overlapped in time during planning.",
            ["schedule.conflictCount"],
        ))
        recs.append(_rec(
            "SCHEDULING", "Resolve schedule timing conflicts in future events",
            "HIGH" if n >= 3 else "MEDIUM",
            "Consider reviewing the run-of-show for a similar future event and adjusting start/end times so sessions do not overlap.",
            f"{n} schedule item(s) had an overlapping time during planning for this event.",
            {"conflictingItems": n, "totalScheduleItems": len(sched)},
            "May reduce attendee confusion and room or resource clashes on the event day.",
            _confidence_for(len(sched)),
            ["schedule.conflictCount"],
        ))
    else:
        strengths.append(_note(
            "No scheduling conflicts",
            f"None of the {len(sched)} recorded run-of-show item(s) had a timing overlap.",
            ["schedule.conflictCount"],
        ))


# ------------------------------------------------------------------ 2. capacity


def _rule_capacity(req: ImprovementRequest, recs, areas, strengths):
    cap = req.event.maxParticipants
    total = req.registrations.total
    if not cap or cap <= 0:
        return
    ratio = _pct(total, cap)
    if ratio < 50:
        areas.append(_note(
            "Registrations were well under capacity",
            f"{total} of {cap} available spots were filled ({ratio}%).",
            ["registrations.total", "event.maxParticipants"],
        ))
        recs.append(_rec(
            "CAPACITY_PLANNING", "Reassess capacity or outreach for a similar future event",
            "MEDIUM",
            "Consider a smaller capacity or additional outreach/promotion ahead of a similar future event.",
            f"Only {ratio}% of the available capacity ({total} of {cap}) was filled.",
            {"registered": total, "capacity": cap, "fillRatio": ratio},
            "May improve the match between expected and actual demand.",
            _confidence_for(total),
            ["registrations.total", "event.maxParticipants"],
        ))
    elif ratio >= 95:
        areas.append(_note(
            "Registrations reached capacity",
            f"{total} of {cap} available spots were filled ({ratio}%).",
            ["registrations.total", "event.maxParticipants"],
        ))
        recs.append(_rec(
            "CAPACITY_PLANNING", "Consider a larger capacity for a similar future event",
            "MEDIUM",
            "The data suggests demand may reach this capacity again; consider a larger venue or an additional session.",
            f"Registrations reached {ratio}% of the available capacity ({total} of {cap}).",
            {"registered": total, "capacity": cap, "fillRatio": ratio},
            "May allow more participants to be accommodated if similar demand recurs.",
            _confidence_for(total),
            ["registrations.total", "event.maxParticipants"],
        ))
    else:
        strengths.append(_note(
            "Registrations were well matched to capacity",
            f"{total} of {cap} available spots were filled ({ratio}%).",
            ["registrations.total", "event.maxParticipants"],
        ))


# ------------------------------------------------------------- 3. registration mgmt


def _rule_registration_mgmt(req: ImprovementRequest, recs, areas, strengths):
    all_time = req.registrations.allTime
    cancelled = req.registrations.cancelled
    if all_time < 5:
        return
    rate = _pct(cancelled, all_time)
    if rate > 20:
        areas.append(_note(
            "A notable share of registrations were cancelled",
            f"{cancelled} of {all_time} total registrations ({rate}%) were cancelled before the event.",
            ["registrations.cancelled", "registrations.allTime"],
        ))
        recs.append(_rec(
            "REGISTRATION_MANAGEMENT", "Investigate causes of registration cancellations",
            "HIGH" if rate > 40 else "MEDIUM",
            "Consider reviewing registration timing, reminder communication, or the sign-up process to understand why participants cancelled.",
            f"{cancelled} of {all_time} total registrations ({rate}%) were cancelled before the event.",
            {"cancelled": cancelled, "allTime": all_time, "cancellationRate": rate},
            "May reduce the share of participants who register and later cancel.",
            _confidence_for(all_time),
            ["registrations.cancelled", "registrations.allTime"],
        ))
    else:
        strengths.append(_note(
            "Cancellation rate was low",
            f"{cancelled} of {all_time} total registrations ({rate}%) were cancelled.",
            ["registrations.cancelled", "registrations.allTime"],
        ))


# ------------------------------------------------------------- 4. attendance


def _rule_attendance(req: ImprovementRequest, recs, areas, strengths):
    registered = req.registrations.total
    if registered < 3:
        return
    rate = req.attendance.rate
    present = req.attendance.present
    if rate < 70:
        areas.append(_note(
            "Attendance rate was below a strong threshold",
            f"{present} of {registered} registered participants attended ({rate}%).",
            ["attendance.rate", "attendance.present", "registrations.total"],
        ))
        recs.append(_rec(
            "ATTENDANCE_IMPROVEMENT", "Improve pre-event attendance reminders and check-in guidance",
            "HIGH" if rate < 50 else "MEDIUM",
            "Consider sending reminders before the event and providing clear QR check-in instructions.",
            f"Attendance was {rate}% ({present} of {registered} registered participants).",
            {"registered": registered, "present": present, "attendanceRate": rate},
            "May improve the share of registered participants who arrive and complete check-in.",
            _confidence_for(registered),
            ["attendance.rate", "attendance.present", "registrations.total"],
        ))
    elif rate >= 90:
        strengths.append(_note(
            "Attendance rate was high",
            f"{present} of {registered} registered participants attended ({rate}%).",
            ["attendance.rate", "attendance.present", "registrations.total"],
        ))


# ------------------------------------------------------------- 5. venue & resources


def _rule_venue_resources(req: ImprovementRequest, recs, areas, strengths):
    res = req.resources
    if not res:
        return
    not_available = [r for r in res if r.status == "NOT_AVAILABLE"]
    if not_available:
        names = ", ".join(f'"{r.name}"' for r in not_available[:3] if r.name)
        areas.append(_note(
            f"{len(not_available)} resource(s) were unavailable",
            f"{len(not_available)} of {len(res)} recorded resource(s) were marked NOT_AVAILABLE during planning.",
            ["planning.resources.status"],
        ))
        recs.append(_rec(
            "VENUE_AND_RESOURCES", "Confirm resource availability earlier in future planning",
            "HIGH",
            "Consider sourcing or confirming key resources further in advance of a similar future event.",
            f"{len(not_available)} resource(s) were marked NOT_AVAILABLE during planning" + (f": {names}." if names else "."),
            {"notAvailable": len(not_available), "totalResources": len(res)},
            "May reduce last-minute resource shortages.",
            _confidence_for(len(res)),
            ["planning.resources.status"],
        ))
    else:
        strengths.append(_note(
            "All planned resources were available",
            f"None of the {len(res)} recorded resource(s) were marked unavailable.",
            ["planning.resources.status"],
        ))


# ------------------------------------------------------------- 6. volunteer & team


def _rule_team(req: ImprovementRequest, recs, areas, strengths):
    team = req.team
    tasks = req.tasks
    if team:
        unconfirmed = [m for m in team if m.status == "INVITED"]
        if unconfirmed:
            areas.append(_note(
                f"{len(unconfirmed)} team member(s) were not confirmed",
                f"{len(unconfirmed)} of {len(team)} team member(s) remained in INVITED status.",
                ["planning.team.status"],
            ))
            recs.append(_rec(
                "VOLUNTEER_AND_TEAM", "Confirm team member availability earlier",
                "MEDIUM",
                "Consider following up with invited team members earlier so responsibilities are confirmed well ahead of the event.",
                f"{len(unconfirmed)} of {len(team)} team member(s) were still INVITED rather than CONFIRMED or ACTIVE.",
                {"unconfirmed": len(unconfirmed), "totalTeam": len(team)},
                "May reduce day-of gaps in role coverage.",
                _confidence_for(len(team)),
                ["planning.team.status"],
            ))
        else:
            strengths.append(_note(
                "Team roles were confirmed",
                f"All {len(team)} recorded team member(s) were confirmed or active.",
                ["planning.team.status"],
            ))
    if tasks:
        incomplete = [t for t in tasks if t.status != "COMPLETED"]
        if len(incomplete) >= max(2, len(tasks) // 3):
            areas.append(_note(
                "A share of preparation tasks were not completed",
                f"{len(incomplete)} of {len(tasks)} planning task(s) were not marked COMPLETED.",
                ["planning.tasks.status"],
            ))
            recs.append(_rec(
                "VOLUNTEER_AND_TEAM", "Increase task completion ahead of the event",
                "MEDIUM",
                "Consider assigning clear owners and earlier due dates to preparation tasks.",
                f"{len(incomplete)} of {len(tasks)} planning task(s) were not marked complete.",
                {"incomplete": len(incomplete), "totalTasks": len(tasks)},
                "May reduce unfinished preparation work close to the event.",
                _confidence_for(len(tasks)),
                ["planning.tasks.status"],
            ))
        else:
            strengths.append(_note(
                "Preparation tasks were mostly complete",
                f"{len(tasks) - len(incomplete)} of {len(tasks)} planning task(s) were marked COMPLETED.",
                ["planning.tasks.status"],
            ))


# ------------------------------------------------------------- 7. budget & cost


def _rule_budget(req: ImprovementRequest, recs, areas, strengths):
    budget = req.budget
    if not budget:
        return
    missing_actual = [b for b in budget if b.actualAmount is None]
    if missing_actual:
        areas.append(_note(
            f"{len(missing_actual)} budget line(s) have no recorded actual amount",
            f"{len(missing_actual)} of {len(budget)} budget line(s) have no actual amount recorded.",
            ["planning.budget.actualAmount"],
        ))
        recs.append(_rec(
            "BUDGET_AND_COST", "Record actual costs for all budget lines",
            "LOW",
            "Consider recording the actual amount for every budget line as invoices or costs are finalised.",
            f"{len(missing_actual)} of {len(budget)} budget line(s) have no actual amount recorded.",
            {"missingActual": len(missing_actual), "totalLines": len(budget)},
            "May make post-event cost review more accurate for future budgeting.",
            _confidence_for(len(budget)),
            ["planning.budget.actualAmount"],
        ))

    have_actuals = [b for b in budget if b.actualAmount is not None]
    est_total = sum(b.estimatedAmount or 0 for b in budget)
    act_total = sum(b.actualAmount or 0 for b in have_actuals)
    if have_actuals and est_total > 0 and act_total > est_total * 1.1:
        over_pct = round((act_total - est_total) / est_total * 100)
        areas.append(_note(
            "Actual spend exceeded the estimate",
            f"Recorded actual spend exceeded the estimated budget by {over_pct}%.",
            ["planning.budget.estimatedAmount", "planning.budget.actualAmount"],
        ))
        recs.append(_rec(
            "BUDGET_AND_COST", "Reassess budget estimates for a similar future event",
            "MEDIUM",
            "Consider revisiting the estimates for the lines that ran over, or adding a contingency allowance.",
            f"Recorded actual spend exceeded the estimated budget by {over_pct}%.",
            {"estimatedTotal": round(est_total), "actualTotal": round(act_total), "overPct": over_pct},
            "May reduce the gap between estimated and actual cost in future planning.",
            _confidence_for(len(have_actuals)),
            ["planning.budget.estimatedAmount", "planning.budget.actualAmount"],
        ))
    elif have_actuals and est_total > 0:
        strengths.append(_note(
            "Spending stayed within estimate",
            "Recorded actual spend did not exceed the estimated budget by a notable margin.",
            ["planning.budget.estimatedAmount", "planning.budget.actualAmount"],
        ))


# ------------------------------------------------------- 8. feedback & experience


def _rule_feedback_experience(req: ImprovementRequest, recs, areas, strengths):
    fb = req.feedback
    sent = req.sentiment
    part = req.participation
    if fb.total == 0:
        return  # handled once in limitations -- never guessed

    if fb.averageRating is not None and fb.averageRating < 3.5:
        areas.append(_note(
            "Average rating was below a strong threshold",
            f"Average rating was {fb.averageRating}/5 across {fb.total} response(s).",
            ["feedback.averageRating", "feedback.total"],
        ))
        recs.append(_rec(
            "FEEDBACK_AND_EXPERIENCE", "Review lower-rated aspects of the event experience",
            "HIGH" if fb.averageRating < 2.5 else "MEDIUM",
            "Consider reading the individual comments on the feedback page for specific, actionable themes.",
            f"Average rating was {fb.averageRating} out of 5 across {fb.total} response(s).",
            {"averageRating": fb.averageRating, "responses": fb.total},
            "May help identify specific aspects of the experience to improve.",
            _confidence_for(fb.total),
            ["feedback.averageRating", "feedback.total"],
        ))
    elif fb.averageRating is not None and fb.averageRating >= 4.5:
        strengths.append(_note(
            "Average rating was high",
            f"Average rating was {fb.averageRating}/5 across {fb.total} response(s).",
            ["feedback.averageRating", "feedback.total"],
        ))

    if sent.analyzed > 0 and sent.negativePct >= 20:
        areas.append(_note(
            "A share of analysed feedback was negative",
            f"{sent.negativePct}% of analysed feedback was negative ({sent.negative} of {sent.analyzed}).",
            ["sentiment.negativePct", "sentiment.analyzed"],
        ))
        recs.append(_rec(
            "FEEDBACK_AND_EXPERIENCE", "Address themes behind negative feedback",
            "HIGH" if sent.negativePct >= 40 else "MEDIUM",
            "Consider reading the negative comments on the feedback page to identify a recurring, specific issue.",
            f"{sent.negativePct}% of analysed feedback was negative ({sent.negative} of {sent.analyzed} analysed responses).",
            {"negative": sent.negative, "analyzed": sent.analyzed, "negativePct": sent.negativePct},
            "May help address participant concerns before a similar future event.",
            _confidence_for(sent.analyzed),
            ["sentiment.negativePct", "sentiment.analyzed"],
        ))
    elif sent.analyzed > 0 and sent.positivePct >= 70:
        strengths.append(_note(
            "Sentiment was mostly positive",
            f"{sent.positivePct}% of analysed feedback was positive ({sent.positive} of {sent.analyzed}).",
            ["sentiment.positivePct", "sentiment.analyzed"],
        ))

    if part.attendedParticipants >= 3 and part.feedbackParticipationRate < 30:
        recs.append(_rec(
            "FEEDBACK_AND_EXPERIENCE", "Encourage more participants to submit feedback",
            "LOW",
            "Consider prompting attendees for feedback immediately after check-in or before they leave the venue.",
            f"Only {part.feedbackParticipationRate}% of attendees ({fb.total} of {part.attendedParticipants}) submitted feedback.",
            {"responses": fb.total, "attendedParticipants": part.attendedParticipants, "participationRate": part.feedbackParticipationRate},
            "May increase the amount of feedback available to evaluate future events.",
            _confidence_for(part.attendedParticipants),
            ["participation.feedbackParticipationRate"],
        ))


# ------------------------------------------------------- 9. certificates & post-event


def _rule_certificates(req: ImprovementRequest, recs, areas, strengths):
    cert = req.certificates
    if cert.eligible == 0:
        return
    if cert.issuanceRate < 100:
        gap = max(0, cert.eligible - cert.issued)
        areas.append(_note(
            "Certificate issuance was incomplete",
            f"{cert.issued} of {cert.eligible} eligible participant(s) ({cert.issuanceRate}%) received a certificate.",
            ["certificates.issued", "certificates.eligible", "certificates.issuanceRate"],
        ))
        recs.append(_rec(
            "CERTIFICATE_AND_POST_EVENT", "Complete certificate issuance for all eligible participants",
            "HIGH" if cert.issuanceRate < 70 else "MEDIUM",
            "Consider running certificate generation again to cover the remaining eligible participants.",
            f"{cert.issued} of {cert.eligible} eligible participant(s) ({cert.issuanceRate}%) have received a certificate; {gap} remain.",
            {"issued": cert.issued, "eligible": cert.eligible, "issuanceRate": cert.issuanceRate},
            "May ensure every eligible participant receives recognition for attending.",
            _confidence_for(cert.eligible),
            ["certificates.issued", "certificates.eligible", "certificates.issuanceRate"],
        ))
    else:
        strengths.append(_note(
            "Certificate issuance was complete",
            f"All {cert.eligible} eligible participant(s) received a certificate.",
            ["certificates.issued", "certificates.eligible", "certificates.issuanceRate"],
        ))


# ------------------------------------------------------------------ limitations


def _limitations(req: ImprovementRequest) -> List[str]:
    lim: List[str] = []
    if not req.schedule:
        lim.append("No scheduling recommendation was generated because no run-of-show/schedule data was recorded for this event.")
    if not req.resources:
        lim.append("Resource data was unavailable, so no venue/resource recommendation was generated.")
    if not req.team:
        lim.append("Team/volunteer data was unavailable, so no team-related recommendation was generated.")
    if not req.budget:
        lim.append("Budget data was unavailable, so no budget-related recommendation was generated.")
    if not req.tasks:
        lim.append("Preparation task data was unavailable for this event.")
    if req.feedback.total == 0:
        lim.append("No feedback was submitted for this event, so feedback-based recommendations were not generated.")
    elif req.sentiment.unanalyzed > 0:
        lim.append(f"Sentiment analysis was unavailable for {req.sentiment.unanalyzed} feedback response(s).")
    if not req.event.maxParticipants:
        lim.append("No maximum capacity was set for this event, so capacity-planning recommendations were not generated.")
    lim.append("Recommendations are based only on this event's own recorded data -- no comparison with other events was made.")
    return lim


def _has_any_data(req: ImprovementRequest) -> bool:
    return bool(
        req.registrations.allTime
        or req.attendance.present
        or req.feedback.total
        or req.tasks
        or req.schedule
        or req.resources
        or req.budget
        or req.team
        or req.certificates.issued
    )


# ------------------------------------------------------------------ entry point


def generate_improvements(req: ImprovementRequest) -> ImprovementResponse:
    """Run every category rule over the supplied data and assemble the response."""
    if not _has_any_data(req):
        return ImprovementResponse(
            recommendations=[],
            strengths=[],
            improvementAreas=[],
            limitations=[
                "This event has almost no recorded data (no registrations, attendance, "
                "feedback, certificates or planning records), so no data-grounded "
                "recommendations could be generated.",
            ],
        )

    recs: List[EventRecommendation] = []
    areas: List[ImprovementNote] = []
    strengths: List[ImprovementNote] = []

    _rule_scheduling(req, recs, areas, strengths)
    _rule_capacity(req, recs, areas, strengths)
    _rule_registration_mgmt(req, recs, areas, strengths)
    _rule_attendance(req, recs, areas, strengths)
    _rule_venue_resources(req, recs, areas, strengths)
    _rule_team(req, recs, areas, strengths)
    _rule_budget(req, recs, areas, strengths)
    _rule_feedback_experience(req, recs, areas, strengths)
    _rule_certificates(req, recs, areas, strengths)

    recs.sort(key=lambda r: -PRIORITY_RANK.get(r.priority, 0))

    return ImprovementResponse(
        recommendations=recs,
        strengths=strengths,
        improvementAreas=areas,
        limitations=_limitations(req),
    )


def self_check() -> bool:
    """Cheap readiness probe: the engine runs on a minimal input without raising."""
    try:
        from models.schemas import ImprovementEventIn

        req = ImprovementRequest(event=ImprovementEventIn(status="COMPLETED"))
        generate_improvements(req)
        return True
    except Exception:  # noqa: BLE001 -- health probe must never raise
        return False
