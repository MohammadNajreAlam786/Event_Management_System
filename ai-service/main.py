"""AI service for the AI-Powered Event Planning & Management System.

Endpoints:
  GET  /health            -- readiness probe (+ capability flags).
  POST /analyze           -- Phase 5 AI Planning Assistant. Takes an organiser's
                            planning data (forwarded by the Node/Express backend)
                            and returns structured recommendations and risks.
  POST /sentiment/analyze -- Phase 9 feedback sentiment analysis. Takes one
                            participant feedback comment and returns a
                            POSITIVE / NEUTRAL / NEGATIVE classification with a
                            model confidence score.
  POST /improve-event     -- Phase 11 future-event improvement. Takes a
                            completed event's Phase 10 analytics + Phase 4
                            planning records and returns data-grounded,
                            explainable recommendations for similar future
                            events.

This service is consumed by the backend, not directly by the frontend.

The /analyze engine is a deterministic rule-based analyzer (services/analyzer.py)
-- not an ML model or LLM (`method: "rule-based"`). The /sentiment/analyze
engine is VADER, a published lexicon-and-rule sentiment model
(services/sentiment.py, `method: "vader"`). The /improve-event engine
(services/improvement.py) is also deterministic and rule-based
(`method: "rule-based"`) -- it is not a predictive model and makes no forecasts.
None of the three is ever misrepresented as something it is not.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.analyze import router as analyze_router
from routes.health import router as health_router
from routes.improve import router as improve_router
from routes.sentiment import router as sentiment_router

app = FastAPI(
    title="AI-Powered Event Planning & Management System -- AI Service",
    version="0.11.0",
    description="Planning decision-support, feedback sentiment analysis, and data-grounded future-event improvement recommendations. Consumed by the Node/Express backend.",
)

# Allow the backend (and, for local debugging, the Vite dev server) to call this service.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(analyze_router)
app.include_router(sentiment_router)
app.include_router(improve_router)


@app.get("/")
def root():
    """Service metadata."""
    return {
        "success": True,
        "message": "AI-Powered Event Planning & Management System -- AI Service",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("AI_SERVICE_HOST", "127.0.0.1"),
        port=int(os.getenv("AI_SERVICE_PORT", "8000")),
        reload=True,
    )
