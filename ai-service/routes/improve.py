"""Future-event improvement recommendation route (Phase 11).

POST /improve-event -- receives a completed event's analytics (Phase 10,
computed by the backend) and planning records (Phase 4), and returns
structured, evidence-grounded recommendations for improving similar future
events. Consumed by the backend only, never by the browser directly. No
database access, no credentials, no personal data beyond what the analytics
service already exposes (an event title/venue/category -- no participant
names or emails).
"""
from fastapi import APIRouter

from models.schemas import ImprovementRequest, ImprovementResponse
from services.improvement import generate_improvements

router = APIRouter(tags=["improvement"])


@router.post("/improve-event", response_model=ImprovementResponse)
def improve_event(payload: ImprovementRequest) -> ImprovementResponse:
    """Generate data-grounded improvement recommendations for one completed event."""
    return generate_improvements(payload)
