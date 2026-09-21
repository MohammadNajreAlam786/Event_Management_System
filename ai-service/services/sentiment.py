"""Participant-feedback sentiment analysis (Phase 9).

The engine is VADER (Valence Aware Dictionary and sEntiment Reasoner --
Hutto & Gilbert, 2014), a lexicon-and-rule-based sentiment model. It is a real,
published sentiment analyser -- not a keyword count and not a fabricated result.
It runs fully offline (the lexicon ships with the `vaderSentiment` package), is
deterministic, and is cheap enough to call per request. A small event-feedback
lexicon extension is merged on top so common event terms ("informative",
"disorganised", "started late", ...) are scored the way an organiser would read
them.

The analyser is constructed once at import time (`_ANALYZER`) and reused for
every request -- no per-request model load (Phase 9 §63).

Output contract (see models/schemas.py :: SentimentResponse):
    sentiment : "POSITIVE" | "NEUTRAL" | "NEGATIVE"
    score     : float 0..1 -- model confidence = |compound|, the strength of the
                signal. This is the model's own score, NOT a calibrated
                probability (§27).
    compound  : float -1..1 -- VADER's normalised aggregate valence.
    breakdown : {positive, neutral, negative} proportions that sum to ~1.
    method    : "vader"
    model     : "vader-3.3.2+event-lexicon-v1"
"""
from __future__ import annotations

from typing import Dict

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

# Longest comment we will analyse. The backend already caps stored comments at
# 1000 chars; this is a defensive upper bound for the AI service itself (§26).
MAX_TEXT_LENGTH = 5000

METHOD = "vader"
MODEL = "vader-3.3.2+event-lexicon-v1"

# Classification bands on VADER's compound score. A widened neutral band (vs the
# stock ±0.05) keeps lukewarm feedback ("it was okay, nothing special") in
# NEUTRAL rather than over-reporting weak signals as POSITIVE / NEGATIVE.
POSITIVE_AT = 0.35
NEGATIVE_AT = -0.35

# Event-feedback terms the stock VADER lexicon scores weakly or not at all.
# Values are on VADER's scale (roughly -4 .. +4). Kept small and general -- this
# is domain tuning, not a hand-built classifier.
_DOMAIN_LEXICON: Dict[str, float] = {
    "poorly": -1.9,
    "poor": -1.7,
    "badly": -1.8,
    "late": -1.5,
    "delayed": -1.5,
    "delay": -1.3,
    "delays": -1.3,
    "disorganised": -2.6,
    "disorganized": -2.6,
    "unorganised": -2.4,
    "unorganized": -2.4,
    "mismanaged": -2.2,
    "chaotic": -2.1,
    "rushed": -1.3,
    "dragged": -1.2,
    "underwhelming": -1.6,
    "mediocre": -1.4,
    "boring": -1.9,
    "bored": -1.6,
    "overcrowded": -1.4,
    "cramped": -1.2,
    "confusing": -1.5,
    "informative": 2.0,
    "engaging": 1.9,
    "insightful": 2.0,
    "interactive": 1.2,
    "well-organised": 2.2,
    "well-organized": 2.2,
    "seamless": 1.9,
    "smooth": 1.3,
    "punctual": 1.2,
}


def _build_analyzer() -> SentimentIntensityAnalyzer:
    analyzer = SentimentIntensityAnalyzer()
    analyzer.lexicon.update(_DOMAIN_LEXICON)
    return analyzer


# Built once, reused for every call.
_ANALYZER = _build_analyzer()


class SentimentError(ValueError):
    """Raised for input the sentiment engine will not accept (empty / oversized / wrong type)."""


def _classify(compound: float) -> str:
    if compound >= POSITIVE_AT:
        return "POSITIVE"
    if compound <= NEGATIVE_AT:
        return "NEGATIVE"
    return "NEUTRAL"


def analyze_text(text: object) -> Dict[str, object]:
    """Analyse one feedback comment.

    Raises SentimentError for non-string, empty (after trim) or oversized input.
    """
    if not isinstance(text, str):
        raise SentimentError("text must be a string")

    cleaned = text.strip()
    if not cleaned:
        raise SentimentError("text must not be empty")
    if len(cleaned) > MAX_TEXT_LENGTH:
        raise SentimentError(f"text must be at most {MAX_TEXT_LENGTH} characters")

    scores = _ANALYZER.polarity_scores(cleaned)
    compound = float(scores["compound"])

    return {
        "sentiment": _classify(compound),
        "score": round(abs(compound), 4),
        "compound": round(compound, 4),
        "breakdown": {
            "positive": round(float(scores["pos"]), 4),
            "neutral": round(float(scores["neu"]), 4),
            "negative": round(float(scores["neg"]), 4),
        },
        "method": METHOD,
        "model": MODEL,
    }


def self_check() -> bool:
    """Cheap readiness probe: the analyser classifies a clearly positive string."""
    try:
        return analyze_text("This was an excellent, well-organised event.")["sentiment"] == "POSITIVE"
    except Exception:  # noqa: BLE001 -- health probe must never raise
        return False
