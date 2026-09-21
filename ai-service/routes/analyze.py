"""AI planning analysis route.

POST /analyze -- receives an organiser's planning data (gathered and forwarded
by the Node backend) and returns structured, prioritised recommendations and
risks. Consumed by the backend only, never by the browser directly.
"""
from fastapi import APIRouter

from models.schemas import AnalyzeRequest, AnalyzeResponse
from services.analyzer import analyze as run_analysis

router = APIRouter(tags=["ai-planning"])


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_plan(payload: AnalyzeRequest) -> AnalyzeResponse:
    """Analyse the supplied planning data and return structured findings."""
    return run_analysis(payload)
