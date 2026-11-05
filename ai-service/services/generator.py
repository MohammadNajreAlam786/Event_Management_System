"""AI Event Generation Service (Phase 15 - Automated Event Creation).

Synthesizes structured, topic-specific event drafts from essential inputs
(title, startDate, venue).

Generates:
- Professional description tailored specifically to the event title.
- Suitable category (WORKSHOP, CONFERENCE, HACKATHON, SEMINAR, etc.).
- Informative 16:9 landscape banner image + alternatives for regeneration.
- Schedule / agenda with calculated start and end times.
- Objectives, key highlights, requirements, and keywords.
- Legitimate suggested capacity and registration settings.

All generation is topic-grounded, deterministic, and never mutates the
user's source of truth (title, startDate, venue).
"""
import re
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from models.schemas import (
    AgendaItem,
    BannerMeta,
    BannerOption,
    GenerateEventRequest,
    GenerateEventResponse,
)

# ---------------------------------------------------------------- Curated 16:9 Topic Banners
# High-resolution (1600x900, 16:9 aspect ratio) verified Unsplash photography.
# Free from text distortion or generic clip-art.

TOPIC_BANNERS: Dict[str, List[BannerOption]] = {
    "robotics": [
        BannerOption(
            url="https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Advanced robotics prototype and futuristic engineering hardware",
            topic="Robotics & Autonomous Systems",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Robotic arm automation and microcontroller circuit board",
            topic="Industrial Robotics & Hardware",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Robotics engineer inspecting mechanical actuators and sensors",
            topic="Robotics Engineering Lab",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Autonomous mobile robot with computer vision lidar sensors",
            topic="Autonomous Mobile Robotics",
        ),
    ],
    "ai_ml": [
        BannerOption(
            url="https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Generative AI neural network compute visualization",
            topic="AI, Machine Learning & Neural Models",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Deep learning mathematical tensors and neural abstraction",
            topic="Machine Learning Architecture & Deep Learning",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Digital neural network nodes communicating across clusters",
            topic="AI & Deep Neural Computation",
        ),
    ],
    "web_dev": [
        BannerOption(
            url="https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Modern web developer programming on laptop workstation",
            topic="Full-Stack Web Development",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Clean software code editor with TypeScript and React syntax",
            topic="Software Engineering & Frontend",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Computer monitor displaying scalable backend server code",
            topic="Cloud & Backend Development",
        ),
    ],
    "hackathon": [
        BannerOption(
            url="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Hackathon team collaborating intensively on innovative software",
            topic="Hackathon Sprint & Team Innovation",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="High-energy tech workshop and collaborative sprint session",
            topic="Rapid Prototyping & Sprint",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Multi-disciplinary engineering team developing prototype",
            topic="Collaborative Innovation Challenge",
        ),
    ],
    "cybersecurity": [
        BannerOption(
            url="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Cybersecurity defensive matrix and server security perimeter",
            topic="Cybersecurity & Defense",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Cryptographic data stream and zero-trust network matrix",
            topic="Information Security & Cryptography",
        ),
    ],
    "data_science": [
        BannerOption(
            url="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Interactive data visualization analytics and intelligence metrics",
            topic="Data Science & Analytics",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Predictive data analytics dashboard and statistical models",
            topic="Statistical Computing & Insights",
        ),
    ],
    "cloud_devops": [
        BannerOption(
            url="https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Global cloud infrastructure telemetry and data centers",
            topic="Cloud Computing & Distributed Systems",
        ),
    ],
    "design_ux": [
        BannerOption(
            url="https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="UI/UX design workspace with interactive wireframes and components",
            topic="Product Design & UI/UX",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Creative design sprint board with user journey mapping",
            topic="Design Thinking & Prototyping",
        ),
    ],
    "business_startup": [
        BannerOption(
            url="https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Startup pitch stage in front of investors and entrepreneurs",
            topic="Startup Pitching & Venture Growth",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Keynote leadership session in business conference auditorium",
            topic="Executive Leadership & Strategy",
        ),
    ],
    "cultural_music": [
        BannerOption(
            url="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Concert stage lights and festival performance atmosphere",
            topic="Cultural Arts & Live Music",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Vibrant festival crowd and cultural arts performance",
            topic="Music & Cultural Festival",
        ),
    ],
    "sports_fitness": [
        BannerOption(
            url="https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Championship athletic running track under stadium floodlights",
            topic="Athletics & Competitive Sports",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1517649763962-0c623266ddc0?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Dynamic sports tournament competition and athletes in action",
            topic="Sports Tournament & Fitness",
        ),
    ],
    "academic_science": [
        BannerOption(
            url="https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Modern scientific laboratory glassware and research instruments",
            topic="Scientific Research & Discovery",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="University lecture hall and academic scholarly symposium",
            topic="Academic Symposium & Lecture",
        ),
    ],
    "general": [
        BannerOption(
            url="https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Large auditorium conference with attendees and illuminated stage",
            topic="Professional Conference & Gathering",
        ),
        BannerOption(
            url="https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1600&h=900&q=80",
            alt="Engaging seminar presentation and professional development",
            topic="Executive Seminar & Keynote",
        ),
    ],
}


