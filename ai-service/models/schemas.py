"""Pydantic models for the AI service.

The backend gathers the content to analyse (Phase 4 planning data for
/analyze, a single feedback comment for /sentiment/analyze) and POSTs it here
as JSON. No database credentials, tokens or user records are sent -- only the
text/content required for analysis.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

# ---------------------------------------------------------------- request models


class EventIn(BaseModel):
    title: str = ""
    description: str = ""
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    venue: str = ""
    status: str = ""


class TaskIn(BaseModel):
    title: str = ""
    description: str = ""
    priority: str = "MEDIUM"
    status: str = "TODO"
    dueDate: Optional[str] = None
    assignedTo: str = ""
    overdue: bool = False


class ScheduleIn(BaseModel):
    title: str = ""
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    location: str = ""
    type: str = "SESSION"
    conflictCount: int = 0


class ResourceIn(BaseModel):
    name: str = ""
    category: str = "OTHER"
    quantity: float = 1
    unit: str = ""
    status: str = "REQUIRED"
    estimatedUnitCost: float = 0
    estimatedTotalCost: float = 0


class BudgetIn(BaseModel):
    category: str = "MISCELLANEOUS"
    description: str = ""
    estimatedAmount: float = 0
    actualAmount: Optional[float] = None
    status: str = "PLANNED"


class TeamIn(BaseModel):
    name: str = ""
    role: str = ""
    responsibility: str = ""
    status: str = "INVITED"


class ReadinessIn(BaseModel):
    # Produced by the existing Phase 4 readiness calculation -- never recomputed here.
    overallScore: int = 0
    status: str = "NOT_READY"
    components: Dict[str, float] = Field(default_factory=dict)
    weights: Dict[str, float] = Field(default_factory=dict)


class AnalyzeRequest(BaseModel):
    event: EventIn = Field(default_factory=EventIn)
    tasks: List[TaskIn] = Field(default_factory=list)
    schedule: List[ScheduleIn] = Field(default_factory=list)
    resources: List[ResourceIn] = Field(default_factory=list)
    budget: List[BudgetIn] = Field(default_factory=list)
    team: List[TeamIn] = Field(default_factory=list)
    readiness: ReadinessIn = Field(default_factory=ReadinessIn)

    model_config = {"extra": "ignore"}


# --------------------------------------------------------------- response models


class Recommendation(BaseModel):
    category: str  # TASK | SCHEDULE | RESOURCE | BUDGET | TEAM | GENERAL
    priority: str  # LOW | MEDIUM | HIGH | CRITICAL
    title: str
    description: str
    reason: str
    suggestedAction: str


class Risk(BaseModel):
    category: str  # TASK | SCHEDULE | RESOURCE | BUDGET | TEAM | GENERAL
    severity: str  # LOW | MEDIUM | HIGH | CRITICAL
    title: str
    description: str
    mitigation: str


class AnalyzeResponse(BaseModel):
    method: str = "rule-based"
    engine: str = "heuristic-planning-analyzer/1.0"
    summary: str
    readinessAssessment: str
    priority: str
    recommendations: List[Recommendation]
    risks: List[Risk]


# ------------------------------------------------- sentiment analysis (Phase 9)


class SentimentRequest(BaseModel):
    """One participant feedback comment to analyse.

    `min_length=1` / `max_length` reject empty and oversized input at the schema
    boundary (a 422); whitespace-only input is caught in the service (§26).
    """

    text: str = Field(min_length=1, max_length=5000)

    model_config = {"extra": "ignore"}


class SentimentBreakdown(BaseModel):
    positive: float
    neutral: float
    negative: float


class SentimentResponse(BaseModel):
    sentiment: str  # POSITIVE | NEUTRAL | NEGATIVE
    score: float  # 0..1 model confidence = |compound| (not a calibrated probability)
    compound: float  # -1..1 VADER aggregate valence
    breakdown: SentimentBreakdown
    method: str = "vader"
    model: str = "vader-3.3.2+event-lexicon-v1"


# ---------------------------------------- future-event improvement (Phase 11)
#
# The backend gathers this from the EXISTING Phase 10 analytics service (never
# recomputed here) plus the EXISTING Phase 4/5 planning gatherer -- tasks,
# schedule, resources, budget, team and readiness reuse TaskIn/ScheduleIn/
# ResourceIn/BudgetIn/TeamIn/ReadinessIn above verbatim, so there is exactly one
# definition of each planning shape in this service.


class ImprovementEventIn(BaseModel):
    title: str = ""
    category: str = ""
    venue: str = ""
    status: str = ""
    startDate: Optional[str] = None
    endDate: Optional[str] = None
    maxParticipants: Optional[int] = None


class RegistrationsSummaryIn(BaseModel):
    total: int = 0
    cancelled: int = 0
    allTime: int = 0


class AttendanceSummaryIn(BaseModel):
    present: int = 0
    absent: int = 0
    rate: float = 0


class FeedbackSummaryIn(BaseModel):
    total: int = 0
    averageRating: Optional[float] = None
    ratingDistribution: Dict[str, int] = Field(default_factory=dict)


class SentimentSummaryIn(BaseModel):
    positive: int = 0
    neutral: int = 0
    negative: int = 0
    analyzed: int = 0
    unanalyzed: int = 0
    positivePct: float = 0
    neutralPct: float = 0
    negativePct: float = 0


class CertificateSummaryIn(BaseModel):
    issued: int = 0
    eligible: int = 0
    issuanceRate: float = 0


class ParticipationSummaryIn(BaseModel):
    feedbackParticipationRate: float = 0
    attendedParticipants: int = 0


class ImprovementRequest(BaseModel):
    event: ImprovementEventIn = Field(default_factory=ImprovementEventIn)
    registrations: RegistrationsSummaryIn = Field(default_factory=RegistrationsSummaryIn)
    attendance: AttendanceSummaryIn = Field(default_factory=AttendanceSummaryIn)
    feedback: FeedbackSummaryIn = Field(default_factory=FeedbackSummaryIn)
    sentiment: SentimentSummaryIn = Field(default_factory=SentimentSummaryIn)
    certificates: CertificateSummaryIn = Field(default_factory=CertificateSummaryIn)
    participation: ParticipationSummaryIn = Field(default_factory=ParticipationSummaryIn)
    tasks: List[TaskIn] = Field(default_factory=list)
    schedule: List[ScheduleIn] = Field(default_factory=list)
    resources: List[ResourceIn] = Field(default_factory=list)
    budget: List[BudgetIn] = Field(default_factory=list)
    team: List[TeamIn] = Field(default_factory=list)
    readiness: ReadinessIn = Field(default_factory=ReadinessIn)

    model_config = {"extra": "ignore"}


class EventRecommendation(BaseModel):
    category: str
    title: str
    priority: str  # LOW | MEDIUM | HIGH
    recommendation: str
    reason: str
    evidence: Dict[str, Any] = Field(default_factory=dict)
    expectedBenefit: str = ""
    confidence: str = "MEDIUM"  # HIGH | MEDIUM | LOW -- evidence strength, NOT a statistical confidence interval
    sourceMetrics: List[str] = Field(default_factory=list)


class ImprovementNote(BaseModel):
    """A strength or an improvement area -- an observation, not an action."""

    title: str
    detail: str
    sourceMetrics: List[str] = Field(default_factory=list)


class ImprovementResponse(BaseModel):
    method: str = "rule-based"
    engine: str = "heuristic-improvement-engine/1.0"
    recommendations: List[EventRecommendation] = Field(default_factory=list)
    strengths: List[ImprovementNote] = Field(default_factory=list)
    improvementAreas: List[ImprovementNote] = Field(default_factory=list)
    limitations: List[str] = Field(default_factory=list)
