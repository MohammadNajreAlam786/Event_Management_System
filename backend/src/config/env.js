/**
 * Centralised environment configuration.
 *
 * Values are read from process.env (populated from backend/.env by dotenv).
 * Safe, non-secret localhost defaults are provided for connection strings so
 * the project runs out of the box in development. Real secrets (JWT signing
 * key, admin password) have NO default and must be supplied via backend/.env.
 */
export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/event_management_system',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',

  // JSON Web Token settings. `secret` must come from the environment.
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },

  // Name of the HTTP-only cookie that carries the JWT.
  authCookieName: process.env.AUTH_COOKIE_NAME || 'em_token',

  // QR attendance credential signing (Phase 7). If unset, a stable key is
  // derived from JWT_SECRET at runtime so the feature works out of the box;
  // set QR_TOKEN_SECRET to rotate/separate it. Never logged, never sent to a
  // client, never placed in a QR code.
  qr: {
    secret: process.env.QR_TOKEN_SECRET || '',
  },

  // FastAPI AI service (Phase 5). The backend is the only caller — the browser
  // never talks to it directly. No secrets/credentials are sent to it.
  ai: {
    serviceUrl: (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').replace(/\/+$/, ''),
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 20000,
  },

  // Initial admin account, consumed only by src/utils/seedAdmin.js.
  admin: {
    name: process.env.ADMIN_NAME || 'System Administrator',
    email: process.env.ADMIN_EMAIL || '',
    password: process.env.ADMIN_PASSWORD || '',
  },
};

export const isProduction = env.nodeEnv === 'production';

/**
 * Fail fast on missing required secrets so misconfiguration surfaces at
 * startup with a clear message rather than as a runtime auth failure.
 *
 * @param {{ requireAdmin?: boolean }} [options]
 */
export const assertRequiredEnv = ({ requireAdmin = false } = {}) => {
  const missing = [];

  if (!env.jwt.secret) missing.push('JWT_SECRET');
  if (requireAdmin && !env.admin.email) missing.push('ADMIN_EMAIL');
  if (requireAdmin && !env.admin.password) missing.push('ADMIN_PASSWORD');

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'See backend/.env.example and create backend/.env.',
    );
  }
};
