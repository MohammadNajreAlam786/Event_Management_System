import mongoose from 'mongoose';

const CONNECTION_STATES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/**
 * GET /api/health
 * Lightweight readiness probe used to verify the backend and its
 * MongoDB connection are up.
 */
export const getHealth = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Backend is running',
    service: 'event-management-backend',
    database: CONNECTION_STATES[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString(),
  });
};
