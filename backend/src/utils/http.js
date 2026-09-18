/**
 * An error that carries an HTTP status code and optional machine-readable
 * details. Thrown anywhere in the request lifecycle and translated to a JSON
 * response by the central error handler.
 */
export class ApiError extends Error {
  constructor(status, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message, details) {
    return new ApiError(409, message, details);
  }

  static unprocessable(message, details) {
    return new ApiError(422, message, details);
  }
}

/**
 * Wrap an async route handler so rejected promises are forwarded to Express'
 * error middleware instead of crashing the process.
 * @param {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<any>} fn
 */
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Standard success envelope so every endpoint returns a predictable shape.
 */
export function ok(res, data, status = 200, meta = undefined) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return res.status(status).json(body);
}
