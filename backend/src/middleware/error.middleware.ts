import { Request, Response, NextFunction } from 'express';
import { AppError, isAppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { config } from '../config';
import { ApiResponse } from '../types';

/**
 * Not found handler - catches unmatched routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse<null> = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  };

  res.status(404).json(response);
}

/**
 * Global error handler
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  if (isAppError(err) && err.isOperational) {
    logger.warn('Operational error', {
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });
  } else {
    logger.error('Unexpected error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  // Build response
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let errorMessage = 'An unexpected error occurred';
  let errorDetails: unknown = undefined;

  if (isAppError(err)) {
    statusCode = err.statusCode;
    errorCode = err.code;
    errorMessage = err.message;
    errorDetails = err.details;
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    // JSON parse error
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    errorMessage = 'Invalid JSON in request body';
  } else if (err.name === 'MulterError') {
    statusCode = 400;
    errorCode = 'UPLOAD_ERROR';
    errorMessage = err.message;
  }

  // Don't expose internal errors in production
  if (config.env === 'production' && !isAppError(err)) {
    errorMessage = 'An unexpected error occurred';
    errorDetails = undefined;
  }

  const response: ApiResponse<null> = {
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
      details: config.env !== 'production' ? errorDetails : undefined,
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Async handler wrapper - catches errors from async route handlers
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Request timeout handler
 */
export function timeoutHandler(timeout: number = 30000) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.setTimeout(timeout, () => {
      const response: ApiResponse<null> = {
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timeout',
        },
      };
      res.status(408).json(response);
    });
    next();
  };
}

export default {
  notFoundHandler,
  errorHandler,
  asyncHandler,
  timeoutHandler,
};
