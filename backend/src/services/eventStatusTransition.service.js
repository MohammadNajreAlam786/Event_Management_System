import Event, { EVENT_STATUSES } from '../models/event.model.js';
import { logger } from '../utils/logger.js';

/**
 * Automatic event status transitions (Phase 13).
 *
 * Only events already "published" (UPCOMING / ONGOING / COMPLETED) are ever
 * touched — DRAFT and PLANNED are never auto-published, and CANCELLED is
 * never revisited. Soft-deleted events are ignored entirely.
 *
 * Date rule (inclusive on both ends of the event window):
 *   now <  startDate            -> UPCOMING
 *   startDate <= now <= endDate -> ONGOING
 *   now >  endDate              -> COMPLETED
 *
 * Implemented as three targeted `updateMany` calls (one per destination
 * status) rather than a per-document loop, so the cost stays constant
 * regardless of collection size, and each call is scoped with
 * `status: { $ne: target }` so an already-correct document is never
 * rewritten (no unnecessary writes). All three conditions are mutually
 * exclusive and exhaustive, so call order does not matter and the whole
 * operation is safe to run repeatedly (idempotent).
 */

const AUTO_MANAGED_STATUSES = [EVENT_STATUSES.UPCOMING, EVENT_STATUSES.ONGOING, EVENT_STATUSES.COMPLETED];
const NOT_DELETED = { isDeleted: { $ne: true } };

const TARGETS = [
  { status: EVENT_STATUSES.COMPLETED, match: (now) => ({ endDate: { $lt: now } }) },
  { status: EVENT_STATUSES.ONGOING, match: (now) => ({ startDate: { $lte: now }, endDate: { $gte: now } }) },
  { status: EVENT_STATUSES.UPCOMING, match: (now) => ({ startDate: { $gt: now } }) },
];

/**
 * Recompute status for every eligible (published, non-deleted) event whose
 * stored status no longer matches its dates. Cheap, safe to call from
 * request paths as well as the scheduler.
 *
 * @returns {Promise<{ changed: number, ranAt: Date }>}
 */
export const syncEventStatuses = async ({ now = new Date() } = {}) => {
  let changed = 0;

  for (const { status, match } of TARGETS) {
    // eslint-disable-next-line no-await-in-loop
    const result = await Event.updateMany(
      {
        ...NOT_DELETED,
        status: { $in: AUTO_MANAGED_STATUSES, $ne: status },
        ...match(now),
      },
      { $set: { status } },
    );
    changed += result.modifiedCount ?? 0;
  }

  return { changed, ranAt: now };
};

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes — frequent enough for same-day transitions.
let intervalHandle = null;

/**
 * Start the periodic background sync. Guarded so a second call (e.g. an
 * accidental double-import) never creates a second timer. Each tick catches
 * and logs its own errors — a transient DB hiccup never crashes the process
 * or stops future ticks.
 */
export const startEventStatusScheduler = () => {
  if (intervalHandle) return;

  intervalHandle = setInterval(() => {
    syncEventStatuses()
      .then(({ changed }) => {
        if (changed > 0) logger.info(`Event status sync: ${changed} event(s) updated.`);
      })
      .catch((error) => {
        logger.error('Event status sync failed:', error.message);
      });
  }, SYNC_INTERVAL_MS);

  // Let the process exit naturally (e.g. in tests) without this timer
  // holding the event loop open.
  intervalHandle.unref?.();
};

/** Test/shutdown hook — stops the interval, if running. */
export const stopEventStatusScheduler = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};
