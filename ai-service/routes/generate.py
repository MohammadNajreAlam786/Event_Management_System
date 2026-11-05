"""AI event generation route.

POST /generate-event -- receives essential event details (title, startDate, venue)
and synthesizes a complete, topic-specific event draft with verified 16:9 landscape
banner visuals and schedule.
"""
from fastapi import APIRouter

from models.schemas import GenerateEventRequest, GenerateEventResponse
from services.generator import generate_event

router = APIRouter(tags=["event-generation"])


@router.post("/generate-event", response_model=GenerateEventResponse)
def generate_event_draft(payload: GenerateEventRequest) -> GenerateEventResponse:
    """Generate a structured, topic-tailored event draft from essential inputs."""
    return generate_event(payload)
