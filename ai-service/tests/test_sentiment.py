"""Phase 9 - feedback sentiment analysis tests.

Exercises the real VADER-based engine (services/sentiment.py) directly. Covers
the required AI test matrix (§57): positive / neutral / negative examples,
empty input, oversized input, malformed input, plus determinism and the
single-load (singleton) analyser. "AI service unavailable" is a backend test
(see backend/__phase9_tests.mjs).

Run from the ai-service directory:
    .venv/Scripts/python.exe tests/test_sentiment.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import sentiment as S  # noqa: E402
from services.sentiment import SentimentError, analyze_text  # noqa: E402

PASS = 0
FAIL = 0


def check(name, cond, detail=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}  {detail}")


# ------------------------------------------------------------------ positive


def test_positive():
    for text in [
        "Excellent event. The sessions were very informative.",
        "Absolutely loved every minute - the best workshop I have attended!",
        "Really well organised and the speakers were engaging and insightful.",
    ]:
        r = analyze_text(text)
        check(f"positive: {text[:40]!r}", r["sentiment"] == "POSITIVE", r)
        check(f"positive score in 0..1: {text[:30]!r}", 0.0 <= r["score"] <= 1.0, r["score"])
        check(f"positive method is vader: {text[:30]!r}", r["method"] == "vader", r["method"])


# ------------------------------------------------------------------ neutral


def test_neutral():
    for text in [
        "The event was okay, but nothing special.",
        "It was an event. People came and then it ended.",
        "The sessions ran as scheduled and covered the listed topics.",
    ]:
        r = analyze_text(text)
        check(f"neutral: {text[:40]!r}", r["sentiment"] == "NEUTRAL", r)


# ------------------------------------------------------------------ negative


def test_negative():
    for text in [
        "The event was poorly organized and the sessions started very late.",
        "Waste of time. Disorganised, overcrowded and boring.",
        "Very disappointing - the schedule was chaotic and nothing started on time.",
    ]:
        r = analyze_text(text)
        check(f"negative: {text[:40]!r}", r["sentiment"] == "NEGATIVE", r)


# ------------------------------------------------------------------ breakdown / shape


def test_shape():
    r = analyze_text("The workshop was genuinely useful and clearly explained.")
    keys = {"sentiment", "score", "compound", "breakdown", "method", "model"}
    check("shape: all keys present", keys.issubset(r.keys()), set(r.keys()))
    b = r["breakdown"]
    check("shape: breakdown has pos/neu/neg", {"positive", "neutral", "negative"} == set(b.keys()), b)
    check("shape: breakdown sums to ~1", abs(sum(b.values()) - 1.0) < 0.02, sum(b.values()))
    check("shape: compound in -1..1", -1.0 <= r["compound"] <= 1.0, r["compound"])
    check("shape: model id recorded", r["model"].startswith("vader-"), r["model"])


# ------------------------------------------------------------------ bad input


def test_empty_input():
    for bad in ["", "   ", "\n\t "]:
        try:
            analyze_text(bad)
            check(f"empty rejected: {bad!r}", False, "no error raised")
        except SentimentError:
            check(f"empty rejected: {bad!r}", True)


def test_oversized_input():
    huge = "good " * 3000  # ~15000 chars, well over the 5000 cap
    try:
        analyze_text(huge)
        check("oversized rejected", False, "no error raised")
    except SentimentError as exc:
        check("oversized rejected", True)
        check("oversized message mentions limit", "5000" in str(exc), str(exc))


def test_malformed_input():
    for bad in [None, 123, 4.5, ["not", "a", "string"], {"text": "x"}]:
        try:
            analyze_text(bad)
            check(f"non-string rejected: {type(bad).__name__}", False, "no error raised")
        except SentimentError:
            check(f"non-string rejected: {type(bad).__name__}", True)


# ------------------------------------------------------------------ determinism / singleton


def test_deterministic():
    text = "The venue was great but registration was slow and confusing."
    a = analyze_text(text)
    b = analyze_text(text)
    check("deterministic: same input -> same output", a == b, (a, b))


def test_singleton_analyzer():
    check("singleton: analyzer built once at import", S._ANALYZER is S._ANALYZER)
    check("singleton: domain lexicon merged", S._ANALYZER.lexicon.get("disorganised") == -2.6,
          S._ANALYZER.lexicon.get("disorganised"))
    check("self_check passes", S.self_check() is True)


if __name__ == "__main__":
    for fn in [
        test_positive,
        test_neutral,
        test_negative,
        test_shape,
        test_empty_input,
        test_oversized_input,
        test_malformed_input,
        test_deterministic,
        test_singleton_analyzer,
    ]:
        fn()
    print(f"\n==== {PASS} passed, {FAIL} failed ====")
    sys.exit(0 if FAIL == 0 else 1)