# ---------------------------------------------------------------- Topic Detection
def detect_topic(title: str, user_category: Optional[str] = None) -> Tuple[str, str]:
    """Inspects the title and optional category to classify the domain.

    Returns (topic_key, event_category).
    """
    t = title.lower()

    if any(k in t for k in ["robot", "robotics", "drone", "autonomous", "actuator", "arduino", "ros", "hardware"]):
        category = "WORKSHOP" if any(w in t for w in ["workshop", "bootcamp", "hands-on", "lab"]) else "TECHNICAL"
        return "robotics", category

    if any(k in t for k in ["ai", "artificial intelligence", "machine learning", "deep learning", "neural", "llm", "gpt", "vision", "nlp"]):
        category = "CONFERENCE" if any(w in t for w in ["conference", "summit", "symposium"]) else "TECHNICAL"
        return "ai_ml", category

    if any(k in t for k in ["hackathon", "code sprint", "buildathon", "game jam", "dev sprint"]):
        return "hackathon", "HACKATHON"

    if any(k in t for k in ["web", "react", "frontend", "backend", "full-stack", "fullstack", "javascript", "typescript", "node", "next.js", "css", "html", "api"]):
        category = "WORKSHOP" if "workshop" in t else "TECHNICAL"
        return "web_dev", category

    if any(k in t for k in ["cyber", "security", "pentest", "hacking", "encryption", "cryptography", "infosec", "soc"]):
        category = "WORKSHOP" if "workshop" in t else "TECHNICAL"
        return "cybersecurity", category

    if any(k in t for k in ["data", "analytics", "big data", "bi", "tableau", "statistics", "pandas", "sql"]):
        category = "SEMINAR" if "seminar" in t else "TECHNICAL"
        return "data_science", category

    if any(k in t for k in ["cloud", "devops", "aws", "azure", "docker", "kubernetes", "infra", "ci/cd"]):
        category = "TECHNICAL"
        return "cloud_devops", category

    if any(k in t for k in ["design", "ui", "ux", "figma", "prototype", "creative", "graphics", "typography"]):
        category = "WORKSHOP" if "workshop" in t else "OTHER"
        return "design_ux", category

    if any(k in t for k in ["startup", "business", "pitch", "venture", "investor", "entrepreneur", "marketing", "sales"]):
        category = "CONFERENCE" if any(w in t for w in ["conference", "summit"]) else "SEMINAR"
        return "business_startup", category

    if any(k in t for k in ["music", "concert", "dance", "cultural", "fest", "drama", "theatre", "art", "band"]):
        return "cultural_music", "CULTURAL"

    if any(k in t for k in ["sport", "football", "cricket", "marathon", "fitness", "tournament", "basketball", "athletics", "badminton", "chess"]):
        return "sports_fitness", "SPORTS"

    if any(k in t for k in ["science", "physics", "chemistry", "biology", "academic", "research", "symposium", "journal"]):
        category = "ACADEMIC"
        return "academic_science", category

    # Fallback to category hints if provided
    if user_category:
        cat_upper = user_category.upper()
        if cat_upper == "WORKSHOP":
            return "general", "WORKSHOP"
        if cat_upper == "CONFERENCE":
            return "general", "CONFERENCE"
        if cat_upper == "SEMINAR":
            return "general", "SEMINAR"
        if cat_upper == "HACKATHON":
            return "hackathon", "HACKATHON"
        if cat_upper == "CULTURAL":
            return "cultural_music", "CULTURAL"
        if cat_upper == "SPORTS":
            return "sports_fitness", "SPORTS"
        if cat_upper == "ACADEMIC":
            return "academic_science", "ACADEMIC"
        if cat_upper == "TECHNICAL":
            return "web_dev", "TECHNICAL"

    # Default category heuristic based on words in title
    if "workshop" in t:
        return "general", "WORKSHOP"
    if "seminar" in t:
        return "general", "SEMINAR"
    if "conference" in t or "summit" in t:
        return "general", "CONFERENCE"

    return "general", "OTHER"


