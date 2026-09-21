import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import { env, isProduction } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

/**
 * Build and configure the Express application.
 * Kept separate from server.js so the app can be imported for testing
 * without opening a network port.
 */
const app = express();

// Security headers.
app.use(helmet());

// Cross-origin access for the Vite frontend. `credentials` is required so the
// browser sends/stores the HTTP-only auth cookie; the origin is pinned (no wildcard).
app.use(cors({ origin: env.clientUrl, credentials: true }));

// Body + cookie parsing.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP request logging.
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Service metadata at the root.
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'AI-Powered Event Planning & Management System — API',
    docs: '/api/health',
  });
});

// Feature routes.
app.use('/api', apiRoutes);

// Fallbacks.
app.use(notFound);
app.use(errorHandler);

export default app;
