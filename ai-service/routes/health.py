"""Health-check route for the AI service."""
from datetime import datetime, timezone

from fastapi import APIRouter

from services.sentiment import self_check as sentiment_self_check
from services.improvement import self_check as improvement_self_check

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check():
    """Readiness probe used to verify the AI service is up.

    Reports which capabilities are available. `sentimentAnalysis` /
    `improvementRecommendations` flip to False only if that engine failed a
    minimal self-check -- the service and the other capabilities stay up
    regardless (Phase 9 §64/§65, Phase 11).
    """
    return {
        "success": True,
        "message": "AI service is running",
        "service": "event-management-ai-service",
        "capabilities": {
            "planningAnalysis": True,
            "sentimentAnalysis": sentiment_self_check(),
            "improvementRecommendations": improvement_self_check(),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
