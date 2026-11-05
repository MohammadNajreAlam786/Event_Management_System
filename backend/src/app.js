import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import path from 'path';
import { fileURLToPath } from 'url';

import { env, isProduction } from './config/env.js';
import apiRoutes from './routes/index.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Build and configure the Express application.
 * Kept separate from server.js so the app can be imported for testing
 * without opening a network port.
 */
const app = express();

// Security headers with cross-origin resource policy enabled for static banners
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Cross-origin access for the Vite frontend. Supports comma-separated origins.
// `credentials` is required so the browser sends/stores the HTTP-only auth cookie.
const allowedOrigins = env.clientUrl.includes(',')
  ? env.clientUrl.split(',').map((origin) => origin.trim()).filter(Boolean)
  : env.clientUrl;
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Serve static banners and assets
app.use('/banners', express.static(path.join(__dirname, '../public/banners')));
app.use('/assets', express.static(path.join(__dirname, '../public/assets')));

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
