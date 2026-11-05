import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchWebImages, fetchImageAsBase64 } from './webImageFetcher.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '../../public/assets');
const BANNERS_DIR = path.join(__dirname, '../../public/banners');

if (!fs.existsSync(BANNERS_DIR)) {
  fs.mkdirSync(BANNERS_DIR, { recursive: true });
}

// In-memory base64 cache
const assetBase64Cache = new Map();

const getAssetBase64 = (filename) => {
  if (!filename) return null;
  if (assetBase64Cache.has(filename)) {
    return assetBase64Cache.get(filename);
  }
  const filePath = path.join(ASSETS_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const ext = path.extname(filename).toLowerCase().replace('.', '');
  const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  const buf = fs.readFileSync(filePath);
  const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
  assetBase64Cache.set(filename, dataUri);
  return dataUri;
};

const escapeXml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/** Simple deterministic string hash */
const hashString = (str = '') => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

/**
 * 8 Rich, Genre-Specific Theme Archetypes.
 * Each archetype has authentic color palettes, distinct backgrounds,
 * custom decorative motifs (NO futuristic cyber brackets on cultural or business!),
 * custom badges, typography gradients, card styling, and curated visual hero pools.
 */
const THEME_ARCHETYPES = {
  // 1. Cultural, Festivals, Music, Dance, Art, Celebrations
  cultural: {
    archetype: 'cultural',
    heroPool: ['hero_art_festival.jpg', 'hero_music_concert.jpg', 'hero_cultural.jpg'],
    badges: ['🎭 CULTURAL FEST', '🎵 MUSIC GALA', '🎨 ART EXHIBIT', '✨ CELEBRATION'],
    footer: 'EVENTFLOW ARTS & CULTURE // LIVE EXPERIENCE',
    slogans: ['CELEBRATE ART & CULTURE', 'CREATIVITY IN FULL BLOOM', 'RHYTHM, HARMONY & PASSION'],
    highlights: ['Live Performances', 'Artistic Showcase', 'Cultural Fusion', 'Open Stage'],
    defaultTagline: 'Celebrate | Express | Perform | Inspire',
    palettes: [
      {
        id: 'sunset_coral_gold',
        bg1: '#1c0a1a',
        bg2: '#2a0e28',
        bg3: '#150616',
        accent: '#fb923c',      // Warm coral orange
        secondary: '#f43f5e',   // Rose red
        highlight: '#ffd166',   // Radiant gold
        cardBg: '#2d122c',
        cardStroke: 'rgba(251, 146, 60, 0.4)',
        titleGrad1: '#fff7ed',
        titleGrad2: '#fed7aa',
        subGrad1: '#fb923c',
        subGrad2: '#f43f5e',
      },
      {
        id: 'royal_purple_amber',
        bg1: '#140726',
        bg2: '#240a3d',
        bg3: '#0f041e',
        accent: '#f72585',      // Vivid magenta
        secondary: '#7209b7',   // Royal violet
        highlight: '#ffb703',   // Warm amber
        cardBg: '#240f38',
        cardStroke: 'rgba(247, 37, 133, 0.35)',
        titleGrad1: '#ffffff',
        titleGrad2: '#f3e8ff',
        subGrad1: '#f72585',
        subGrad2: '#ffd166',
      },
    ],
  },

  // 2. Business, Executive, Seminars, Conferences, Leadership, Management
  corporate: {
    archetype: 'corporate',
    heroPool: ['hero_seminar_business.jpg', 'hero_business_conference.jpg'],
    badges: ['💼 EXECUTIVE SUMMIT', '🎙️ KEYNOTE SEMINAR', '🏢 LEADERSHIP FORUM', '📈 BUSINESS SUMMIT'],
    footer: 'EVENTFLOW EXECUTIVE SERIES // PROFESSIONAL EDITION',
    slogans: ['STRATEGY INTO IMPACT', 'VISIONARY LEADERSHIP', 'EMPOWERING GROWTH'],
    highlights: ['Executive Keynotes', 'Strategic Insights', 'Industry Networking', 'Leadership Panel'],
    defaultTagline: 'Lead | Strategize | Connect | Transform',
    palettes: [
      {
        id: 'oxford_navy_gold',
        bg1: '#071120',
        bg2: '#0d1d36',
        bg3: '#050c17',
        accent: '#d4af37',      // Champagne Gold
        secondary: '#38bdf8',   // Sky Blue
        highlight: '#facc15',
        cardBg: '#0e1e38',
        cardStroke: 'rgba(212, 175, 55, 0.35)',
        titleGrad1: '#ffffff',
        titleGrad2: '#f1f5f9',
        subGrad1: '#fbbf24',
        subGrad2: '#d4af37',
      },
      {
        id: 'executive_slate_sapphire',
        bg1: '#0b1320',
        bg2: '#132138',
        bg3: '#080d16',
        accent: '#3b82f6',      // Royal Sapphire
        secondary: '#94a3b8',   // Polished Platinum
        highlight: '#60a5fa',
        cardBg: '#121f33',
        cardStroke: 'rgba(59, 130, 246, 0.35)',
        titleGrad1: '#ffffff',
        titleGrad2: '#e2e8f0',
        subGrad1: '#60a5fa',
        subGrad2: '#38bdf8',
      },
    ],
  },

  // 3. Academic, Research, University, Symposium, Thesis, Science
  academic: {
    archetype: 'academic',
    heroPool: ['hero_academic_lecture.jpg', 'hero_datascience.jpg'],
    badges: ['🎓 ACADEMIC SYMPOSIUM', '🔬 RESEARCH FORUM', '📚 SCHOLARLY COLLOQUIUM', '🏛️ ANNUAL SYMPOSIUM'],
    footer: 'EVENTFLOW ACADEMIC SYMPOSIUM // KNOWLEDGE SUMMIT',
    slogans: ['ADVANCING HUMAN KNOWLEDGE', 'RIGOR, INQUIRY & DISCOVERY', 'THE FRONTIER OF RESEARCH'],
    highlights: ['Peer Review', 'Paper Presentations', 'Keynote Lectures', 'Honor Credential'],
    defaultTagline: 'Inquire | Research | Discover | Publish',
    palettes: [
      {
        id: 'cobalt_sage',
        bg1: '#06151f',
        bg2: '#0b2333',
        bg3: '#040d14',
        accent: '#10b981',      // Sage Emerald
        secondary: '#0ea5e9',   // Cobalt Cyan
        highlight: '#34d399',
        cardBg: '#0c2230',
        cardStroke: 'rgba(16, 185, 129, 0.35)',
        titleGrad1: '#ffffff',
        titleGrad2: '#f0fdf4',
        subGrad1: '#34d399',
        subGrad2: '#38bdf8',
      },
      {
        id: 'scholar_deep_teal',
        bg1: '#08171a',
        bg2: '#0f292e',
        bg3: '#051012',
        accent: '#14b8a6',      // Teal
        secondary: '#f59e0b',   // Warm Amber
        highlight: '#2dd4bf',
        cardBg: '#10272b',
        cardStroke: 'rgba(20, 184, 166, 0.35)',
        titleGrad1: '#ffffff',
        titleGrad2: '#ccfbf1',
        subGrad1: '#2dd4bf',
        subGrad2: '#fbbf24',
      },
    ],
  },

  // 4. Sports, Athletics, Fitness, Championship, Tournament, Marathon
  sports: {
    archetype: 'sports',
    heroPool: ['hero_athletics_stadium.jpg', 'hero_sports.jpg', 'hero_esports_arena.jpg'],
    badges: ['🏆 CHAMPIONSHIP', '⚡ ATHLETIC CUP', '🏅 SPORTS TOURNAMENT', '🏃 ARENA DERBY'],
    footer: 'EVENTFLOW CHAMPIONSHIP SERIES // OFFICIAL ARENA',
    slogans: ['GLORY ON THE FIELD', 'UNLEASH YOUR POWER', 'COMPETE WITH PASSION'],
    highlights: ['Trophy Tournament', 'Live Broadcast', 'Pro Refereeing', 'Medal Ceremony'],
    defaultTagline: 'Train | Compete | Endure | Triumph',
    palettes: [
      {
        id: 'crimson_solar_gold',
        bg1: '#1a0606',
        bg2: '#2b0c0c',
        bg3: '#120404',
        accent: '#ef4444',      // Racing Crimson
        secondary: '#eab308',   // Solar Gold
        highlight: '#facc15',
        cardBg: '#2d0e0e',
        cardStroke: 'rgba(239, 68, 68, 0.4)',
        titleGrad1: '#ffffff',
        titleGrad2: '#fef2f2',
        subGrad1: '#ef4444',
        subGrad2: '#facc15',
      },
      {
        id: 'volt_lime_carbon',
        bg1: '#0c1308',
        bg2: '#15240c',
        bg3: '#070c04',
        accent: '#84cc16',      // Volt Lime
        secondary: '#06b6d4',   // Electric Cyan
        highlight: '#a3e635',
        cardBg: '#16230e',
        cardStroke: 'rgba(132, 204, 22, 0.4)',
        titleGrad1: '#ffffff',
        titleGrad2: '#f7fee7',
        subGrad1: '#a3e635',
        subGrad2: '#22d3ee',
      },
    ],
  },

  // 5. Hackathons, Coding Sprints, Buildathons, DevFests
  hackathon: {
    archetype: 'hackathon',
    heroPool: ['hero_hackathon_team.jpg', 'hero_hackathon.jpg', 'hero_web_dev.jpg'],
    badges: ['⚡ HACKATHON', '💻 CODE SPRINT', '🚀 BUILDAHON', '🛠️ DEV SPRINT'],
    footer: 'EVENTFLOW CODE SPRINT // BUILD THE FUTURE',
    slogans: ['CODE INTO REALITY', 'HACK THE IMPOSSIBLE', 'FROM PROMPT TO PRODUCT'],
    highlights: ['24-Hour Sprint', '$10K Prize Pool', 'Mentor Guidance', 'Investor Pitch'],
    defaultTagline: 'Ideate | Code | Prototype | Deploy',
    palettes: [
      {
        id: 'terminal_matrix_emerald',
        bg1: '#04120a',
        bg2: '#082113',
        bg3: '#020b06',
        accent: '#10b981',      // Matrix Green
        secondary: '#00ff88',   // Neon Mint
        highlight: '#34d399',
        cardBg: '#092113',
        cardStroke: 'rgba(16, 185, 129, 0.4)',
        titleGrad1: '#ffffff',
        titleGrad2: '#ecfdf5',
        subGrad1: '#10b981',
        subGrad2: '#00ff88',
      },
      {
        id: 'cyber_violet_amber',
        bg1: '#0c071a',
        bg2: '#160d2e',
        bg3: '#07040f',
        accent: '#8b5cf6',      // Electric Violet
        secondary: '#f97316',   // Solar Orange
        highlight: '#a78bfa',
        cardBg: '#180f30',
        cardStroke: 'rgba(139, 92, 246, 0.4)',
        titleGrad1: '#ffffff',
        titleGrad2: '#f5f3ff',
        subGrad1: '#a78bfa',
        subGrad2: '#fb923c',
      },
    ],
  },

  // 6. Robotics, Drones, IoT, Actuators, Hardware
  robotics: {
    archetype: 'robotics',
    heroPool: ['clean_robot_hero.png', 'hero_robotics.png'],
    badges: ['🤖 WORKSHOP', '⚙️ ROBOTICS LAB', '🦾 HARDWARE SUMMIT'],
    footer: 'EVENTFLOW HARDWARE LABS // ROBOTICS SPEC-2.0',
    slogans: ['IDEAS INTO REAL ROBOTS', 'ENGINEERING THE PHYSICAL FUTURE'],
    highlights: ['Hands-on Sessions', 'Real-world Projects', 'Expert Guidance', 'Networking'],
    defaultTagline: 'Learn | Build | Innovate | Automate',
    hasGear: true,
    hasCyberBrackets: true,
    palettes: [
      {
        id: 'cyber_cyan_navy',
        bg1: '#050a14',
        bg2: '#0a1426',
        bg3: '#03060d',
        accent: '#00f0ff',      // Cyan Neon
        secondary: '#3b82f6',   // Electric Blue
        highlight: '#38bdf8',
        cardBg: '#0b162b',
        cardStroke: 'rgba(0, 240, 255, 0.35)',
        titleGrad1: '#ffffff',
        titleGrad2: '#e0e7ff',
        subGrad1: '#00f0ff',
        subGrad2: '#38bdf8',
      },
    ],
  },

  // 7. AI, Machine Learning, Deep Learning, Neural, Data Science
  ai_ml: {
    archetype: 'ai_ml',
    heroPool: ['hero_ai_ml.jpg', 'hero_datascience.jpg', 'hero_cybersecurity.jpg'],
    badges: ['🧠 AI SUMMIT', '🌐 NEURAL LAB', '📊 DATA SYMPOSIUM', '⚡ LLM WORKSHOP'],
    footer: 'EVENTFLOW AI LABS // INTELLIGENCE IN ACTION',
    slogans: ['INTELLIGENCE INTO ACTION', 'SYNTHESIZING TOMORROW', 'NEURAL BREAKTHROUGHS'],
    highlights: ['Neural Models', 'GPU Lab Access', 'Industry Keynotes', 'Model Fine-tuning'],
    defaultTagline: 'Train | Architect | Optimize | Deploy',
    palettes: [
      {
        id: 'cosmic_violet_cyan',
        bg1: '#090618',
        bg2: '#130c2e',
        bg3: '#05030e',
        accent: '#8b5cf6',      // Cosmic Violet
        secondary: '#06b6d4',   // Cyan Glow
        highlight: '#c084fc',
        cardBg: '#150d30',
        cardStroke: 'rgba(139, 92, 246, 0.4)',
        titleGrad1: '#ffffff',
        titleGrad2: '#f5f3ff',
        subGrad1: '#c084fc',
        subGrad2: '#06b6d4',
      },
      {
        id: 'deep_indigo_magenta',
        bg1: '#07081a',
        bg2: '#0e1233',
        bg3: '#040510',
        accent: '#d946ef',      // Neon Magenta
        secondary: '#6366f1',   // Deep Indigo
        highlight: '#f472b6',
        cardBg: '#101438',
        cardStroke: 'rgba(217, 70, 239, 0.35)',
        titleGrad1: '#ffffff',
        titleGrad2: '#e0e7ff',
        subGrad1: '#f472b6',
        subGrad2: '#818cf8',
      },
    ],
  },

  // 8. Creative, Design, UI/UX, Studio, Media, Art & Craft
  creative: {
    archetype: 'creative',
    heroPool: ['hero_design_creative.jpg', 'hero_cultural.jpg'],
    badges: ['✨ CREATIVE LAB', '🎨 DESIGN SPRINT', '📐 UI/UX WORKSHOP', '💡 INNOVATION STUDIO'],
    footer: 'EVENTFLOW CREATIVE LABS // DESIGN THE FUTURE',
    slogans: ['DESIGN WITH PURPOSE', 'SHAPING HUMAN EXPERIENCES', 'CRAFT & INTENTION'],
    highlights: ['Design Systems', 'Portfolio Review', 'Creative Studio', 'Mentor Feedback'],
    defaultTagline: 'Ideate | Sketch | Prototype | Polish',
    palettes: [
      {
        id: 'modernist_amber_ink',
        bg1: '#14110e',
        bg2: '#211b15',
        bg3: '#0c0a08',
        accent: '#f59e0b',      // Warm Amber
        secondary: '#ec4899',   // Creative Rose
        highlight: '#fbbf24',
        cardBg: '#241d17',
        cardStroke: 'rgba(245, 158, 11, 0.35)',
        titleGrad1: '#fffbeb',
        titleGrad2: '#fef3c7',
        subGrad1: '#f59e0b',
        subGrad2: '#f43f5e',
      },
      {
        id: 'vibrant_coral_lilac',
        bg1: '#160b18',
        bg2: '#241029',
        bg3: '#0d060f',
        accent: '#fb7185',      // Vibrant Coral
        secondary: '#c084fc',   // Soft Lilac
        highlight: '#fda4af',
        cardBg: '#26122b',
        cardStroke: 'rgba(251, 113, 133, 0.35)',
        titleGrad1: '#ffffff',
        titleGrad2: '#fdf2f8',
        subGrad1: '#fb7185',
        subGrad2: '#c084fc',
      },
    ],
  },
};

/**
 * Intelligent topic archetype detector.
 * Avoids pigeonholing all events into cyber/futuristic.
 */
export const detectTheme = (title = '', category = '', variationOffset = 0) => {
  const t = (title + ' ' + category).toLowerCase();
  const baseHash = hashString(title + category);
  const offset = Math.abs(Number(variationOffset) || 0);
  const hash = baseHash + offset;

  let key = 'corporate'; // Default to clean professional corporate

  if (/cultural|fest|festival|music|concert|dance|art|singing|drama|sitar|symphony|theatre|exhibit|carnival/i.test(t) || category === 'CULTURAL') {
    key = 'cultural';
  } else if (/sport|fitness|tournament|marathon|athletics|cricket|football|basketball|badminton|olympiad|championship|esport|gaming/i.test(t) || category === 'SPORTS') {
    key = 'sports';
  } else if (/hackathon|code sprint|buildathon|devfest|hack|gamejam/i.test(t) || category === 'HACKATHON') {
    key = 'hackathon';
  } else if (/robot|robotics|drone|actuator|arduino|ros|hardware|iot|embedded|quadcopter/i.test(t)) {
    key = 'robotics';
  } else if (/ai|artificial intelligence|machine learning|deep learning|neural|llm|gpt|transformer|data science|analytics|big data/i.test(t)) {
    key = 'ai_ml';
  } else if (/design|ui|ux|creative|figma|typography|sketch|graphic|craft|media/i.test(t)) {
    key = 'creative';
  } else if (/academic|research|colloquium|thesis|symposium|paper|faculty|university|scholar/i.test(t) || category === 'ACADEMIC') {
    key = 'academic';
  } else if (/seminar|conference|webinar|summit|keynote|leadership|business|management|forum/i.test(t) || category === 'SEMINAR' || category === 'CONFERENCE') {
    key = 'corporate';
  } else if (/workshop|lab|tech/i.test(t) || category === 'WORKSHOP' || category === 'TECHNICAL') {
    // If it's a tech workshop, vary between corporate, academic, or ai depending on keywords
    key = /dev|full-stack|fullstack|web|software|cloud|frontend|backend/i.test(t) ? 'hackathon' : 'corporate';
  }

  const archetypeConfig = THEME_ARCHETYPES[key] || THEME_ARCHETYPES.corporate;

  // Select palette variation deterministically from the pool rotated by variationOffset
  const paletteIndex = (hash + offset) % archetypeConfig.palettes.length;
  const palette = archetypeConfig.palettes[paletteIndex];

  // Select hero image deterministically from the pool
  const heroIndex = (hash + offset) % archetypeConfig.heroPool.length;
  const heroFile = archetypeConfig.heroPool[heroIndex];

  // Select badge deterministically
  const badgeIndex = (hash + offset) % archetypeConfig.badges.length;
  const badge = archetypeConfig.badges[badgeIndex];

  // Select slogan
  const sloganIndex = (hash + offset) % archetypeConfig.slogans.length;
  const slogan = archetypeConfig.slogans[sloganIndex];

  return {
    ...archetypeConfig,
    palette,
    heroFile,
    badge,
    slogan,
  };
};

/**
 * Generate decorative background elements based on genre archetype.
 * (Ensures Cultural has stars/bokeh, Sports has speed slashes, Corporate has clean architectural lines,
 * and Cyber brackets ONLY appear on Robotics/Hardware!)
 */
const renderDecorativeAccents = (theme) => {
  const { archetype, palette, hasCyberBrackets } = theme;

  // 1. Robotics only: Cyber Tech Corner Brackets & Reticles
  if (hasCyberBrackets) {
    return `
    <g stroke="${palette.accent}" stroke-width="2.5" fill="none" opacity="0.85">
      <path d="M 24 50 L 24 24 L 50 24" />
      <rect x="22" y="22" width="4" height="4" fill="${palette.accent}" />
      <path d="M 974 24 L 1000 24 L 1000 50" />
      <rect x="998" y="22" width="4" height="4" fill="${palette.accent}" />
      <path d="M 24 336 L 24 362 L 50 362" />
      <rect x="22" y="360" width="4" height="4" fill="${palette.accent}" />
      <path d="M 974 362 L 1000 362 L 1000 336" />
      <rect x="998" y="360" width="4" height="4" fill="${palette.accent}" />
    </g>
    <g fill="${palette.accent}" opacity="0.45">
      <circle cx="56" cy="24" r="1.5" />
      <circle cx="64" cy="24" r="1.5" />
      <circle cx="72" cy="24" r="1.5" />
    </g>`;
  }

  // 2. Cultural / Festive: Soft festive sparkles, glowing orbs, artistic ribbons
  if (archetype === 'cultural') {
    return `
    <!-- Cultural Decorative Sparkles & Bokeh Orbs -->
    <g opacity="0.6">
      <!-- Star 1 -->
      <path d="M 32 30 Q 32 38 40 38 Q 32 38 32 46 Q 32 38 24 38 Q 32 38 32 30 Z" fill="${palette.highlight}" />
      <!-- Star 2 -->
      <path d="M 460 40 Q 460 46 466 46 Q 460 46 460 52 Q 460 46 454 46 Q 460 46 460 40 Z" fill="${palette.accent}" opacity="0.7" />
      <!-- Soft Bokeh Circles -->
      <circle cx="28" cy="356" r="16" fill="${palette.accent}" opacity="0.12" filter="url(#glow)" />
      <circle cx="480" cy="290" r="22" fill="${palette.highlight}" opacity="0.1" filter="url(#glow)" />
      <!-- Festive Wave Line -->
      <path d="M 20 22 Q 260 12 500 22" stroke="${palette.accent}" stroke-width="1.2" stroke-dasharray="4,6" fill="none" opacity="0.4" />
      <path d="M 20 364 Q 260 374 500 364" stroke="${palette.highlight}" stroke-width="1.2" stroke-dasharray="4,6" fill="none" opacity="0.4" />
    </g>`;
  }

  // 3. Corporate / Executive: Sleek minimal architectural lines & polished frame
  if (archetype === 'corporate') {
    return `
    <!-- Executive Minimal Accents -->
    <g opacity="0.5">
      <!-- Top Accent Line with Accent Pip -->
      <line x1="24" y1="24" x2="320" y2="24" stroke="${palette.accent}" stroke-width="1.5" opacity="0.6" />
      <rect x="24" y="22" width="24" height="4" fill="${palette.accent}" />
      <!-- Bottom Clean Baseline -->
      <line x1="24" y1="362" x2="420" y2="362" stroke="${palette.secondary}" stroke-width="1" opacity="0.4" />
      <!-- Subtle Vertical Divider -->
      <line x1="504" y1="30" x2="504" y2="356" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="3,6" />
    </g>`;
  }

  // 4. Academic / Symposium: Refined Scholarly Structure & Compass Marks
  if (archetype === 'academic') {
    return `
    <!-- Academic Formal Markers -->
    <g stroke="${palette.accent}" opacity="0.5" stroke-width="1.2" fill="none">
      <!-- Top-left Academic Crosshair -->
      <line x1="20" y1="28" x2="36" y2="28" />
      <line x1="28" y1="20" x2="28" y2="36" />
      <circle cx="28" cy="28" r="4" />
      <!-- Bottom Framing Rule -->
      <line x1="24" y1="362" x2="380" y2="362" stroke-width="1" />
      <circle cx="388" cy="362" r="2" fill="${palette.accent}" />
    </g>`;
  }

  // 5. Sports / Athletics: Dynamic 45-degree Speed Slashes & Chevrons
  if (archetype === 'sports') {
    return `
    <!-- Dynamic Athletic Speed Chevrons -->
    <g fill="${palette.accent}" opacity="0.7">
      <!-- Angled speed bars at top -->
      <polygon points="24,20 36,20 24,36 12,36" fill="${palette.accent}" />
      <polygon points="38,20 50,20 38,36 26,36" fill="${palette.secondary}" />
      <polygon points="52,20 64,20 52,36 40,36" fill="${palette.accent}" opacity="0.5" />
      <!-- Forward Speed Arrow -->
      <path d="M 460 26 L 472 34 L 460 42" stroke="${palette.accent}" stroke-width="2.5" fill="none" opacity="0.6" stroke-linecap="round" />
      <path d="M 470 26 L 482 34 L 470 42" stroke="${palette.highlight}" stroke-width="2.5" fill="none" opacity="0.8" stroke-linecap="round" />
    </g>`;
  }

  // 6. Hackathon: Terminal Prompt & Monospace Elements
  if (archetype === 'hackathon') {
    return `
    <!-- Terminal Developer Motifs -->
    <g opacity="0.6">
      <text x="24" y="32" font-family="'Courier New', monospace" font-size="13" font-weight="700" fill="${palette.secondary}">&gt;_ CODE_SPRINT</text>
      <!-- Blinking Terminal Cursor Block -->
      <rect x="156" y="21" width="7" height="13" fill="${palette.accent}" opacity="0.8" />
      <!-- Code Bracket Flourish -->
      <text x="470" y="42" font-family="'Courier New', monospace" font-size="20" font-weight="900" fill="${palette.accent}" opacity="0.3">&lt;/&gt;</text>
    </g>`;
  }

  // 7. AI / ML: Neural Network Nodes & Links
  if (archetype === 'ai_ml') {
    return `
    <!-- Neural Network Graph Accents -->
    <g stroke="${palette.accent}" stroke-width="1" opacity="0.4" fill="none">
      <line x1="28" y1="28" x2="56" y2="44" />
      <line x1="56" y1="44" x2="88" y2="26" />
      <circle cx="28" cy="28" r="3" fill="${palette.accent}" />
      <circle cx="56" cy="44" r="3.5" fill="${palette.secondary}" />
      <circle cx="88" cy="26" r="3" fill="${palette.highlight}" />
    </g>`;
  }

  // 8. Creative / Studio: Modernist Geometric Rings & Arches
  return `
  <!-- Creative Studio Accents -->
  <g opacity="0.5">
    <circle cx="34" cy="34" r="12" stroke="${palette.accent}" stroke-width="2" fill="none" />
    <circle cx="44" cy="34" r="6" fill="${palette.secondary}" opacity="0.6" />
  </g>`;
};

/**
 * Generate a complete, domain-authentic composite event banner poster SVG (1024x386).
 *
 * @param {object} eventData
 * @param {string} eventData.title
 * @param {string|Date} eventData.startDate
 * @param {string|Date} [eventData.endDate]
 * @param {string} eventData.venue
 * @param {string} [eventData.category]
 * @param {string} [eventData.tagline]
 * @param {string} [eventData.organiserName]
 * @param {string[]} [eventData.highlights]
 * @returns {string} Complete SVG string
 */
export const generateBannerSvg = (eventData = {}, variationOffset = 0, customHeroBase64 = null) => {
  const theme = detectTheme(eventData.title, eventData.category, variationOffset);
  const { palette } = theme;

  // Date parsing
  const startDt = eventData.startDate ? new Date(eventData.startDate) : new Date();
  const dateFormatted = !Number.isNaN(startDt.getTime())
    ? startDt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()
    : '20 NOV 2026';
  const startTime = !Number.isNaN(startDt.getTime())
    ? startDt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '10:00 AM';

  const endDt = eventData.endDate ? new Date(eventData.endDate) : new Date(startDt.getTime() + 4 * 3600 * 1000);
  const endTime = !Number.isNaN(endDt.getTime())
    ? endDt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '02:00 PM';

  const timeFormatted = `${startTime} - ${endTime}`;
  const venueFormatted = (eventData.venue || 'Innovation Lab, Tech Campus').slice(0, 32);
  const organiserFormatted = (eventData.organiserName || 'EventFlow Verified Host').slice(0, 28);
  const taglineFormatted = eventData.tagline || theme.defaultTagline;

  // Process Title into Line 1 (Topic Focus) and Line 2 (Descriptor / Year)
  let mainTitle1 = 'EventFlow';
  let mainTitle2 = 'Summit 2026';

  if (eventData.title && eventData.title.trim().length > 0) {
    const rawTitle = eventData.title.trim();
    const parts = rawTitle.split(/\s+/);
    if (parts.length === 1) {
      mainTitle1 = parts[0];
      mainTitle2 = theme.archetype === 'cultural' ? 'Celebration 2026' : theme.archetype === 'sports' ? 'Cup 2026' : 'Summit 2026';
    } else if (parts.length === 2) {
      mainTitle1 = parts[0];
      mainTitle2 = parts[1];
    } else {
      // Split into 1-2 words on top, remainder on bottom
      const splitAt = parts.length >= 4 ? 2 : 1;
      mainTitle1 = parts.slice(0, splitAt).join(' ');
      mainTitle2 = parts.slice(splitAt).join(' ');
      if (mainTitle2.length > 28) mainTitle2 = mainTitle2.slice(0, 26) + '..';
    }
  }

  // Format Highlights (Short punchy labels, max 18 chars to prevent any collision)
  const formatPillText = (text, fallback) => {
    if (!text || typeof text !== 'string') return fallback;
    const clean = text.replace(/^[•\-\*\s]+/, '').trim();
    if (clean.length > 18) {
      const words = clean.split(/\s+/);
      if (words.length >= 2 && (words[0] + ' ' + words[1]).length <= 18) {
        return words[0] + ' ' + words[1];
      }
      return clean.slice(0, 16) + '..';
    }
    return clean;
  };

  const rawHighlights = (eventData.highlights && eventData.highlights.length >= 4)
    ? eventData.highlights
    : theme.highlights;

  const highlights = [
    formatPillText(rawHighlights[0], theme.highlights[0]),
    formatPillText(rawHighlights[1], theme.highlights[1]),
    formatPillText(rawHighlights[2], theme.highlights[2]),
    formatPillText(rawHighlights[3], theme.highlights[3]),
  ];

  // Base64 topic hero image (accept custom web-fetched base64 or fall back to theme file)
  const heroBase64 = customHeroBase64 || getAssetBase64(theme.heroFile) || getAssetBase64('hero_seminar_business.jpg');

  // Gear Icon inside title for Robotics only
  const gearSvg = theme.hasGear
    ? `<g transform="translate(242, 92) scale(0.65)">
        <circle cx="16" cy="16" r="6" fill="#030712" stroke="${palette.accent}" stroke-width="2.5" />
        <path d="M16 2 L16 6 M16 26 L16 30 M2 16 L6 16 M26 16 L30 16 M6 6 L9 9 M23 23 L26 26 M6 26 L9 23 M23 9 L26 6" stroke="${palette.accent}" stroke-width="3" stroke-linecap="round" />
      </g>`
    : '';

  // Slogan at Top-Right
  // For robotics with clean_robot_hero.png, the slogan is built into the image
  const shouldRenderSlogan = !(theme.archetype === 'robotics' && theme.heroFile === 'clean_robot_hero.png');
  const sloganSvg = shouldRenderSlogan && theme.slogan
    ? `<g opacity="0.9">
        <text x="980" y="50" text-anchor="end" font-family="'Impact', 'Arial Black', -apple-system, sans-serif" font-weight="900" font-size="18" fill="none" stroke="${palette.accent}" stroke-width="3" letter-spacing="2" opacity="0.3">${escapeXml(theme.slogan)}</text>
        <text x="980" y="50" text-anchor="end" font-family="'Impact', 'Arial Black', -apple-system, sans-serif" font-weight="900" font-size="18" fill="#ffffff" letter-spacing="2" filter="url(#glow)">${escapeXml(theme.slogan)}</text>
      </g>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 386" width="1024" height="386">
  <defs>
    <!-- Background Gradients Tailored to Archetype -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.bg1}" />
      <stop offset="50%" stop-color="${palette.bg2}" />
      <stop offset="100%" stop-color="${palette.bg3}" />
    </linearGradient>

    <!-- Ambient Glow Orbs -->
    <radialGradient id="orbAccent" cx="15%" cy="30%" r="50%">
      <stop offset="0%" stop-color="${palette.accent}" stop-opacity="0.25" />
      <stop offset="60%" stop-color="${palette.secondary}" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <radialGradient id="orbSecondary" cx="75%" cy="85%" r="55%">
      <stop offset="0%" stop-color="${palette.secondary}" stop-opacity="0.22" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0" />
    </radialGradient>

    <!-- Metallic/Bright Title Gradient -->
    <linearGradient id="titleGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${palette.titleGrad1}" />
      <stop offset="100%" stop-color="${palette.titleGrad2}" />
    </linearGradient>

    <!-- Vibrant Subtitle Gradient -->
    <linearGradient id="subGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${palette.subGrad1}" />
      <stop offset="100%" stop-color="${palette.subGrad2}" />
    </linearGradient>

    <!-- Card Fill Gradient -->
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.cardBg}" stop-opacity="0.92" />
      <stop offset="100%" stop-color="${palette.bg1}" stop-opacity="0.96" />
    </linearGradient>

    <!-- Glow Filter -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.8" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Soft Blend Mask for Hero Image on Right Side -->
    <linearGradient id="maskGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0" />
      <stop offset="18%" stop-color="#ffffff" stop-opacity="0.35" />
      <stop offset="35%" stop-color="#ffffff" stop-opacity="0.9" />
      <stop offset="50%" stop-color="#ffffff" stop-opacity="1" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="1" />
    </linearGradient>
    <mask id="heroFadeMask">
      <rect x="490" y="0" width="534" height="386" fill="url(#maskGrad)" />
    </mask>
  </defs>

  <!-- 1. Canvas Base Background -->
  <rect width="1024" height="386" fill="url(#bgGrad)" />
  <circle cx="180" cy="120" r="320" fill="url(#orbAccent)" />
  <circle cx="850" cy="300" r="280" fill="url(#orbSecondary)" />

  <!-- 2. Diverse Hero Artwork on Right Side (Blended) -->
  ${heroBase64 ? `
  <g mask="url(#heroFadeMask)">
    <image href="${heroBase64}" x="510" y="0" width="514" height="386" preserveAspectRatio="xMidYMid slice" />
  </g>
  ` : ''}

  <!-- Top-Right Slogan (when applicable) -->
  ${sloganSvg}

  <!-- 3. Distinct Decorative Accents Matching Domain (NO cyber brackets on non-tech!) -->
  ${renderDecorativeAccents(theme)}

  <!-- 4. Category Badge / Pill (Top Left) -->
  <g transform="translate(42, 36)">
    <rect width="154" height="28" rx="14" fill="${palette.cardBg}" stroke="${palette.accent}" stroke-width="1.2" stroke-opacity="0.6" filter="url(#softGlow)" />
    <circle cx="16" cy="14" r="4" fill="${palette.accent}" filter="url(#glow)" />
    <text x="28" y="19" font-family="'Inter', -apple-system, BlinkMacSystemFont, sans-serif" font-size="11" font-weight="800" fill="#ffffff" letter-spacing="1.2">${escapeXml(theme.badge)}</text>
  </g>

  <!-- 5. Main Title Typography -->
  <!-- Line 1: Primary Title -->
  <g transform="translate(42, 116)">
    <text font-family="'Montserrat', 'Arial Black', -apple-system, sans-serif" font-size="44" font-weight="900" fill="url(#titleGrad)" letter-spacing="1" filter="drop-shadow(0 4px 14px rgba(0,0,0,0.85))">
      ${escapeXml(mainTitle1)}
    </text>
    ${gearSvg}
  </g>

  <!-- Line 2: Vibrant Accent Subtitle -->
  <g transform="translate(42, 164)">
    <text font-family="'Montserrat', 'Arial Black', -apple-system, sans-serif" font-size="38" font-weight="900" fill="url(#subGrad)" letter-spacing="0.5" filter="url(#softGlow)">
      ${escapeXml(mainTitle2)}
    </text>
  </g>

  <!-- 6. Tagline with Divider Bars -->
  <g transform="translate(42, 196)">
    <text font-family="'Inter', -apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600" fill="#94a3b8" letter-spacing="2">
      ${escapeXml(taglineFormatted)}
    </text>
  </g>

  <!-- 7. Three Glassmorphic Metadata Cards -->
  <!-- Card 1: Date & Time -->
  <g transform="translate(42, 216)">
    <rect width="144" height="66" rx="10" fill="url(#cardGrad)" stroke="${palette.cardStroke}" stroke-width="1.2" />
    <rect x="0" y="0" width="144" height="66" rx="10" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
    <!-- Calendar Icon -->
    <g transform="translate(14, 15)" stroke="${palette.accent}" stroke-width="1.8" fill="none">
      <rect x="0" y="2" width="16" height="14" rx="2" />
      <line x1="0" y1="6" x2="16" y2="6" />
      <line x1="4" y1="0" x2="4" y2="3" />
      <line x1="12" y1="0" x2="12" y2="3" />
    </g>
    <text x="38" y="22" font-family="'Inter', sans-serif" font-size="9" font-weight="700" fill="${palette.accent}" letter-spacing="1">DATE &amp; TIME</text>
    <text x="14" y="42" font-family="'Inter', sans-serif" font-size="12" font-weight="800" fill="#ffffff">${escapeXml(dateFormatted)}</text>
    <text x="14" y="56" font-family="'Inter', sans-serif" font-size="9.5" font-weight="500" fill="#94a3b8">${escapeXml(timeFormatted)}</text>
  </g>

  <!-- Card 2: Venue -->
  <g transform="translate(196, 216)">
    <rect width="144" height="66" rx="10" fill="url(#cardGrad)" stroke="${palette.cardStroke}" stroke-width="1.2" />
    <rect x="0" y="0" width="144" height="66" rx="10" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
    <!-- Pin Icon -->
    <g transform="translate(14, 15)" stroke="${palette.accent}" stroke-width="1.8" fill="none">
      <path d="M8 1 C4.5 1 1.5 4 1.5 7.5 C1.5 12 8 18 8 18 C8 18 14.5 12 14.5 7.5 C14.5 4 11.5 1 8 1 Z" />
      <circle cx="8" cy="7.5" r="2.5" fill="${palette.accent}" />
    </g>
    <text x="38" y="22" font-family="'Inter', sans-serif" font-size="9" font-weight="700" fill="${palette.accent}" letter-spacing="1">VENUE</text>
    <text x="14" y="42" font-family="'Inter', sans-serif" font-size="11.5" font-weight="800" fill="#ffffff">${escapeXml(venueFormatted.length > 17 ? venueFormatted.slice(0, 15) + '..' : venueFormatted)}</text>
    <text x="14" y="56" font-family="'Inter', sans-serif" font-size="9" font-weight="500" fill="#94a3b8">Confirmed Space</text>
  </g>

  <!-- Card 3: Organizer -->
  <g transform="translate(350, 216)">
    <rect width="144" height="66" rx="10" fill="url(#cardGrad)" stroke="${palette.cardStroke}" stroke-width="1.2" />
    <rect x="0" y="0" width="144" height="66" rx="10" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1" />
    <!-- Verified Badge Icon -->
    <g transform="translate(14, 15)" stroke="${palette.accent}" stroke-width="1.8" fill="none">
      <path d="M8 1 L15 4 V9 C15 13.5 8 17 8 17 C8 17 1 13.5 1 9 V4 Z" />
      <path d="M5 9 L7 11 L11 7" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <text x="38" y="22" font-family="'Inter', sans-serif" font-size="9" font-weight="700" fill="${palette.accent}" letter-spacing="1">ORGANIZER</text>
    <text x="14" y="42" font-family="'Inter', sans-serif" font-size="11.5" font-weight="800" fill="#ffffff">${escapeXml(organiserFormatted.length > 17 ? organiserFormatted.slice(0, 15) + '..' : organiserFormatted)}</text>
    <text x="14" y="56" font-family="'Inter', sans-serif" font-size="9" font-weight="500" fill="${palette.highlight}">Verified Host</text>
  </g>

  <!-- 8. Four Highlight Pills (Clean Fixed Widths, No Text Overlap) -->
  <g transform="translate(42, 302)">
    <!-- Pill 1 -->
    <g transform="translate(0, 0)">
      <rect width="110" height="26" rx="13" fill="${palette.cardBg}" stroke="${palette.cardStroke}" stroke-width="1" />
      <circle cx="11" cy="13" r="3.5" fill="${palette.accent}" />
      <text x="21" y="17" font-family="'Inter', sans-serif" font-size="9.5" font-weight="600" fill="#f1f5f9">${escapeXml(highlights[0])}</text>
    </g>

    <!-- Pill 2 -->
    <g transform="translate(118, 0)">
      <rect width="114" height="26" rx="13" fill="${palette.cardBg}" stroke="${palette.cardStroke}" stroke-width="1" />
      <circle cx="11" cy="13" r="3.5" fill="${palette.accent}" />
      <text x="21" y="17" font-family="'Inter', sans-serif" font-size="9.5" font-weight="600" fill="#f1f5f9">${escapeXml(highlights[1])}</text>
    </g>

    <!-- Pill 3 -->
    <g transform="translate(240, 0)">
      <rect width="108" height="26" rx="13" fill="${palette.cardBg}" stroke="${palette.cardStroke}" stroke-width="1" />
      <circle cx="11" cy="13" r="3.5" fill="${palette.accent}" />
      <text x="21" y="17" font-family="'Inter', sans-serif" font-size="9.5" font-weight="600" fill="#f1f5f9">${escapeXml(highlights[2])}</text>
    </g>

    <!-- Pill 4 -->
    <g transform="translate(356, 0)">
      <rect width="138" height="26" rx="13" fill="${palette.cardBg}" stroke="${palette.cardStroke}" stroke-width="1" />
      <circle cx="11" cy="13" r="3.5" fill="${palette.accent}" />
      <text x="21" y="17" font-family="'Inter', sans-serif" font-size="9.5" font-weight="600" fill="#f1f5f9">${escapeXml(highlights[3])}</text>
    </g>
  </g>

  <!-- 9. Genre-Specific Authentic Footer (NO cyber text on cultural or corporate!) -->
  <g opacity="0.6">
    <text x="44" y="356" font-family="'Courier New', monospace" font-size="9" fill="${palette.secondary}" letter-spacing="1.5">${escapeXml(theme.footer)}</text>
    <rect x="440" y="350" width="36" height="3" fill="${palette.accent}" opacity="0.5" />
    <rect x="482" y="350" width="10" height="3" fill="${palette.secondary}" opacity="0.5" />
  </g>
</svg>`;
};

/**
 * Generate and save banner SVG to public/banners directory.
 * Returns public URL for storage and frontend rendering.
 *
 * @param {object} eventData
 * @param {string} [baseUrl='http://localhost:5000']
 * @param {number} [variationOffset=0]
 * @param {string|null} [customHeroBase64=null]
 * @returns {string} Public URL of the banner SVG
 */
export const generateAndSaveBanner = (
  eventData = {},
  baseUrl = 'http://localhost:5000',
  variationOffset = 0,
  customHeroBase64 = null
) => {
  const svgContent = generateBannerSvg(eventData, variationOffset, customHeroBase64);
  const slug = (eventData.title || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30);
  const offset = Math.abs(Number(variationOffset) || 0);
  const rand = Math.random().toString(36).slice(2, 7);
  const filename = `banner_${Date.now()}_${rand}_${slug}_v${offset}.svg`;
  const filePath = path.join(BANNERS_DIR, filename);

  fs.writeFileSync(filePath, svgContent, 'utf8');

  const cleanBase = baseUrl.replace(/\/+$/, '');
  return `${cleanBase}/banners/${filename}`;
};

/**
 * Extract variation index from a banner URL if present (e.g., banner_123_slug_v3.svg -> 3)
 */
export const parseVariationFromUrl = (url = '') => {
  const match = String(url).match(/_v(\d+)\.svg/i);
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Asynchronously fetch fresh web imagery matching the event topic and create
 * a newly synthesized Format 2 vector poster banner SVG embedding the web photo.
 * Also generates alternative web-powered banners for the picker strip.
 *
 * @param {object} eventData
 * @param {string} [baseUrl='http://localhost:5000']
 * @param {number} [variationOffset=0]
 * @param {string} [existingBannerUrl=null]
 * @returns {Promise<object>} Complete banner object with { url, alt, topic, source, isAiGenerated, alternatives }
 */
export const generateFreshWebBanner = async (
  eventData = {},
  baseUrl = 'http://localhost:5000',
  variationOffset = 0,
  existingBannerUrl = null
) => {
  // If an existing banner was provided, advance past its variation offset so we never repeat
  let offset = Math.abs(Number(variationOffset) || 0);
  if (existingBannerUrl) {
    const prevVar = parseVariationFromUrl(existingBannerUrl);
    if (prevVar !== null && prevVar >= offset) {
      offset = prevVar + 1;
    }
  }

  const theme = detectTheme(eventData.title, eventData.category, offset);
  const archetypeKey = theme.archetype || 'corporate';

  // 1. Search fresh web images live from Wikipedia / Wikimedia Commons and curated web pools
  let webImages = [];
  try {
    webImages = await searchWebImages(eventData.title || '', archetypeKey);
  } catch (err) {
    webImages = [];
  }

  if (!webImages || webImages.length === 0) {
    webImages = [
      'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&h=600&q=80',
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&h=600&q=80',
      'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=800&h=600&q=80',
    ];
  }

  // 2. Select chosen candidate based on offset
  let selectedIdx = offset % webImages.length;
  let chosenUrl = webImages[selectedIdx];
  let customHeroBase64 = await fetchImageAsBase64(chosenUrl);

  // If first choice failed to download, cycle to next available web candidate
  let attempt = 0;
  while (!customHeroBase64 && attempt < Math.min(4, webImages.length)) {
    selectedIdx = (selectedIdx + 1) % webImages.length;
    chosenUrl = webImages[selectedIdx];
    customHeroBase64 = await fetchImageAsBase64(chosenUrl);
    attempt++;
  }

  // 3. Generate primary banner SVG with the fresh web image
  const primaryBannerUrl = generateAndSaveBanner(
    eventData,
    baseUrl,
    offset,
    customHeroBase64
  );

  // 4. Generate 3 distinct alternative web-powered banners
  const alternatives = [];
  const altCount = Math.min(3, Math.max(1, webImages.length - 1));
  for (let i = 1; i <= altCount; i++) {
    const altIdx = (selectedIdx + i) % webImages.length;
    const altWebUrl = webImages[altIdx];
    let altBase64 = await fetchImageAsBase64(altWebUrl);

    // Save each alternative SVG with its own rotated offset and hero photo
    const altBannerUrl = generateAndSaveBanner(
      eventData,
      baseUrl,
      offset + i,
      altBase64
    );

    alternatives.push({
      url: altBannerUrl,
      alt: `${eventData.title || 'Event'} - Web Option ${i}`,
      topic: `${theme.badge} • Option #${i + 1}`,
      webSource: altWebUrl,
    });
  }

  return {
    url: primaryBannerUrl,
    alt: `${eventData.title || 'Event'} - Format 2 Official Poster Banner`,
    topic: theme.badge,
    source: 'EventFlow Web-Augmented Poster Engine',
    isAiGenerated: true,
    webSourceUrl: chosenUrl,
    variationOffset: offset,
    note: 'Freshly generated poster with dynamic web photography and genre-authentic styling.',
    alternatives,
  };
};
