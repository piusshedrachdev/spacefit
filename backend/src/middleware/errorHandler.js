import { ApiError } from '../utils/http.js';
import { config } from '../config.js';

/**
 * 404 handler for unmatched routes.
 */
export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

/**
 * Central error handler. Always responds with a consistent JSON envelope.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err instanceof ApiError ? err.status : 500;
  const message = status === 500 ? 'Internal server error' : err.message;

  if (status >= 500) {
    console.error('[error]', err);
  }

  const body = {
    success: false,
    error: {
      message,
      status
    }
  };

  if (err instanceof ApiError && err.details !== undefined) {
    body.error.details = err.details;
  }

  if (config.nodeEnv !== 'production' && status >= 500) {
    body.error.stack = err.stack;
  }

  res.status(status).json(body);
}
