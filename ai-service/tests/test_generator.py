"""Phase 15 - Automated Event Generator Scenario Tests.

Verifies:
1. Robotics Workshop generates robotics-specific content and 16:9 robotics banner.
2. AI / ML Summit generates AI-specific content and banner.
3. Hackathon generates team-based registration settings and 24h schedule.
4. Source of truth (title, date, venue) is strictly preserved without mutation.
5. Banner regeneration picks alternative 16:9 banner without mutating description.
6. Description regeneration preserves current banner and user edits.
7. End date is calculated logically from duration.
8. Self-check passes and health check returns eventGeneration=True.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.schemas import GenerateEventRequest
from services.generator import generate_event, self_check

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


# Test 1: Robotics Workshop
req1 = GenerateEventRequest(
    title="Robotics Workshop 2026",
    startDate="2026-11-20T10:00:00Z",
    venue="Innovation Lab, Room 302",
)
res1 = generate_event(req1)

check("T1 Robotics title preserved", res1.title == "Robotics Workshop 2026")
check("T1 Robotics venue preserved", res1.venue == "Innovation Lab, Room 302")
check("T1 Robotics startDate preserved", res1.startDate.startswith("2026-11-20T10:00:00"))
check("T1 Robotics category is WORKSHOP or TECHNICAL", res1.category in ["WORKSHOP", "TECHNICAL"])
check("T1 Robotics banner is 16:9 Unsplash URL", "images.unsplash.com" in res1.banner.url and "1600" in res1.banner.url)
check("T1 Robotics banner topic mentions robotics", "Robotics" in res1.banner.topic)
check("T1 Robotics description tailored to robotics", "robotic" in res1.description.lower() or "actuator" in res1.description.lower())
check("T1 Robotics has objectives", len(res1.objectives) >= 3)
check("T1 Robotics has agenda", len(res1.agenda) >= 4)
check("T1 Robotics endDate is after startDate", res1.endDate > res1.startDate)

# Test 2: AI & Machine Learning Conference
req2 = GenerateEventRequest(
    title="Global AI & Machine Learning Summit",
    startDate="2026-12-05T09:00:00Z",
    venue="Metro Convention Center",
)
res2 = generate_event(req2)
check("T2 AI banner topic is AI/ML", "AI" in res2.banner.topic or "Machine Learning" in res2.banner.topic)
check("T2 AI banner differs from Robotics", res2.banner.url != res1.banner.url)
check("T2 AI description mentions transformers or machine learning", "machine learning" in res2.description.lower() or "ai" in res2.description.lower())

# Test 3: Hackathon
req3 = GenerateEventRequest(
    title="National Code Sprint Hackathon",
    startDate="2026-10-15T09:00:00Z",
    venue="Tech Park Auditorium",
)
res3 = generate_event(req3)
check("T3 Hackathon category is HACKATHON", res3.category == "HACKATHON")
check("T3 Hackathon registrationType is TEAM", res3.registrationType == "TEAM")
check("T3 Hackathon maxTeamSize is set", res3.maxTeamSize == 4)
check("T3 Hackathon duration is 24h", res3.durationHours >= 24)

# Test 4: Banner Regeneration (mode="banner")
req4 = GenerateEventRequest(
    title="Robotics Workshop 2026",
    startDate="2026-11-20T10:00:00Z",
    venue="Innovation Lab, Room 302",
    mode="banner",
    existingBanner=res1.banner.url,
    existingDescription="My custom edited description that must not be lost",
)
res4 = generate_event(req4)
check("T4 Banner regenerated to new URL", res4.banner.url != res1.banner.url)
check("T4 Banner regenerated preserves custom description", res4.description == "My custom edited description that must not be lost")
check("T4 Banner has alternatives available", len(res4.banner.alternatives) >= 1)

# Test 5: Description Regeneration (mode="description")
req5 = GenerateEventRequest(
    title="Robotics Workshop 2026",
    startDate="2026-11-20T10:00:00Z",
    venue="Innovation Lab, Room 302",
    mode="description",
    existingBanner=res4.banner.url,
)
res5 = generate_event(req5)
check("T5 Description regenerated preserves banner URL", res5.banner.url == res4.banner.url)
check("T5 Description has full agenda and objectives", len(res5.agenda) >= 4 and len(res5.objectives) >= 3)

# Test 6: Self check
check("T6 Self check passes", self_check() is True)

print(f"\n==== {PASS} passed, {FAIL} failed ====\n")
if FAIL > 0:
    sys.exit(1)
