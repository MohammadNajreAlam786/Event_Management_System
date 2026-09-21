import mongoose from 'mongoose';

import { logger } from '../utils/logger.js';

/**
 * Establish the MongoDB connection via Mongoose.
 *
 * Rejects (rather than exiting) so the caller in server.js can decide how to
 * handle a failed connection. The server is only started after this resolves.
 *
 * @param {string} uri - MongoDB connection string.
 * @returns {Promise<import('mongoose').Connection>}
 */
export const connectDatabase = async (uri) => {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Add it to backend/.env (see backend/.env.example).');
  }

  mongoose.connection.on('error', (err) => logger.error('MongoDB connection error:', err.message));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB connection lost'));

  // Fail fast instead of buffering queries indefinitely when the server is down.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  logger.info(
    `MongoDB connected: database "${mongoose.connection.name}" on ${mongoose.connection.host}:${mongoose.connection.port}`,
  );

  return mongoose.connection;
};

/**
 * Close the MongoDB connection cleanly (used on graceful shutdown).
 */
export const disconnectDatabase = async () => {
  await mongoose.connection.close();
};
