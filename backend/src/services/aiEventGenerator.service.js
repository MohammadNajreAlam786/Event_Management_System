import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../utils/apiError.js';
import { EVENT_CATEGORIES, EVENT_REGISTRATION_TYPES } from '../models/event.model.js';
import { generateAndSaveBanner, generateFreshWebBanner, parseVariationFromUrl } from './bannerGenerator.service.js';

/**
 * Curated 16:9 landscape banners mapped by domain.
 * Used for direct high-availability fallback if the Python AI service is restarting.
 */
const BACKUP_TOPIC_BANNERS = {
  robotics: [
    {
      url: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=1600&h=900&q=80',
      alt: 'Advanced robotics prototype and futuristic engineering hardware',
      topic: 'Robotics & Autonomous Systems',
    },
    {
      url: 'https://images.unsplash.com/photo-1561557944-6e7860d1a7eb?auto=format&fit=crop&w=1600&h=900&q=80',
      alt: 'Robotic arm automation and microcontroller circuit board',
      topic: 'Industrial Robotics & Hardware',
    },
    {
      url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1600&h=900&q=80',
      alt: 'Robotics engineer inspecting mechanical actuators and sensors',
      topic: 'Robotics Engineering Lab',
    },
  ],
  ai_ml: [
    {
      url: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=1600&h=900&q=80',
      alt: 'Generative AI neural network compute visualization',
      topic: 'AI, Machine Learning & Neural Models',
    },
    {
      url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&h=900&q=80',
      alt: 'Deep learning mathematical tensors and neural abstraction',
      topic: 'Machine Learning Architecture & Deep Learning',
    },
  ],
  hackathon: [
    {
      url: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&h=900&q=80',
      alt: 'Hackathon team collaborating intensively on innovative software',
      topic: 'Hackathon Sprint & Team Innovation',
    },
    {
      url: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1600&h=900&q=80',
      alt: 'High-energy tech workshop and collaborative sprint session',
      topic: 'Rapid Prototyping & Sprint',
    },
  ],
  web_dev: [
    {
      url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&h=900&q=80',
      alt: 'Modern web developer programming on laptop workstation',
      topic: 'Full-Stack Web Development',
    },
    {
      url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1600&h=900&q=80',
      alt: 'Clean software code editor with TypeScript and React syntax',
      topic: 'Software Engineering & Frontend',
    },
  ],
  general: [
    {
      url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1600&h=900&q=80',
      alt: 'Large auditorium conference with attendees and illuminated stage',
      topic: 'Professional Conference & Gathering',
    },
    {
      url: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=1600&h=900&q=80',
      alt: 'Engaging seminar presentation and professional development',
      topic: 'Executive Seminar & Keynote',
    },
  ],
};

const detectLocalTopic = (title = '') => {
  const t = title.toLowerCase();
  if (/robot|robotics|drone|autonomous|actuator|arduino|ros/i.test(t)) return 'robotics';
  if (/ai|artificial intelligence|machine learning|deep learning|neural|llm|gpt/i.test(t)) return 'ai_ml';
  if (/hackathon|code sprint|buildathon/i.test(t)) return 'hackathon';
  if (/web|react|frontend|backend|full-stack|fullstack|javascript|node/i.test(t)) return 'web_dev';
  return 'general';
};

const bannerVariationTracker = new Map();
const getNextVariation = (title = '', existingBanner = '') => {
  const normTitle = (title || '').trim().toLowerCase();
  let current = bannerVariationTracker.get(normTitle) || 0;
  if (existingBanner) {
    const fromUrl = parseVariationFromUrl(existingBanner);
    if (fromUrl !== null && fromUrl >= current) {
      current = fromUrl;
    }
  }
  const next = current + 1;
  bannerVariationTracker.set(normTitle, next);
  return next;
};

