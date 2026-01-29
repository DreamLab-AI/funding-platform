import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';

/**
 * Validation source types
 */
type ValidationSource = 'body' | 'query' | 'params';

/**
 * Validate request data against a Zod schema
 */
export function validate(schema: ZodSchema, source: ValidationSource = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[source];
      const validated = schema.parse(data);

      // Replace request data with validated/transformed data
      (req as any)[source] = validated;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        next(
          new ValidationError('Validation failed', {
            errors: formattedErrors,
          })
        );
        return;
      }

      next(error);
    }
  };
}

/**
 * Validate request body
 */
export function validateBody(schema: ZodSchema) {
  return validate(schema, 'body');
}

/**
 * Validate query parameters
 */
export function validateQuery(schema: ZodSchema) {
  return validate(schema, 'query');
}

/**
 * Validate route parameters
 */
export function validateParams(schema: ZodSchema) {
  return validate(schema, 'params');
}

/**
 * Validate multiple sources at once
 */
export function validateAll(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const errors: Array<{ source: string; field: string; message: string }> = [];

      if (schemas.body) {
        try {
          req.body = schemas.body.parse(req.body);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(
              ...error.errors.map((err) => ({
                source: 'body',
                field: err.path.join('.'),
                message: err.message,
              }))
            );
          }
        }
      }

      if (schemas.query) {
        try {
          req.query = schemas.query.parse(req.query) as any;
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(
              ...error.errors.map((err) => ({
                source: 'query',
                field: err.path.join('.'),
                message: err.message,
              }))
            );
          }
        }
      }

      if (schemas.params) {
        try {
          req.params = schemas.params.parse(req.params);
        } catch (error) {
          if (error instanceof ZodError) {
            errors.push(
              ...error.errors.map((err) => ({
                source: 'params',
                field: err.path.join('.'),
                message: err.message,
              }))
            );
          }
        }
      }

      if (errors.length > 0) {
        next(new ValidationError('Validation failed', { errors }));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate UUID parameter
 */
export function validateUUID(paramName: string) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.params[paramName];

    if (!value || !uuidRegex.test(value)) {
      next(
        new ValidationError(`Invalid ${paramName}: must be a valid UUID`, {
          field: paramName,
          value,
        })
      );
      return;
    }

    next();
  };
}

/**
 * Sanitize string input (trim whitespace, remove potentially dangerous characters)
 */
export function sanitizeString(value: string): string {
  return value
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, ''); // Remove data: protocol
}

/**
 * Middleware to sanitize all string values in request body
 */
export function sanitizeBody(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Recursively sanitize all string values in an object
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeString(item)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>)
            : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export default {
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validateAll,
  validateUUID,
  sanitizeBody,
  sanitizeString,
};
