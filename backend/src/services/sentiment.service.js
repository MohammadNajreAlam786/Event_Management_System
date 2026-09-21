import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Feedback sentiment analysis client (Phase 9).
 *
 * Calls the FastAPI AI service (POST /sentiment/analyze, VADER engine) server
 * to server — the browser never talks to it. Only the comment text is sent: no
 * user record, event data, ids or tokens.
 *
 * This function NEVER throws. A participant's feedback submission must not fail
 * because the AI service is slow or down (§28/§65). On any problem it resolves
 * to `{ status: 'FAILED', sentiment: null, score: null, model: '' }` and the
 * caller stores the feedback anyway; the organiser view shows "analysis
 * unavailable" for that row.
 */

const clamp01 = (n) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.min(1, Math.max(0, v));
};

const FAILED = Object.freeze({ status: 'FAILED', sentiment: null, score: null, compound: null, model: '' });
const SKIPPED = Object.freeze({ status: 'SKIPPED', sentiment: null, score: null, compound: null, model: '' });

const VALID = new Set(['POSITIVE', 'NEUTRAL', 'NEGATIVE']);

/**
 * @param {string} comment
 * @returns {Promise<{status:'ANALYZED'|'FAILED'|'SKIPPED', sentiment:string|null, score:number|null, compound:number|null, model:string}>}
 */
export const analyzeComment = async (comment) => {
  const text = typeof comment === 'string' ? comment.trim() : '';
  if (!text) return { ...SKIPPED };

  let res;
  try {
    res = await fetch(`${env.ai.serviceUrl}/sentiment/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(env.ai.timeoutMs),
    });
  } catch (err) {
    logger.warn(`sentiment analysis call failed: ${err.name || 'Error'} ${err.message}`);
    return { ...FAILED };
  }

  if (!res.ok) {
    logger.warn(`sentiment analysis responded ${res.status}`);
    return { ...FAILED };
  }

  let body;
  try {
    body = await res.json();
  } catch {
    logger.warn('sentiment analysis returned a non-JSON body');
    return { ...FAILED };
  }

  if (!body || !VALID.has(body.sentiment)) {
    logger.warn('sentiment analysis returned an unexpected shape');
    return { ...FAILED };
  }

  return {
    status: 'ANALYZED',
    sentiment: body.sentiment,
    score: clamp01(body.score),
    compound: Number.isFinite(Number(body.compound)) ? Number(body.compound) : null,
    model: typeof body.model === 'string' ? body.model : 'vader',
  };
};
