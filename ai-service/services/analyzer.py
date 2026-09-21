"""Rule-based pre-event planning analyzer.

This is a deterministic analysis engine -- NOT a machine-learning model and not
an LLM. It inspects the organiser's actual Phase 4 planning data (tasks,
schedule, resources, budget, team) plus the existing readiness score and derives
recommendations and risks from what it finds. Every statement it produces is
backed by a value in the input; it invents nothing.

It is honest about being rule-based: the response carries `method: "rule-based"`.
The single seam for a future LLM layer is `_narrative()` -- swap its body for a
model call and keep the structured findings from the rules below.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from models.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    Recommendation,
    Risk,
)

PRIORITY_RANK = {"LOW": 0, "MEDIUM": 1, "HIGH": 2, "CRITICAL": 3}
_RANK_PRIORITY = {v: k for k, v in PRIORITY_RANK.items()}


# ------------------------------------------------------------------ small helpers


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse(iso: Optional[str]) -> Optional[datetime]:
    if not iso:
        return None
    try:
        return datetime.fromisoformat(str(iso).replace("Z", "+00:00"))
    except ValueError:
        return None


def _days_until(iso: Optional[str]) -> Optional[int]:
    d = _parse(iso)
    if d is None:
        return None
    return (d - _now()).days


def _pct(part: float, whole: float) -> int:
    return 0 if whole == 0 else round(part / whole * 100)


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" + ("" if n == 1 else "s")


def _text_of(*parts: str) -> str:
    return " ".join(p for p in parts if p).lower()


def _mentions(haystack: str, *needles: str) -> bool:
    return any(n in haystack for n in needles)


def _rec(category: str, priority: str, title: str, description: str, reason: str, action: str) -> Recommendation:
    return Recommendation(
        category=category,
        priority=priority,
        title=title,
        description=description,
        reason=reason,
        suggestedAction=action,
    )


def _risk(category: str, severity: str, title: str, description: str, mitigation: str) -> Risk:
    return Risk(category=category, severity=severity, title=title, description=description, mitigation=mitigation)


# ------------------------------------------------------------------ section rules


def _analyze_tasks(req: AnalyzeRequest, days_out: Optional[int], recs: List[Recommendation], risks: List[Risk]) -> None:
    tasks = req.tasks
    if not tasks:
        recs.append(_rec(
            "TASK", "MEDIUM",
            "No preparation tasks recorded",
            "There are no tasks in the plan, so nothing is being tracked towards the event.",
            "Task tracking is empty while the event still needs preparation.",
            "Add the first tasks -- venue setup, registration, technical checks, speaker coordination.",
        ))
        return

    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == "COMPLETED")
    overdue = [t for t in tasks if t.overdue or (t.status != "COMPLETED" and (_days_until(t.dueDate) or 99) < 0)]
    crit_pending = [t for t in tasks if t.priority == "CRITICAL" and t.status != "COMPLETED"]
    high_pending = [t for t in tasks if t.priority == "HIGH" and t.status != "COMPLETED"]
    no_due = [t for t in tasks if not t.dueDate and t.status != "COMPLETED"]

    if overdue:
        crit_overdue = [t for t in overdue if t.priority == "CRITICAL"]
        sev = "CRITICAL" if crit_overdue else "HIGH"
        sample = ", ".join(f'"{t.title}"' for t in overdue[:3])
        risks.append(_risk(
            "TASK", sev,
            f"{_plural(len(overdue), 'task')} past the due date",
            f"{_plural(len(overdue), 'task')} are overdue (e.g. {sample}).",
            "Re-schedule or complete these tasks now, and move their due dates only if the work genuinely shifted.",
        ))

    if crit_pending:
        recs.append(_rec(
            "TASK", "HIGH" if not any(t in overdue for t in crit_pending) else "CRITICAL",
            f"{_plural(len(crit_pending), 'critical task')} still open",
            "Tasks marked CRITICAL priority have not been completed: "
            + ", ".join(f'"{t.title}"' for t in crit_pending[:3]) + ".",
            "Critical-priority work is the highest-impact if it slips.",
            "Focus on closing the critical tasks before anything lower-priority.",
        ))

    if high_pending and days_out is not None and days_out <= 14:
        recs.append(_rec(
            "TASK", "MEDIUM",
            f"{_plural(len(high_pending), 'high-priority task')} open with the event {_plural(days_out, 'day')} away",
            "High-priority tasks remain open and the event is close.",
            f"The event is in {_plural(days_out, 'day')} and high-priority tasks are not done.",
            "Assign owners and near-term due dates to each high-priority task.",
        ))

    if no_due and len(no_due) >= max(2, total // 3):
        recs.append(_rec(
            "TASK", "LOW",
            f"{_plural(len(no_due), 'open task')} have no due date",
            "Several open tasks have no deadline, which makes it hard to see what is at risk of slipping.",
            "Tasks without a due date do not appear in deadline tracking or readiness pressure.",
            "Add a target date to each open task.",
        ))

    completion = _pct(completed, total)
    if 0 < completion < 40 and days_out is not None and days_out <= 21:
        recs.append(_rec(
            "TASK", "MEDIUM",
            "Task completion is low for how close the event is",
            f"Only {completion}% of tasks are complete ({completed}/{total}) with roughly {_plural(max(days_out,0), 'day')} to go.",
            "Low completion this close to the event usually means a rush near the end.",
            "Break large open tasks into smaller ones and spread them across the remaining days.",
        ))

    _analyze_missing_task_types(req, recs)


def _analyze_missing_task_types(req: AnalyzeRequest, recs: List[Recommendation]) -> None:
    """Recommend a task type only when other planning data implies it is needed."""
    task_text = _text_of(*[_text_of(t.title, t.description, t.role if hasattr(t, "role") else "") for t in req.tasks])
    task_text += " " + _text_of(*[t.assignedTo for t in req.tasks])
    sched_types = {s.type for s in req.schedule}
    res_cats = {r.category for r in req.resources}
    budget_cats = {b.category for b in req.budget}

    checks: List[Tuple[bool, bool, str, str, str, str]] = [
        (
            "REGISTRATION" in sched_types or any(b for b in budget_cats),
            _mentions(task_text, "regist", "check-in", "check in", "sign-in", "badge"),
            "No registration / check-in task",
            "The schedule expects attendees but no task covers running the registration desk.",
            "A registration slot exists in the run-of-show without a preparation task behind it.",
            "Add a task to set up and staff the registration / check-in desk.",
        ),
        (
            bool(sched_types & {"SESSION", "WORKSHOP", "CEREMONY"}) or "TECHNICAL" in res_cats,
            _mentions(task_text, "technical", "av ", "audio", "sound", "projector", "mic", "equipment check", "sound check"),
            "No technical / AV setup task",
            "There are presentation sessions or technical resources, but nothing schedules a technical check.",
            "Sessions/workshops or technical resources are planned without an equipment-verification task.",
            "Add a task to test microphones, projector, audio and any live-stream setup before doors open.",
        ),
        (
            bool(sched_types & {"MEAL", "BREAK"}) or "FOOD" in res_cats or "FOOD" in budget_cats,
            _mentions(task_text, "cater", "food", "lunch", "refreshment", "meal", "snack"),
            "No catering coordination task",
            "Meals/breaks or a food budget are planned, but no task tracks catering coordination.",
            "Food appears in the schedule/resources/budget without an owner task.",
            "Add a task to confirm the caterer, headcount and delivery time.",
        ),
        (
            "CEREMONY" in sched_types or "SPEAKERS" in budget_cats,
            _mentions(task_text, "speaker", "keynote", "guest", "presenter", "chief guest"),
            "No speaker / guest coordination task",
            "A ceremony or a speakers budget line exists, but no task covers coordinating speakers or guests.",
            "Speaker-related schedule or budget items have no supporting preparation task.",
            "Add a task to confirm speaker travel, timing, AV needs and introductions.",
        ),
        (
            len(req.schedule) >= 3,
            _mentions(task_text, "venue", "setup", "seating", "stage", "signage", "layout"),
            "No venue setup task",
            "The run-of-show has several items but nothing tracks physically preparing the venue.",
            "A multi-item schedule usually needs seating, staging and signage set up beforehand.",
            "Add a venue setup task covering seating layout, stage and signage.",
        ),
        (
            len(req.schedule) >= 2 or len(req.tasks) >= 5,
            _mentions(task_text, "contingency", "backup", "plan b", "weather", "fallback"),
            "No contingency planning",
            "Nothing in the plan covers what happens if a speaker, vendor or the weather does not cooperate.",
            "A plan of this size has no visible fallback for common failure points.",
            "Add a short contingency task: backup speaker, spare equipment, wet-weather option.",
        ),
    ]

    for needed, present, title, desc, reason, action in checks:
        if needed and not present:
            recs.append(_rec("TASK", "MEDIUM", title, desc, reason, action))


def _analyze_schedule(req: AnalyzeRequest, recs: List[Recommendation], risks: List[Risk]) -> None:
    sched = sorted(
        [s for s in req.schedule if _parse(s.startTime) and _parse(s.endTime)],
        key=lambda s: _parse(s.startTime),  # type: ignore[arg-type]
    )
    if not req.schedule:
        recs.append(_rec(
            "SCHEDULE", "MEDIUM",
            "No run-of-show yet",
            "There is no schedule, so timings, room usage and transitions are not visible.",
            "Without a schedule the readiness score assigns 0 to schedule preparation.",
            "Add the main blocks -- registration, opening, sessions, breaks, close.",
        ))
        return

    conflicting = sum(1 for s in req.schedule if s.conflictCount > 0)
    if conflicting:
        risks.append(_risk(
            "SCHEDULE", "HIGH",
            "Overlapping schedule items",
            f"{_plural(conflicting, 'schedule item')} overlap in time with another item.",
            "Open the Schedule tab, adjust the start/end times so the overlapping items no longer clash, "
            "or move one to a different room and note that explicitly.",
        ))

    # transitions and gaps between consecutive items
    short_transitions: List[str] = []
    long_gaps: List[str] = []
    for a, b in zip(sched, sched[1:]):
        a_end = _parse(a.endTime)
        b_start = _parse(b.startTime)
        if not a_end or not b_start:
            continue
        gap_min = (b_start - a_end).total_seconds() / 60
        if 0 <= gap_min < 10 and (a.location or "").strip().lower() != (b.location or "").strip().lower() and a.location and b.location:
            short_transitions.append(f'"{a.title}" -> "{b.title}"')
        elif gap_min >= 120:
            long_gaps.append(f'"{a.title}" -> "{b.title}" ({round(gap_min / 60, 1)}h)')

    if short_transitions:
        recs.append(_rec(
            "SCHEDULE", "MEDIUM",
            "Very tight changeovers between rooms",
            "Some items in different locations are back-to-back with under 10 minutes between them: "
            + "; ".join(short_transitions[:3]) + ".",
            "Attendees and equipment cannot move between rooms that quickly.",
            "Add a short buffer, or keep consecutive items in the same room.",
        ))

    if long_gaps:
        recs.append(_rec(
            "SCHEDULE", "LOW",
            "Long unscheduled gaps in the programme",
            "There are gaps of two hours or more with nothing scheduled: " + "; ".join(long_gaps[:3]) + ".",
            "Long unplanned gaps tend to lose attendees and momentum.",
            "Fill the gap with a session or networking slot, or tighten the surrounding items.",
        ))

    # missing breaks in a long programme
    span_hours = 0.0
    if sched:
        first = _parse(sched[0].startTime)
        last = _parse(sched[-1].endTime)
        if first and last:
            span_hours = (last - first).total_seconds() / 3600
    has_break = any(s.type in {"BREAK", "MEAL"} for s in req.schedule)
    if span_hours >= 4 and not has_break:
        recs.append(_rec(
            "SCHEDULE", "MEDIUM",
            f"No break in a {round(span_hours)}-hour programme",
            f"The schedule runs about {round(span_hours)} hours with no BREAK or MEAL item.",
            "Programmes over four hours need a rest / refreshment break to hold attention.",
            "Insert at least one break (and a meal if it spans lunch).",
        ))

    missing_location = [s for s in req.schedule if not (s.location or "").strip()]
    if missing_location and len(missing_location) >= max(2, len(req.schedule) // 2):
        recs.append(_rec(
            "SCHEDULE", "LOW",
            f"{_plural(len(missing_location), 'schedule item')} have no location",
            "Several items do not say where they happen, which makes signage and setup harder.",
            "Missing locations lead to confusion on the day.",
            "Set a room / area for every schedule item.",
        ))


def _analyze_resources(req: AnalyzeRequest, days_out: Optional[int], recs: List[Recommendation], risks: List[Risk]) -> None:
    res = req.resources
    sched_types = {s.type for s in req.schedule}
    if not res:
        if req.schedule or req.budget:
            recs.append(_rec(
                "RESOURCE", "MEDIUM",
                "No resources listed",
                "The event has a schedule or budget but no equipment, furniture or materials are recorded.",
                "Un-listed resources cannot be tracked from 'required' to 'available'.",
                "List what the event physically needs and set each one's status.",
            ))
        return

    not_available = [r for r in res if r.status == "NOT_AVAILABLE"]
    unconfirmed = [r for r in res if r.status in {"REQUIRED", "ORDERED"}]
    tech_unconfirmed = [r for r in unconfirmed if r.category == "TECHNICAL"]

    if not_available:
        soon = days_out is not None and days_out <= 7
        sev = "CRITICAL" if soon and any(r.category == "TECHNICAL" for r in not_available) else "HIGH"
        names = ", ".join(f'"{r.name}"' for r in not_available[:3])
        risks.append(_risk(
            "RESOURCE", sev,
            f"{_plural(len(not_available), 'resource')} marked not available",
            f"{names} {'is' if len(not_available) == 1 else 'are'} currently NOT_AVAILABLE.",
            "Source an alternative or a rental now, and update the status once secured.",
        ))

    if tech_unconfirmed and (sched_types & {"SESSION", "WORKSHOP", "CEREMONY"}):
        recs.append(_rec(
            "RESOURCE", "HIGH",
            "Technical equipment is not confirmed",
            "Technical resources are still REQUIRED / ORDERED while the programme has presentation sessions: "
            + ", ".join(f'"{r.name}"' for r in tech_unconfirmed[:3]) + ".",
            "Sessions depend on this equipment and its availability is not yet confirmed.",
            "Confirm each technical item and move it to AVAILABLE, or arrange a rental.",
        ))
    elif unconfirmed and len(unconfirmed) >= max(2, len(res) // 2):
        recs.append(_rec(
            "RESOURCE", "MEDIUM",
            f"{_plural(len(unconfirmed), 'resource')} not yet secured",
            "Several resources are still REQUIRED or ORDERED rather than AVAILABLE.",
            "Unconfirmed resources are the main drag on the resources readiness score.",
            "Follow up with suppliers and mark items AVAILABLE as they are secured.",
        ))

    # concentration of resource cost
    total_cost = sum(r.estimatedTotalCost or (r.quantity * r.estimatedUnitCost) for r in res)
    if total_cost > 0:
        for r in res:
            cost = r.estimatedTotalCost or (r.quantity * r.estimatedUnitCost)
            if cost >= 0.4 * total_cost and cost > 0 and len(res) > 1:
                recs.append(_rec(
                    "RESOURCE", "LOW",
                    f'"{r.name}" is most of the resource budget',
                    f"This one resource is about {_pct(cost, total_cost)}% of the estimated resource spend.",
                    "A single large line is worth double-checking for quantity and unit price.",
                    "Re-check the quantity and unit cost, and get a written quote.",
                ))
                break

    # category gaps implied by the schedule
    if (sched_types & {"MEAL", "BREAK"}) and not any(r.category == "FOOD" for r in res):
        recs.append(_rec(
            "RESOURCE", "MEDIUM",
            "Meals scheduled but no food resource",
            "The run-of-show has a meal or break but nothing is listed under the FOOD category.",
            "A catering need is in the schedule with no matching resource entry.",
            "Add the catering / refreshments as a FOOD resource with a quantity and status.",
        ))
    if (sched_types & {"SESSION", "WORKSHOP", "CEREMONY"}) and not any(r.category == "TECHNICAL" for r in res):
        recs.append(_rec(
            "RESOURCE", "MEDIUM",
            "Presentation sessions but no technical resource",
            "There are sessions/workshops but no TECHNICAL resources (mics, projector, audio) are listed.",
            "Sessions normally need AV support that is not recorded.",
            "Add the required AV items as TECHNICAL resources.",
        ))


def _analyze_budget(req: AnalyzeRequest, recs: List[Recommendation], risks: List[Risk]) -> None:
    budget = req.budget
    if not budget:
        if req.resources or req.schedule:
            recs.append(_rec(
                "BUDGET", "MEDIUM",
                "No budget planned",
                "There are resources or a programme but no budget lines, so cost is not being tracked.",
                "An un-planned budget scores 0 on the budget readiness component.",
                "Add budget lines for the main cost areas -- venue, equipment, food, speakers.",
            ))
        return

    est_total = sum(b.estimatedAmount or 0 for b in budget)
    act_total = sum(b.actualAmount or 0 for b in budget)
    planned_only = [b for b in budget if b.status == "PLANNED"]
    approved_no_actual = [b for b in budget if b.status in {"APPROVED", "PAID"} and b.actualAmount is None]

    if est_total > 0 and act_total > est_total * 1.05:
        over = act_total - est_total
        pct_over = _pct(over, est_total)
        paid = any(b.status == "PAID" for b in budget)
        risks.append(_risk(
            "BUDGET", "CRITICAL" if pct_over >= 20 and paid else "HIGH",
            "Actual spend is over the estimate",
            f"Recorded actuals ({round(act_total):,}) exceed the estimate ({round(est_total):,}) by {pct_over}%.",
            "Find the lines that ran over, and either trim elsewhere or get the higher figure approved.",
        ))

    if planned_only and len(planned_only) >= max(2, len(budget) // 2):
        recs.append(_rec(
            "BUDGET", "MEDIUM",
            f"{_plural(len(planned_only), 'budget item')} still awaiting approval",
            "Several budget lines are PLANNED rather than APPROVED or PAID.",
            "Unapproved budget lines are the main drag on the budget readiness score and may not be spendable yet.",
            "Take the planned lines through your approval step and update their status.",
        ))

    if approved_no_actual:
        recs.append(_rec(
            "BUDGET", "LOW",
            "Approved budget lines have no actual amount",
            f"{_plural(len(approved_no_actual), 'approved / paid line')} have no actual amount recorded.",
            "Without actuals the variance figure is incomplete.",
            "Enter the actual amount for each approved or paid line as invoices arrive.",
        ))

    if est_total > 0 and len(budget) > 1:
        biggest = max(budget, key=lambda b: b.estimatedAmount or 0)
        if (biggest.estimatedAmount or 0) >= 0.5 * est_total:
            recs.append(_rec(
                "BUDGET", "LOW",
                f"{biggest.category.title()} is half the budget",
                f"The {biggest.category.title()} line is about {_pct(biggest.estimatedAmount or 0, est_total)}% of the estimated budget.",
                "A single dominant line is where an overrun would hurt most.",
                "Get a firm quote for that line and consider a small contingency against it.",
            ))

    if not any(b.category == "MISCELLANEOUS" for b in budget) and len(budget) >= 3:
        recs.append(_rec(
            "BUDGET", "LOW",
            "No contingency line in the budget",
            "The budget has several lines but no MISCELLANEOUS / contingency allowance.",
            "Events almost always have a small unplanned cost.",
            "Add a MISCELLANEOUS line of roughly 5-10% as contingency.",
        ))


def _analyze_team(req: AnalyzeRequest, recs: List[Recommendation], risks: List[Risk]) -> None:
    team = req.team
    sched_types = {s.type for s in req.schedule}
    res_cats = {r.category for r in req.resources}

    if not team:
        if req.schedule or req.resources:
            risks.append(_risk(
                "TEAM", "HIGH",
                "No team members",
                "There is a programme to run but nobody is listed to help run it.",
                "Add the people helping on the day with their roles and responsibilities.",
            ))
        else:
            recs.append(_rec(
                "TEAM", "MEDIUM",
                "No team members yet",
                "No coordinators or volunteers are recorded for the event.",
                "The team readiness component is 0 until members are added and confirmed.",
                "Add the people who will help and set each one's status.",
            ))
        return

    unconfirmed = [m for m in team if m.status == "INVITED"]
    if unconfirmed:
        recs.append(_rec(
            "TEAM", "MEDIUM" if len(unconfirmed) < len(team) else "HIGH",
            f"{_plural(len(unconfirmed), 'team member')} not confirmed",
            "Some team members are still INVITED rather than CONFIRMED / ACTIVE.",
            "Unconfirmed members do not count towards team readiness and may not turn up.",
            "Follow up with each invited member and update their status once they confirm.",
        ))

    if len(req.schedule) >= 4 and len(team) < 3:
        recs.append(_rec(
            "TEAM", "MEDIUM",
            "Small team for the size of the programme",
            f"The run-of-show has {_plural(len(req.schedule), 'item')} but only {_plural(len(team), 'team member')}.",
            "A multi-track / multi-item programme is hard to run with two or fewer people.",
            "Recruit a few more volunteers and give each a clear area.",
        ))

    team_text = _text_of(*[_text_of(m.role, m.responsibility) for m in team])
    coverage_checks = [
        (
            "REGISTRATION" in sched_types,
            _mentions(team_text, "regist", "check-in", "check in", "desk", "front"),
            "No one is assigned to registration",
            "There is a registration slot but no team member's role or responsibility covers it.",
            "Give one person the registration / check-in desk.",
        ),
        (
            bool(sched_types & {"SESSION", "WORKSHOP", "CEREMONY"}) or "TECHNICAL" in res_cats,
            _mentions(team_text, "av", "audio", "tech", "sound", "stage", "projection"),
            "No one is assigned to AV / technical",
            "Sessions or technical resources exist but no team member owns AV / technical support.",
            "Give one person the AV / technical role for the day.",
        ),
        (
            len(team) >= 4,
            _mentions(team_text, "coordinat", "lead", "manager", "in charge", "volunteer coordinat"),
            "No overall coordinator",
            "There are several team members but nobody is marked as the coordinator / lead.",
            "Name one person as the day-of coordinator everyone reports to.",
        ),
    ]
    for needed, present, title, desc, action in coverage_checks:
        if needed and not present:
            recs.append(_rec("TEAM", "MEDIUM", title, desc,
                             "A responsibility implied by the plan has no named owner.", action))

    no_resp = [m for m in team if not (m.responsibility or "").strip()]
    if no_resp and len(no_resp) >= max(2, len(team) // 2):
        recs.append(_rec(
            "TEAM", "LOW",
            f"{_plural(len(no_resp), 'team member')} have no responsibility set",
            "Several members have a name but no responsibility, so it is unclear what they own.",
            "Undefined responsibilities lead to gaps and overlaps on the day.",
            "Write a one-line responsibility for every team member.",
        ))


# ------------------------------------------------------------------ narrative


def _readiness_assessment(req: AnalyzeRequest) -> str:
    r = req.readiness
    comps = r.components or {}
    label = {
        "tasks": "task preparation",
        "schedule": "the schedule",
        "resources": "resources",
        "budget": "the budget",
        "team": "the team",
    }
    strong = [label[k] for k, v in comps.items() if v is not None and v >= 70 and k in label]
    weak = sorted(
        [(k, v) for k, v in comps.items() if v is not None and v < 50 and k in label],
        key=lambda kv: kv[1],
    )
    weak_names = [label[k] for k, _ in weak]

    parts = [f"The readiness score is {r.overallScore}% ({r.status.replace('_', ' ').lower()})."]
    parts.append("This is the existing Phase 4 calculation -- a weighted average of the five areas; the assistant only explains it.")
    if strong:
        parts.append(f"{_join_readable(strong).capitalize()} {'is' if len(strong) == 1 else 'are'} in good shape.")
    if weak_names:
        parts.append(f"{_join_readable(weak_names).capitalize()} {'is' if len(weak_names) == 1 else 'are'} pulling the score down and should be the focus.")
    if not strong and not weak_names:
        parts.append("No single area stands out yet -- progress is even across the board.")
    return " ".join(parts)


def _summary(req: AnalyzeRequest, recs: List[Recommendation], risks: List[Risk]) -> str:
    e = req.event
    title = e.title.strip() or "this event"
    tasks, sched, res, budget, team = req.tasks, req.schedule, req.resources, req.budget, req.team

    if not any([tasks, sched, res, budget, team]):
        return (
            f"Planning for {title} has not started yet -- there are no tasks, schedule items, "
            f"resources, budget lines or team members recorded. The recommendations below are the usual "
            f"first steps for an event of this kind."
        )

    clauses: List[str] = []
    if tasks:
        done = sum(1 for t in tasks if t.status == "COMPLETED")
        overdue = sum(1 for t in tasks if t.overdue)
        c = f"{done} of {len(tasks)} tasks are complete"
        if overdue:
            c += f", with {_plural(overdue, 'overdue')}"
        clauses.append(c)
    if sched:
        conf = sum(1 for s in sched if s.conflictCount > 0)
        clauses.append(f"the schedule has {_plural(len(sched), 'item')}" + (f" ({conf} overlapping)" if conf else ""))
    if res:
        avail = sum(1 for r in res if r.status == "AVAILABLE")
        clauses.append(f"{avail} of {_plural(len(res), 'resource')} are confirmed available")
    if budget:
        approved = sum(1 for b in budget if b.status in {"APPROVED", "PAID"})
        clauses.append(f"{approved} of {_plural(len(budget), 'budget line')} are approved")
    if team:
        conf = sum(1 for m in team if m.status in {"CONFIRMED", "ACTIVE", "COMPLETED"})
        clauses.append(f"{conf} of {_plural(len(team), 'team member')} are confirmed")

    posture = "on track"
    high = sum(1 for x in list(recs) + list(risks) if getattr(x, "priority", getattr(x, "severity", "LOW")) in {"HIGH", "CRITICAL"})
    if high >= 3 or req.readiness.overallScore < 40:
        posture = "behind where it should be"
    elif high >= 1 or req.readiness.overallScore < 70:
        posture = "mostly on track, with a few gaps"

    return f"The plan for {title} is {posture}: " + _join_readable(clauses) + "."


def _join_readable(items: List[str]) -> str:
    items = [i for i in items if i]
    if not items:
        return ""
    if len(items) == 1:
        return items[0]
    return ", ".join(items[:-1]) + " and " + items[-1]


def _narrative(req: AnalyzeRequest, recs: List[Recommendation], risks: List[Risk]) -> Tuple[str, str]:
    """Seam for a future LLM layer. Currently returns rule-derived, data-filled text."""
    return _summary(req, recs, risks), _readiness_assessment(req)


# ------------------------------------------------------------------ entry point


def _sort_key_priority(value: str) -> int:
    return -PRIORITY_RANK.get(value, 0)


def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """Run every section rule over the planning data and assemble the response."""
    recs: List[Recommendation] = []
    risks: List[Risk] = []

    days_out = _days_until(req.event.startDate)

    _analyze_tasks(req, days_out, recs, risks)
    _analyze_schedule(req, recs, risks)
    _analyze_resources(req, days_out, recs, risks)
    _analyze_budget(req, recs, risks)
    _analyze_team(req, recs, risks)

    # de-duplicate by (category, title) keeping the highest priority
    def _dedupe(items):
        seen = {}
        for it in items:
            key = (it.category, it.title)
            level = getattr(it, "priority", None) or getattr(it, "severity", "LOW")
            if key not in seen or PRIORITY_RANK.get(level, 0) > PRIORITY_RANK.get(
                getattr(seen[key], "priority", None) or getattr(seen[key], "severity", "LOW"), 0
            ):
                seen[key] = it
        return list(seen.values())

    recs = _dedupe(recs)
    risks = _dedupe(risks)

    recs.sort(key=lambda r: _sort_key_priority(r.priority))
    risks.sort(key=lambda r: _sort_key_priority(r.severity))

    # A well-prepared event (no risks, nothing above LOW) should get a short,
    # reassuring response -- not a pile of minor nitpicks.
    if not risks and recs and all(r.priority == "LOW" for r in recs):
        recs = recs[:2]

    levels = [r.priority for r in recs] + [r.severity for r in risks]
    overall = _RANK_PRIORITY[max((PRIORITY_RANK[l] for l in levels), default=0)]

    summary, readiness_assessment = _narrative(req, recs, risks)

    return AnalyzeResponse(
        method="rule-based",
        engine="heuristic-planning-analyzer/1.0",
        summary=summary,
        readinessAssessment=readiness_assessment,
        priority=overall,
        recommendations=recs,
        risks=risks,
    )