const buildLocalFallback = async (payload) => {
  const title = (payload.title || '').trim();
  const venue = (payload.venue || '').trim();
  const start = new Date(payload.startDate || Date.now());
  const topic = detectLocalTopic(title);

  const durationHours = topic === 'hackathon' ? 24 : topic === 'robotics' ? 4 : 3;
  const end = new Date(start.getTime() + durationHours * 3600 * 1000);
  const regEnd = new Date(start.getTime() - 24 * 3600 * 1000);

  const category =
    payload.category ||
    (topic === 'hackathon'
      ? EVENT_CATEGORIES.HACKATHON
      : topic === 'robotics'
        ? EVENT_CATEGORIES.WORKSHOP
        : EVENT_CATEGORIES.CONFERENCE);

  const description =
    payload.existingDescription && payload.mode === 'banner'
      ? payload.existingDescription
      : `${title}\n\n` +
      `📅 Date & Time: ${start.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}\n` +
      `📍 Venue: ${venue}\n\n` +
      `Overview\n` +
      `Join us for an immersive, topic-focused experience exploring ${title}. ` +
      `This event brings together enthusiasts, professionals, and learners for hands-on sessions, peer collaboration, and actionable insights.\n\n` +
      `Key Objectives:\n` +
      `• Gain practical knowledge and modern best practices in ${title}.\n` +
      `• Engage with peers and industry experts in collaborative sessions.\n` +
      `• Explore cutting-edge tools, case studies, and real-world implementations.\n\n` +
      `Agenda Breakdown:\n` +
      `• 09:30 AM — Registration & Welcome Refreshments\n` +
      `• 10:15 AM — Core Presentation & Framework Architecture\n` +
      `• 12:00 PM — Interactive Workshop & Hands-On Problem Solving\n` +
      `• 01:30 PM — Project Demonstration, Q&A & Wrap-Up\n\n` +
      `Preparation & Requirements:\n` +
      `• Laptop with charger and preferred development/note-taking tools.\n` +
      `• E-pass issued upon confirmed registration.`;

  const banner = await generateFreshWebBanner(
    {
      title,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      venue,
      category,
      tagline: `Master core principles, practical implementation, and real-world applications in ${title}.`,
      highlights: [
        'Hands-on Sessions',
        'Real-world Projects',
        'Expert Guidance',
        'Networking Opportunities',
      ],
    },
    `http://localhost:${env.port || 5000}`,
    0,
    payload.existingBanner
  );

  return {
    title,
    venue,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    category,
    tagline: `Master core principles, practical implementation, and real-world applications in ${title}.`,
    description,
    objectives: [
      `Gain practical knowledge and modern best practices in ${title}.`,
      'Engage with peers and industry experts in collaborative sessions.',
      'Explore cutting-edge tools, case studies, and real-world implementations.',
    ],
    highlights: [
      'Comprehensive hands-on exercises with immediate peer feedback.',
      'Interactive Q&A with experienced domain mentors.',
      'Networking session and digital participation credentials.',
    ],
    intendedAudience: 'Students, engineers, domain practitioners, and technology enthusiasts.',
    agenda: [
      { time: '09:30 AM', title: 'Registration & Welcome', description: 'Badge collection and informal networking.' },
      { time: '10:15 AM', title: 'Core Architecture', description: 'Comprehensive domain overview and foundation.' },
      { time: '12:00 PM', title: 'Hands-On Lab', description: 'Practical implementation and calibration.' },
      { time: '01:30 PM', title: 'Showcase & Wrap-Up', description: 'Demonstration and closing discussion.' },
    ],
    durationHours,
    requirements: ['Laptop with charger and administrative access.', 'Enthusiasm to learn and collaborate.'],
    suggestedCapacity: topic === 'hackathon' ? 120 : topic === 'robotics' ? 40 : 60,
    registrationType: topic === 'hackathon' ? EVENT_REGISTRATION_TYPES.TEAM : EVENT_REGISTRATION_TYPES.INDIVIDUAL,
    maxTeamSize: topic === 'hackathon' ? 4 : null,
    registrationStartDate: new Date().toISOString(),
    registrationEndDate: (regEnd > new Date() ? regEnd : start).toISOString(),
    keywords: [title, category, 'EventFlow', 'Technology'],
    banner,
    method: 'format-2-web-vector-synthesizer',
    engine: 'eventflow-web-image-generator',
    generatedAt: new Date().toISOString(),
  };
};

/**
 * Generate a complete, topic-tailored event draft from initial inputs.
 *
 * @param {{
 *   title: string,
 *   startDate: string,
 *   venue: string,
 *   mode?: 'full' | 'description' | 'banner',
 *   category?: string,
 *   existingDescription?: string,
 *   existingBanner?: string
 * }} payload
 */
export const generateEventDraft = async (payload) => {
  const { title, startDate, venue } = payload;

  if (!title || typeof title !== 'string' || title.trim().length < 3) {
    throw ApiError.badRequest('Event title is required and must be at least 3 characters.');
  }
  if (!startDate) {
    throw ApiError.badRequest('Event start date is required.');
  }
  const startDt = new Date(startDate);
  if (Number.isNaN(startDt.getTime())) {
    throw ApiError.badRequest('Event start date is not a valid date.');
  }
  if (!venue || typeof venue !== 'string' || venue.trim().length === 0) {
    throw ApiError.badRequest('Venue is required.');
  }

  // 1. Instant banner regeneration handler:
  // When organiser clicks "Regenerate Banner", generate a fresh web-sourced banner immediately
  // without losing their existing description, objectives, agenda, or inputs!
  if (payload.mode === 'banner') {
    const variationOffset = getNextVariation(title, payload.existingBanner);
    const banner = await generateFreshWebBanner(
      {
        title: title.trim(),
        startDate: startDt.toISOString(),
        venue: venue.trim(),
        category: payload.category,
      },
      `http://localhost:${env.port || 5000}`,
      variationOffset,
      payload.existingBanner
    );

    return {
      title: title.trim(),
      venue: venue.trim(),
      startDate: startDt.toISOString(),
      category: payload.category,
      description: payload.existingDescription || '',
      banner,
      mode: 'banner',
    };
  }

  // Attempt FastAPI AI Service first
  try {
    const res = await fetch(`${env.ai.serviceUrl}/generate-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        startDate: startDt.toISOString(),
        venue: venue.trim(),
        mode: payload.mode || 'full',
        category: payload.category || undefined,
        existingDescription: payload.existingDescription || undefined,
        existingBanner: payload.existingBanner || undefined,
      }),
      signal: AbortSignal.timeout(env.ai.timeoutMs),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.description) {
        // Enforce source of truth: never let title, venue, startDate be mutated
        data.title = title.trim();
        data.venue = venue.trim();
        data.startDate = startDt.toISOString();

        // Ensure Format 2 web poster banner is used
        const freshBanner = await generateFreshWebBanner(
          {
            title: data.title,
            startDate: data.startDate,
            endDate: data.endDate,
            venue: data.venue,
            category: data.category,
            tagline: data.tagline,
            highlights: data.highlights,
          },
          `http://localhost:${env.port || 5000}`,
          0,
          payload.existingBanner
        );

        data.banner = freshBanner;
        return data;
      }
    }
    logger.warn(`AI service returned non-OK or malformed response: ${res.status}`);
  } catch (err) {
    logger.warn(`AI service call failed during event generation: ${err.name} ${err.message}. Using high-availability fallback.`);
  }

  // Graceful, topic-tailored fallback
  return await buildLocalFallback(payload);
};
