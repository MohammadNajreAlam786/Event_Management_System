"""Feedback sentiment analysis route (Phase 9).

POST /sentiment/analyze -- receives a single participant feedback comment
(forwarded by the Node backend after a participant submits or edits feedback)
and returns a sentiment classification with a model confidence score.

Consumed by the backend only, never by the browser directly. No database
records, tokens or personal data are sent -- only the comment text.
"""
from fastapi import APIRouter, HTTPException

from models.schemas import SentimentRequest, SentimentResponse
from services.sentiment import SentimentError, analyze_text

router = APIRouter(tags=["sentiment"])


@router.post("/sentiment/analyze", response_model=SentimentResponse)
def analyze_sentiment(payload: SentimentRequest) -> SentimentResponse:
    """Classify one feedback comment as POSITIVE / NEUTRAL / NEGATIVE."""
    try:
        result = analyze_text(payload.text)
    except SentimentError as exc:
        # Empty-after-trim / oversized / wrong-type input -> 422, no internals.
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return SentimentResponse(**result)
