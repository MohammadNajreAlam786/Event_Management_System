/**
 * Wrap an async route handler so any rejected promise is forwarded to the
 * Express error handler instead of crashing the process.
 *
 * @param {Function} fn - async (req, res, next) => ...
 * @returns {import('express').RequestHandler}
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