# ---------------------------------------------------------------- Content Synthesizer
def generate_event_content(
    title: str,
    venue: str,
    start_dt: datetime,
    topic: str,
    category: str,
) -> Dict:
    """Synthesizes rich, structured, domain-tailored content for the event."""
    start_hour = start_dt.strftime("%I:%M %p")
    start_date_str = start_dt.strftime("%A, %B %d, %Y")

    if topic == "robotics":
        duration_hours = 4.0
        suggested_capacity = 40
        registration_type = "INDIVIDUAL"
        tagline = "Master autonomous robotics, closed-loop sensor feedback, and real-time embedded control."
        objectives = [
            "Understand modern robotic kinematics and electronic actuator interfacing.",
            "Program closed-loop microcontroller algorithms for obstacle detection and path planning.",
            "Assemble and calibrate autonomous navigation sensors in hands-on lab workstations.",
            "Deploy autonomous locomotion routines and analyze real-world telemetry feedback.",
        ]
        highlights = [
            "Hands-on hardware assembly with complete sensor and microcontroller toolkits.",
            "Live robotics arena obstacle course and navigation challenge.",
            "Real-time sensor calibration guidance from experienced robotics researchers.",
            "Interactive demonstration showcase with peer project evaluation.",
        ]
        intended_audience = (
            "Engineering students, hardware enthusiasts, robotics practitioners, and embedded systems developers."
        )
        requirements = [
            "Laptop with a standard USB-A/C port and administrative access to install IDE software.",
            "Basic familiarity with Python, C/C++, or fundamental algorithmic logic.",
            "Hardware safety goggles and note-taking materials (workshop kits provided on-site).",
        ]
        keywords = ["Robotics", "Embedded Systems", "Autonomous Navigation", "Sensors", "Hardware Lab", "Engineering"]
        agenda_titles = [
            ("Welcome, Kit Distribution & Lab Safety", "Unpack hardware toolkits, verify actuator components, and review safety guidelines."),
            ("Robotics Architecture & Kinematics", "Fundamentals of motor drives, power delivery, and closed-loop control systems."),
            ("Sensor Fusion & Environment Perception", "Interfacing ultrasonic, infrared, and optical sensors for obstacle tracking."),
            ("Hands-On Coding & Logic Calibration", "Live firmware flashing, PID tuning, and autonomous path tracking in the test arena."),
            ("Grand Arena Challenge & Demonstration", "Showcase of autonomous robot routines, peer evaluation, and certificates."),
        ]

    elif topic == "ai_ml":
        duration_hours = 6.0
        suggested_capacity = 80
        registration_type = "INDIVIDUAL"
        tagline = "Harness cutting-edge neural architectures, foundation models, and scalable AI inference."
        objectives = [
            "Explore foundational transformer models and modern vector embedding pipelines.",
            "Implement fine-tuning and parameter-efficient adaptation (PEFT) workflows.",
            "Build retrieval-augmented generation (RAG) architectures with low-latency vector databases.",
            "Evaluate production AI reliability, guardrails, and latency optimization techniques.",
        ]
        highlights = [
            "Deep-dive technical sessions by leading AI practitioners and researchers.",
            "Live code walk-throughs of real-world transformer fine-tuning and inference pipelines.",
            "Interactive Q&A on AI ethics, enterprise deployment, and data privacy safeguards.",
            "Dedicated peer networking lounge with industry AI tech sponsors.",
        ]
        intended_audience = (
            "Software engineers, data scientists, ML practitioners, tech leads, and AI researchers."
        )
        requirements = [
            "Laptop with a modern web browser and stable access to cloud notebook environments (e.g., Google Colab).",
            "Working knowledge of Python and fundamental machine learning concepts.",
        ]
        keywords = ["Artificial Intelligence", "Machine Learning", "Transformers", "RAG", "Deep Learning", "Vector Search"]
        agenda_titles = [
            ("Keynote: The Frontier of Modern AI Architectures", "Opening address on emerging model paradigms, compute efficiency, and ecosystem trends."),
            ("Deep Dive: Attention Mechanisms & Foundation Models", "Detailed architectural breakdown of modern transformer pipelines."),
            ("Hands-On Lab: Implementing RAG with Vector Stores", "Step-by-step implementation of production retrieval systems with live evaluation."),
            ("Networking & Tech Showcase", "Connect with fellow engineers and review sponsored production AI demonstrations."),
            ("Panel: Scalable Production Deployment & Safety", "Discussion on model quantization, monitoring, telemetry, and guardrails."),
        ]

    elif topic == "hackathon":
        duration_hours = 24.0
        suggested_capacity = 120
        registration_type = "TEAM"
        max_team_size = 4
        tagline = "Sprint, collaborate, and build high-impact software solutions in an intense innovation challenge."
        objectives = [
            "Ideate, architect, and prototype an end-to-end working software solution within 24 hours.",
            "Collaborate effectively in cross-functional teams combining development, design, and product thinking.",
            "Pitch functional prototypes to a panel of experienced industry judges and domain experts.",
        ]
        highlights = [
            "24 hours of non-stop hacking, mentoring, and collaborative problem solving.",
            "Dedicated technical mentors available round-the-clock across cloud, AI, and mobile domains.",
            "Substantial prize pool, category awards, and sponsor API credits for top teams.",
            "High-energy pitch stage and demonstration exhibition with industry leaders.",
        ]
        intended_audience = (
            "Software developers, UI/UX designers, product builders, and university innovators."
        )
        requirements = [
            "Laptop, charger, and preferred development stack pre-installed.",
            "Active GitHub/GitLab account for project submission and commit verification.",
            "Registration confirmed as a team (2 to 4 members) or individually for on-site team formation.",
        ]
        keywords = ["Hackathon", "Coding Sprint", "Rapid Prototyping", "Team Innovation", "Pitch Competition", "Software"]
        agenda_titles = [
            ("Check-In, Breakfast & Team Formation", "Registration badge pick-up, morning refreshments, and on-site team matchmaking."),
            ("Opening Ceremony & Problem Statement Reveal", "Rules overview, sponsor API announcements, and official countdown start."),
            ("Hacking Period & Mentor Check-Ins", "Intensive building phase with scheduled technical mentorship rounds."),
            ("Midnight Snack & Lightning Tech Talks", "Energizing break with quick tips on pitching and deployment best practices."),
            ("Final Code Freeze & Submission Deadline", "Project repos locked and deployment URLs submitted to the judging platform."),
            ("Judging Presentations & Awards Ceremony", "Top finalist team pitches, jury deliberations, and winner announcements."),
        ]

    elif topic == "web_dev":
        duration_hours = 3.5
        suggested_capacity = 60
        registration_type = "INDIVIDUAL"
        tagline = "Build lightning-fast, resilient web applications with modern frontend and cloud backend tooling."
        objectives = [
            "Master modern component architecture, state management patterns, and responsive UI design.",
            "Implement high-performance API integration with robust server-side error handling.",
            "Optimize bundle size, accessibility compliance (WCAG), and Core Web Vitals.",
        ]
        highlights = [
            "Step-by-step practical walk-through of building and shipping a production web feature.",
            "Actionable performance profiling techniques using Chrome DevTools and Lighthouse.",
            "Code reviews and real-time guidance on enterprise-ready project structure.",
        ]
        intended_audience = (
            "Frontend engineers, full-stack developers, web designers, and CS students."
        )
        requirements = [
            "Laptop with Node.js LTS and a code editor (VS Code recommended) pre-installed.",
            "Working familiarity with modern JavaScript (ES6+), HTML, and CSS fundamentals.",
        ]
        keywords = ["Web Development", "React", "Frontend", "TypeScript", "Performance", "Full-Stack"]
        agenda_titles = [
            ("Welcome & Development Environment Setup", "Verification of dependencies, starter repo clone, and project overview."),
            ("Architecting Resilient Component Systems", "Patterns for maintainable UI components, accessibility, and state boundaries."),
            ("Live Coding: Scalable Data Fetching & Caching", "Hands-on integration with REST and asynchronous backend streams."),
            ("Performance Tuning & Core Web Vitals", "Real-world profiling, layout shift minimization, and asset optimization."),
            ("Q&A, Project Review & Next Steps", "Open floor for attendee architecture questions and curated learning resources."),
        ]

    elif topic == "cybersecurity":
        duration_hours = 4.0
        suggested_capacity = 50
        registration_type = "INDIVIDUAL"
        tagline = "Harden systems, simulate red-team attacks, and implement zero-trust defensive architectures."
        objectives = [
            "Analyze current enterprise threat landscapes and top OWASP vulnerability vectors.",
            "Conduct structured defensive threat modeling across networks and API endpoints.",
            "Deploy automated security scanning and identity-based zero-trust perimeters.",
        ]
        highlights = [
            "Interactive capture-the-flag (CTF) security challenge with guided walkthroughs.",
            "Live demonstration of common credential stuffing and injection mitigation strategies.",
            "Real-world incident response post-mortem analysis.",
        ]
        intended_audience = (
            "Security engineers, system administrators, backend developers, and cybersecurity enthusiasts."
        )
        requirements = [
            "Laptop with virtualization capability (VirtualBox/Docker) or modern browser for web labs.",
            "Basic understanding of TCP/IP networking, Linux terminal commands, and web protocols.",
        ]
        keywords = ["Cybersecurity", "Zero Trust", "Threat Modeling", "Defensive Security", "InfoSec", "CTF"]
        agenda_titles = [
            ("Briefing: Threat Landscape & Attack Vectors", "Survey of modern attack tactics, supply chain risks, and compliance standards."),
            ("Vulnerability Analysis & Secure API Architecture", "Hands-on inspection of authentication flaws, CSRF, and injection vectors."),
            ("Defensive Lab: Hardening & Perimeter Defense", "Configuring rate limiting, Web Application Firewalls, and audit logging."),
            ("Mini Capture-The-Flag (CTF) Simulation", "Guided challenge applying defensive principles to secure compromised nodes."),
            ("Incident Response & Best Practice Debrief", "Actionable checklists for production monitoring and breach response."),
        ]

    elif topic == "data_science":
        duration_hours = 3.5
        suggested_capacity = 55
        registration_type = "INDIVIDUAL"
        tagline = "Transform complex raw data into actionable predictive insights and executive intelligence."
        objectives = [
            "Cleanse, structure, and explore high-dimensional real-world datasets effectively.",
            "Apply statistical learning models to discover latent correlations and predictive patterns.",
            "Design clear, persuasive data visualizations for technical and business stakeholders.",
        ]
        highlights = [
            "Comprehensive hands-on case study utilizing real-world transactional data.",
            "Interactive visualization building with modern analytics libraries.",
            "Practical methodology for feature engineering and hypothesis testing.",
        ]
        intended_audience = (
            "Data analysts, business intelligence practitioners, aspiring data scientists, and researchers."
        )
        requirements = [
            "Laptop with Python (Jupyter Notebook / Google Colab) ready.",
            "Familiarity with basic statistics and basic data manipulation.",
        ]
        keywords = ["Data Science", "Analytics", "Machine Learning", "Python", "Data Visualization", "Statistics"]
        agenda_titles = [
            ("Introduction & Exploratory Data Analysis", "Loading messy datasets, handling missing values, and distribution analysis."),
            ("Feature Engineering & Statistical Modeling", "Selecting relevant indicators and training regression/classification models."),
            ("Communicating Insights with Visualizations", "Crafting intuitive charts, dashboards, and storytelling narratives."),
            ("Hands-On Mini Project & Group Review", "Participants build a quick predictive pipeline and review findings with mentors."),
        ]

    elif topic == "cultural_music":
        duration_hours = 5.0
        suggested_capacity = 250
        registration_type = "INDIVIDUAL"
        tagline = "Celebrate artistic expression, rhythmic harmony, and vibrant community culture."
        objectives = [
            "Experience diverse artistic showcases spanning traditional and contemporary disciplines.",
            "Engage in community-driven cultural workshops and interactive musical sessions.",
            "Foster creative collaboration and appreciation for multicultural traditions.",
        ]
        highlights = [
            "Spectacular live performances by acclaimed musical and cultural artists.",
            "Interactive cultural exhibit booths, artisan displays, and artisan food stalls.",
            "Open-mic spotlight segment empowering emerging student and local performers.",
        ]
        intended_audience = (
            "Community members, students, art lovers, music enthusiasts, and families."
        )
        requirements = [
            "Valid digital event pass (available upon registration).",
            "Casual comfortable attire suitable for live performances and festival seating.",
        ]
        keywords = ["Cultural Fest", "Live Music", "Arts", "Community", "Performances", "Celebration"]
        agenda_titles = [
            ("Gates Open, Art Exhibits & Food Stalls", "Welcome reception, craft displays, and acoustic opening sets."),
            ("Inaugural Cultural Showcase", "Traditional opening dance performances and ceremonial welcome address."),
            ("Live Music Performances & Feature Sets", "Main stage concerts featuring headline musicians and collaborative ensembles."),
            ("Interactive Arts & Open Mic Session", "Attendee participation, talent spotlights, and impromptu jam sessions."),
            ("Grand Finale & Closing Fireworks Display", "High-energy collective performance, thank you address, and celebration."),
        ]

    elif topic == "sports_fitness":
        duration_hours = 4.5
        suggested_capacity = 100
        registration_type = "INDIVIDUAL"
        tagline = "Unite through athletic excellence, competitive sportsmanship, and endurance."
        objectives = [
            "Promote active health, endurance training, and sportsmanship in an organized tournament format.",
            "Compete in structured athletic rounds guided by certified referees and sporting officials.",
            "Foster teamwork, agility, and fair play across all participating divisions.",
        ]
        highlights = [
            "Professionally officiated tournament matches with electronic scoreboard tracking.",
            "Hydration stations, certified sports medical staff, and warm-up coaching on-site.",
            "Medals, trophies, and recognition certificates for podium finishers.",
        ]
        intended_audience = (
            "Athletes, fitness enthusiasts, sports club members, and university teams."
        )
        requirements = [
            "Appropriate athletic sportswear and non-marking sports shoes.",
            "Personal water bottle and any specialized personal sporting equipment.",
        ]
        keywords = ["Sports", "Tournament", "Fitness", "Athletics", "Competition", "Endurance"]
        agenda_titles = [
            ("Athlete Check-In & Medical Clearance", "Jersey verification, bib collection, and pre-match health screening."),
            ("Warm-Up Drills & Rules Briefing", "Group stretching led by fitness trainers and referee guidelines review."),
            ("Preliminary Tournament Rounds", "High-intensity group stage fixtures across designated playing areas."),
            ("Semi-Finals & Championship Match", "Pinnacle competitive matches featuring top qualifying athletes."),
            ("Podium Ceremony & Trophy Presentation", "Awarding medals, certificates, and closing remarks by guest officials."),
        ]

    else:  # General / Conference / Seminar fallback
        duration_hours = 3.0
        suggested_capacity = 75
        registration_type = "INDIVIDUAL"
        tagline = f"Join industry leaders and practitioners at {venue} for an insightful, forward-looking event."
        objectives = [
            f"Gain actionable industry insights and strategic perspectives on {title}.",
            "Network with peers, organizers, and thought leaders from across the region.",
            "Participate in guided discussions, structured Q&A, and practical takeaways.",
        ]
        highlights = [
            "Keynote presentations addressing emerging challenges and industry solutions.",
            "Interactive panel discussion with audience live questioning.",
            "Dedicated networking coffee breaks and digital resource distribution.",
        ]
        intended_audience = (
            "Professionals, academics, students, and community members interested in the topic."
        )
        requirements = [
            "Notebook or digital device for taking session notes.",
            "Valid digital event pass (issued instantly upon registration).",
        ]
        keywords = ["Conference", "Professional Development", "Networking", "Industry Insights", "Seminar"]
        agenda_titles = [
            ("Registration, Welcome Coffee & Networking", "Attendee check-in, distribution of event materials, and informal morning coffee."),
            ("Opening Keynote Presentation", "In-depth presentation covering the core themes, opportunities, and trends."),
            ("Interactive Discussion & Panel Session", "Moderated discussion exploring practical challenges with audience Q&A."),
            ("Breakout Networking & Refreshments", "Structured peer networking in the main foyer with light refreshments."),
            ("Closing Summary & Actionable Takeaways", "Key synthesis of learnings, distribution of digital resources, and wrap-up."),
        ]

    # Calculate agenda timestamps based on actual start_dt
    agenda_items: List[AgendaItem] = []
    current_time = start_dt
    time_per_segment_min = int((duration_hours * 60) / max(1, len(agenda_titles)))

    for title_text, desc_text in agenda_titles:
        time_str = current_time.strftime("%I:%M %p")
        agenda_items.append(AgendaItem(time=time_str, title=title_text, description=desc_text))
        current_time += timedelta(minutes=time_per_segment_min)

    # End date calculation
    end_dt = start_dt + timedelta(hours=duration_hours)

    # Construct the complete professional description
    description = (
        f"{title}\n\n"
        f"📅 Date & Time: {start_date_str} at {start_hour}\n"
        f"📍 Venue: {venue}\n\n"
        f"Overview\n"
        f"{tagline}\n\n"
        f"This event brings together participants for a focused, high-value experience tailored to {title.strip()}. "
        f"Whether you are looking to acquire practical skills, exchange ideas with peers, or explore the latest "
        f"developments in the field, this session is designed to deliver meaningful takeaways.\n\n"
        f"Key Objectives & Learning Outcomes:\n"
        + "".join(f"• {obj}\n" for obj in objectives)
        + f"\nKey Event Highlights:\n"
        + "".join(f"• {hl}\n" for hl in highlights)
        + f"\nIntended Audience:\n"
        f"{intended_audience}\n\n"
        f"Agenda & Session Breakdown:\n"
        + "".join(f"• {item.time} — {item.title}: {item.description}\n" for item in agenda_items)
        + f"\nPreparation & Requirements:\n"
        + "".join(f"• {req}\n" for req in requirements)
    )

    return {
        "tagline": tagline,
        "description": description.strip(),
        "objectives": objectives,
        "highlights": highlights,
        "intendedAudience": intended_audience,
        "agenda": agenda_items,
        "durationHours": duration_hours,
        "requirements": requirements,
        "suggestedCapacity": suggested_capacity,
        "registrationType": registration_type,
        "maxTeamSize": 4 if registration_type == "TEAM" else None,
        "keywords": keywords,
        "endDt": end_dt,
    }


