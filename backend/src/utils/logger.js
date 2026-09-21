/**
 * Minimal timestamped logger used for application-level messages
 * (startup, database, fatal errors). HTTP request logging is handled
 * separately by morgan.
 */
const stamp = () => new Date().toISOString();

export const logger = {
  info: (...args) => console.log(`[${stamp()}] [INFO]`, ...args),
  warn: (...args) => console.warn(`[${stamp()}] [WARN]`, ...args),
  error: (...args) => console.error(`[${stamp()}] [ERROR]`, ...args),
};
