/**
 * Error Classes Unit Tests
 * Tests all custom error classes in utils/errors.ts
 */

import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DeadlinePassedError,
  FileTooLargeError,
  InvalidFileTypeError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  isAppError,
  handleError,
} from '../../../src/utils/errors';

describe('Error Classes', () => {
  // ============================================================================
  // APP ERROR (BASE CLASS)
  // ============================================================================
  describe('AppError', () => {
    it('should create error with default values', () => {
      const error = new AppError('Something went wrong');
      expect(error.message).toBe('Something went wrong');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.details).toBeUndefined();
    });

    it('should create error with custom values', () => {
      const error = new AppError('Custom error', 422, 'CUSTOM_ERROR', false, { field: 'value' });
      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('CUSTOM_ERROR');
      expect(error.isOperational).toBe(false);
      expect(error.details).toEqual({ field: 'value' });
    });

    it('should be instanceof Error', () => {
      const error = new AppError('Test');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should have proper stack trace', () => {
      const error = new AppError('Test');
      expect(error.stack).toBeDefined();
      // Stack trace contains the error constructor name or 'Error'
      expect(error.stack).toContain('Error');
    });

    it('should have correct name property', () => {
      const error = new AppError('Test');
      // Note: In TypeScript/ES6 classes extending Error, name defaults to 'Error'
      // unless explicitly set in constructor
      expect(error.name).toBe('Error');
    });

    it('should accept various detail types', () => {
      const errorWithArray = new AppError('Test', 400, 'TEST', true, ['item1', 'item2']);
      expect(errorWithArray.details).toEqual(['item1', 'item2']);

      const errorWithNull = new AppError('Test', 400, 'TEST', true, null);
      expect(errorWithNull.details).toBeNull();

      const errorWithNumber = new AppError('Test', 400, 'TEST', true, 42);
      expect(errorWithNumber.details).toBe(42);
    });
  });

  // ============================================================================
  // VALIDATION ERROR
  // ============================================================================
  describe('ValidationError', () => {
    it('should create validation error with message', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should accept validation details', () => {
      const details = {
        errors: [
          { field: 'email', message: 'Invalid email format' },
          { field: 'password', message: 'Password too short' },
        ],
      };
      const error = new ValidationError('Validation failed', details);
      expect(error.details).toEqual(details);
    });

    it('should be instanceof AppError', () => {
      const error = new ValidationError('Test');
      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  // ============================================================================
  // AUTHENTICATION ERROR
  // ============================================================================
  describe('AuthenticationError', () => {
    it('should create authentication error with default message', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('Authentication required');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create authentication error with custom message', () => {
      const error = new AuthenticationError('Invalid token');
      expect(error.message).toBe('Invalid token');
      expect(error.statusCode).toBe(401);
    });

    it('should be instanceof AppError', () => {
      const error = new AuthenticationError();
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================================
  // AUTHORIZATION ERROR
  // ============================================================================
  describe('AuthorizationError', () => {
    it('should create authorization error with default message', () => {
      const error = new AuthorizationError();
      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create authorization error with custom message', () => {
      const error = new AuthorizationError('Insufficient permissions');
      expect(error.message).toBe('Insufficient permissions');
    });

    it('should be instanceof AppError', () => {
      const error = new AuthorizationError();
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================================
  // NOT FOUND ERROR
  // ============================================================================
  describe('NotFoundError', () => {
    it('should create not found error for resource without ID', () => {
      const error = new NotFoundError('User');
      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.isOperational).toBe(true);
    });

    it('should create not found error for resource with ID', () => {
      const error = new NotFoundError('Application', '123-456');
      expect(error.message).toBe('Application with ID 123-456 not found');
    });

    it('should handle various resource names', () => {
      expect(new NotFoundError('FundingCall').message).toBe('FundingCall not found');
      expect(new NotFoundError('Assessment', 'abc').message).toBe('Assessment with ID abc not found');
    });

    it('should be instanceof AppError', () => {
      const error = new NotFoundError('Resource');
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================================
  // CONFLICT ERROR
  // ============================================================================
  describe('ConflictError', () => {
    it('should create conflict error with message', () => {
      const error = new ConflictError('Email already exists');
      expect(error.message).toBe('Email already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.isOperational).toBe(true);
    });

    it('should handle various conflict scenarios', () => {
      expect(new ConflictError('Duplicate entry').message).toBe('Duplicate entry');
      expect(new ConflictError('Resource already assigned').message).toBe('Resource already assigned');
    });

    it('should be instanceof AppError', () => {
      const error = new ConflictError('Test');
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================================
  // DEADLINE PASSED ERROR
  // ============================================================================
  describe('DeadlinePassedError', () => {
    it('should create deadline error with formatted date', () => {
      const deadline = new Date('2024-06-30T23:59:59.000Z');
      const error = new DeadlinePassedError(deadline);
      expect(error.message).toContain('Submission deadline has passed');
      expect(error.message).toContain('2024-06-30');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('DEADLINE_PASSED');
      expect(error.isOperational).toBe(true);
    });

    it('should format date in ISO 8601', () => {
      const deadline = new Date('2024-12-31T12:00:00.000Z');
      const error = new DeadlinePassedError(deadline);
      expect(error.message).toContain(deadline.toISOString());
    });

    it('should be instanceof AppError', () => {
      const error = new DeadlinePassedError(new Date());
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================================
  // FILE TOO LARGE ERROR
  // ============================================================================
  describe('FileTooLargeError', () => {
    it('should create error with size in MB', () => {
      const error = new FileTooLargeError(10485760); // 10MB
      expect(error.message).toContain('10MB');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('FILE_TOO_LARGE');
      expect(error.isOperational).toBe(true);
    });

    it('should round size to nearest MB', () => {
      const error1 = new FileTooLargeError(52428800); // 50MB
      expect(error1.message).toContain('50MB');

      const error2 = new FileTooLargeError(5242880); // 5MB
      expect(error2.message).toContain('5MB');
    });

    it('should handle small file sizes', () => {
      const error = new FileTooLargeError(1048576); // 1MB
      expect(error.message).toContain('1MB');
    });

    it('should be instanceof AppError', () => {
      const error = new FileTooLargeError(1000);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================================
  // INVALID FILE TYPE ERROR
  // ============================================================================
  describe('InvalidFileTypeError', () => {
    it('should create error with allowed types list', () => {
      const error = new InvalidFileTypeError(['pdf', 'docx', 'xlsx']);
      expect(error.message).toContain('Invalid file type');
      expect(error.message).toContain('pdf');
      expect(error.message).toContain('docx');
      expect(error.message).toContain('xlsx');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('INVALID_FILE_TYPE');
      expect(error.isOperational).toBe(true);
    });

    it('should handle single allowed type', () => {
      const error = new InvalidFileTypeError(['pdf']);
      expect(error.message).toContain('Allowed types: pdf');
    });

    it('should handle empty array', () => {
      const error = new InvalidFileTypeError([]);
      expect(error.message).toContain('Allowed types:');
    });

    it('should join types with comma and space', () => {
      const error = new InvalidFileTypeError(['jpg', 'png']);
      expect(error.message).toContain('jpg, png');
    });

    it('should be instanceof AppError', () => {
      const error = new InvalidFileTypeError(['pdf']);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================================
  // RATE LIMIT ERROR
  // ============================================================================
  describe('RateLimitError', () => {
    it('should create rate limit error without retry after', () => {
      const error = new RateLimitError();
      expect(error.message).toBe('Too many requests. Please try again later.');
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.isOperational).toBe(true);
    });

    it('should create rate limit error with retry after', () => {
      const error = new RateLimitError(60);
      expect(error.details).toEqual({ retryAfter: 60 });
    });

    it('should handle various retry times', () => {
      expect(new RateLimitError(30).details).toEqual({ retryAfter: 30 });
      expect(new RateLimitError(300).details).toEqual({ retryAfter: 300 });
      expect(new RateLimitError(0).details).toEqual({ retryAfter: 0 });
    });

    it('should be instanceof AppError', () => {
      const error = new RateLimitError();
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================================
  // DATABASE ERROR
  // ============================================================================
  describe('DatabaseError', () => {
    it('should create database error with default message', () => {
      const error = new DatabaseError();
      expect(error.message).toBe('Database operation failed');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should create database error with custom message', () => {
      const error = new DatabaseError('Connection timed out');
      expect(error.message).toBe('Connection timed out');
    });

    it('should handle various database error messages', () => {
      expect(new DatabaseError('Unique constraint violation').message).toBe('Unique constraint violation');
      expect(new DatabaseError('Foreign key violation').message).toBe('Foreign key violation');
    });

    it('should be instanceof AppError', () => {
      const error = new DatabaseError();
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================================
  // EXTERNAL SERVICE ERROR
  // ============================================================================
  describe('ExternalServiceError', () => {
    it('should create external service error with service name', () => {
      const error = new ExternalServiceError('PaymentGateway');
      expect(error.message).toContain('PaymentGateway');
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('EXTERNAL_SERVICE_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.details).toEqual({ service: 'PaymentGateway' });
    });

    it('should create external service error with custom message', () => {
      const error = new ExternalServiceError('EmailService', 'SMTP connection failed');
      expect(error.message).toBe('SMTP connection failed');
      expect(error.details).toEqual({ service: 'EmailService' });
    });

    it('should use default message format when no message provided', () => {
      const error = new ExternalServiceError('S3');
      expect(error.message).toBe('External service error: S3');
    });

    it('should be instanceof AppError', () => {
      const error = new ExternalServiceError('TestService');
      expect(error).toBeInstanceOf(AppError);
    });
  });

  // ============================================================================
  // IS APP ERROR HELPER
  // ============================================================================
  describe('isAppError', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new AppError('Test'))).toBe(true);
      expect(isAppError(new ValidationError('Test'))).toBe(true);
      expect(isAppError(new AuthenticationError())).toBe(true);
      expect(isAppError(new AuthorizationError())).toBe(true);
      expect(isAppError(new NotFoundError('Resource'))).toBe(true);
      expect(isAppError(new ConflictError('Test'))).toBe(true);
      expect(isAppError(new DeadlinePassedError(new Date()))).toBe(true);
      expect(isAppError(new FileTooLargeError(1000))).toBe(true);
      expect(isAppError(new InvalidFileTypeError(['pdf']))).toBe(true);
      expect(isAppError(new RateLimitError())).toBe(true);
      expect(isAppError(new DatabaseError())).toBe(true);
      expect(isAppError(new ExternalServiceError('Test'))).toBe(true);
    });

    it('should return false for standard Error', () => {
      expect(isAppError(new Error('Test'))).toBe(false);
    });

    it('should return false for TypeError', () => {
      expect(isAppError(new TypeError('Test'))).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isAppError(null)).toBe(false);
      expect(isAppError(undefined)).toBe(false);
      expect(isAppError('error string')).toBe(false);
      expect(isAppError(123)).toBe(false);
      expect(isAppError({ message: 'fake error' })).toBe(false);
      expect(isAppError([])).toBe(false);
    });
  });

  // ============================================================================
  // HANDLE ERROR HELPER
  // ============================================================================
  describe('handleError', () => {
    it('should return same error if already AppError', () => {
      const appError = new ValidationError('Test error');
      const result = handleError(appError);
      expect(result).toBe(appError);
    });

    it('should wrap standard Error', () => {
      const standardError = new Error('Standard error message');
      const result = handleError(standardError);
      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('Standard error message');
      expect(result.statusCode).toBe(500);
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.isOperational).toBe(false);
    });

    it('should wrap TypeError', () => {
      const typeError = new TypeError('Cannot read property');
      const result = handleError(typeError);
      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('Cannot read property');
      expect(result.isOperational).toBe(false);
    });

    it('should handle string thrown', () => {
      const result = handleError('Something went wrong');
      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('An unexpected error occurred');
      expect(result.isOperational).toBe(false);
    });

    it('should handle number thrown', () => {
      const result = handleError(404);
      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('An unexpected error occurred');
    });

    it('should handle null', () => {
      const result = handleError(null);
      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('An unexpected error occurred');
    });

    it('should handle undefined', () => {
      const result = handleError(undefined);
      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('An unexpected error occurred');
    });

    it('should handle object thrown', () => {
      const result = handleError({ error: 'Some error' });
      expect(result).toBeInstanceOf(AppError);
      expect(result.message).toBe('An unexpected error occurred');
    });

    it('should preserve AppError subclass types', () => {
      const validationError = new ValidationError('Validation failed');
      const result = handleError(validationError);
      expect(result).toBeInstanceOf(ValidationError);
      expect(result.statusCode).toBe(400);
    });
  });

  // ============================================================================
  // ERROR INHERITANCE CHAIN
  // ============================================================================
  describe('Error Inheritance', () => {
    it('should maintain proper prototype chain for all error types', () => {
      const errors = [
        new ValidationError('Test'),
        new AuthenticationError(),
        new AuthorizationError(),
        new NotFoundError('Resource'),
        new ConflictError('Test'),
        new DeadlinePassedError(new Date()),
        new FileTooLargeError(1000),
        new InvalidFileTypeError(['pdf']),
        new RateLimitError(),
        new DatabaseError(),
        new ExternalServiceError('Test'),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AppError);
        expect(error.stack).toBeDefined();
      });
    });
  });
});