# ---------------------------------------------------------------- Banner Selector
def select_banner_for_topic(topic: str, existing_url: Optional[str] = None) -> BannerMeta:
    """Selects a verified 16:9 landscape banner matching the event domain.

    If existing_url is provided (e.g. for banner regeneration), picks the next
    alternative in the list to cycle options smoothly.
    """
    options = TOPIC_BANNERS.get(topic, TOPIC_BANNERS["general"])

    # Determine index to select
    selected_idx = 0
    if existing_url:
        for i, opt in enumerate(options):
            if opt.url == existing_url:
                selected_idx = (i + 1) % len(options)
                break

    chosen = options[selected_idx]

    # Provide remaining alternatives for instant selection/preview
    alternatives = [opt for opt in options if opt.url != chosen.url]

    return BannerMeta(
        url=chosen.url,
        alt=chosen.alt,
        topic=chosen.topic,
        source="Unsplash Curated Topic Visual",
        isAiGenerated=False,
        note=(
            "Topic-specific verified landscape photography (16:9). "
            "Server-side curated fallback active (no external paid image AI key configured)."
        ),
        alternatives=alternatives,
    )


# ---------------------------------------------------------------- Main Entry Point
def generate_event(payload: GenerateEventRequest) -> GenerateEventResponse:
    """Primary handler: processes title, startDate, venue and synthesizes an event draft."""
    title = (payload.title or "").strip()
    venue = (payload.venue or "").strip()
    start_date_raw = payload.startDate

    # Parse startDate cleanly
    try:
        # Handle ISO strings like 2026-11-20T10:00:00.000Z or 2026-11-20T10:00
        clean_date_str = re.sub(r"Z$", "+00:00", start_date_raw)
        start_dt = datetime.fromisoformat(clean_date_str)
    except Exception:
        # If parsing fails or lacks timezone, default to today + 7 days
        start_dt = datetime.now(timezone.utc) + timedelta(days=7)

    # Detect topic and category
    topic, category = detect_topic(title, payload.category)

    # Mode: "banner" only
    if payload.mode == "banner":
        banner_meta = select_banner_for_topic(topic, payload.existingBanner)
        content = generate_event_content(title, venue, start_dt, topic, category)
        return GenerateEventResponse(
            title=title,
            venue=venue,
            startDate=start_dt.isoformat(),
            endDate=content["endDt"].isoformat(),
            category=category,
            tagline=content["tagline"],
            description=payload.existingDescription or content["description"],
            objectives=content["objectives"],
            highlights=content["highlights"],
            intendedAudience=content["intendedAudience"],
            agenda=content["agenda"],
            durationHours=content["durationHours"],
            requirements=content["requirements"],
            suggestedCapacity=content["suggestedCapacity"],
            registrationType=content["registrationType"],
            maxTeamSize=content["maxTeamSize"],
            registrationStartDate=datetime.now(timezone.utc).isoformat(),
            registrationEndDate=(start_dt - timedelta(days=1)).isoformat(),
            keywords=content["keywords"],
            banner=banner_meta,
            method="rule-based-topic-synthesizer",
            engine="eventflow-domain-ai-generator/1.0",
            generatedAt=datetime.now(timezone.utc).isoformat(),
        )

    # Full or description mode
    content = generate_event_content(title, venue, start_dt, topic, category)

    # In "description" mode, preserve existing banner if present
    if payload.mode == "description" and payload.existingBanner:
        banner_meta = select_banner_for_topic(topic, None)
        banner_meta.url = payload.existingBanner
    else:
        banner_meta = select_banner_for_topic(topic, payload.existingBanner)

    reg_start_dt = datetime.now(timezone.utc)
    reg_end_dt = start_dt - timedelta(days=1)
    if reg_end_dt < reg_start_dt:
        reg_end_dt = start_dt

    return GenerateEventResponse(
        title=title,
        venue=venue,
        startDate=start_dt.isoformat(),
        endDate=content["endDt"].isoformat(),
        category=category,
        tagline=content["tagline"],
        description=content["description"],
        objectives=content["objectives"],
        highlights=content["highlights"],
        intendedAudience=content["intendedAudience"],
        agenda=content["agenda"],
        durationHours=content["durationHours"],
        requirements=content["requirements"],
        suggestedCapacity=content["suggestedCapacity"],
        registrationType=content["registrationType"],
        maxTeamSize=content["maxTeamSize"],
        registrationStartDate=reg_start_dt.isoformat(),
        registrationEndDate=reg_end_dt.isoformat(),
        keywords=content["keywords"],
        banner=banner_meta,
        method="rule-based-topic-synthesizer",
        engine="eventflow-domain-ai-generator/1.0",
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )


def self_check() -> bool:
    """Self-check for health probe readiness."""
    try:
        sample_req = GenerateEventRequest(
            title="Robotics Workshop",
            startDate="2026-11-20T10:00:00Z",
            venue="Innovation Hall",
        )
        res = generate_event(sample_req)
        return bool(res.title and res.banner.url and res.category)
    except Exception:
        return False
