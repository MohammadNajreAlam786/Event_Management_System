import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import { isProduction } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Translate a thrown error into a safe JSON response.
 *
 * Recognises:
 *  - ApiError                         -> its own statusCode / message
 *  - Mongoose ValidationError         -> 400 + field errors
 *  - Mongoose duplicate key (E11000)  -> 409
 *  - JWT errors                       -> 401
 *  - anything else                    -> 500 (message hidden in production)
 */
const normaliseError = (err) => {
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.fromEntries(
      Object.values(err.errors).map((e) => [e.path, e.message]),
    );
    return { statusCode: 400, message: 'Please correct the highlighted fields.', errors };
  }

  if (err instanceof mongoose.Error.CastError) {
    return { statusCode: 400, message: `Invalid ${err.path || 'identifier'}.` };
  }

  if (err && err.code === 11000) {
    const field = Object.keys(err.keyValue ?? { field: null })[0];
    const message =
      field === 'email'
        ? 'An account with this email already exists.'
        : 'That record already exists.';
    return { statusCode: 409, message };
  }

  if (err instanceof jwt.TokenExpiredError) {
    return { statusCode: 401, message: 'Your session has expired. Please log in again.' };
  }
  if (err instanceof jwt.JsonWebTokenError) {
    return { statusCode: 401, message: 'Invalid authentication token. Please log in again.' };
  }

  const statusCode = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  const message =
    statusCode === 500 && isProduction ? 'Internal Server Error' : err.message || 'Internal Server Error';
  return { statusCode, message, errors: err.errors };
};

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity (4 args).
export const errorHandler = (err, req, res, next) => {
  const { statusCode, message, errors } = normaliseError(err);

  const logLine = `${req.method} ${req.originalUrl} -> ${statusCode}: ${err.message}`;
  if (statusCode >= 500) logger.error(logLine, err.stack || '');
  else logger.warn(logLine);

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
    // Only attach a stack for genuinely unexpected 5xx errors in development.
    // Operational errors (ApiError — e.g. an upstream service being down) are
    // expected and must not leak internals.
    ...(isProduction || statusCode < 500 || err.isOperational ? {} : { stack: err.stack }),
  });
};
