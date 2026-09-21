import 'dotenv/config';

import app from './app.js';
import { env, assertRequiredEnv } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { logger } from './utils/logger.js';
import { startEventStatusScheduler, stopEventStatusScheduler } from './services/eventStatusTransition.service.js';

/**
 * Boot sequence:
 *   1. Environment variables are loaded (import 'dotenv/config' above).
 *   2. Required secrets are asserted (JWT_SECRET).
 *   3. Connect to MongoDB.
 *   4. Start the HTTP server only after the database is reachable.
 */
const start = async () => {
  try {
    assertRequiredEnv();

    await connectDatabase(env.mongoUri);

    // Only start the periodic status sync once the DB connection is
    // confirmed up — the scheduler's own guard prevents a duplicate timer if
    // this line is ever reached twice in the same process.
    startEventStatusScheduler();

    const server = app.listen(env.port, () => {
      logger.info(`Backend API listening on http://localhost:${env.port}`);
      logger.info(`Health check:  http://localhost:${env.port}/api/health`);
      logger.info(`Auth API:      http://localhost:${env.port}/api/auth`);
      logger.info(`Environment:   ${env.nodeEnv}`);
    });

    const shutdown = async (signal) => {
      logger.warn(`${signal} received. Shutting down gracefully...`);
      stopEventStatusScheduler();
      server.close(async () => {
        await disconnectDatabase();
        logger.info('Shutdown complete.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    logger.error('Failed to start backend server.');
    logger.error(error.message);
    logger.error(
      'Is MongoDB running? Check MONGODB_URI in backend/.env and that the MongoDB service is started.',
    );
    process.exit(1);
  }
};

start();
