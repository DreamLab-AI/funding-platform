/**
 * Auth Middleware Unit Tests
 * Tests JWT authentication middleware, token generation, and refresh
 */

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  authenticate,
  optionalAuth,
  refreshToken,
  generateAccessToken,
  generateRefreshToken,
  createTokenPair,
} from '../../../src/middleware/auth.middleware';
import { AuthRequest, AuthenticatedUser, UserRole } from '../../../src/types';
import { AuthenticationError } from '../../../src/utils/errors';
import { UserModel } from '../../../src/models/user.model';

// Mock dependencies - must mock config/database before importing modules that use it
jest.mock('../../../src/config/database', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));
jest.mock('jsonwebtoken');
jest.mock('../../../src/config', () => ({
  config: {
    jwt: {
      secret: 'test-secret-key',
      expiresIn: '30m',
      refreshExpiresIn: '7d',
    },
    database: {
      url: 'postgresql://test:test@localhost:5432/test',
      ssl: false,
    },
  },
}));
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Auth Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      body: {},
    };
    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  // Test fixtures
  const mockUser: AuthenticatedUser = {
    user_id: 'user-123',
    id: 'user-123',
    email: 'test@example.com',
    role: UserRole.APPLICANT,
    first_name: 'Test',
    last_name: 'User',
  };

  const mockDbUser = {
    user_id: 'user-123',
    email: 'test@example.com',
    role: UserRole.APPLICANT,
    first_name: 'Test',
    last_name: 'User',
    is_active: true,
  };

  describe('authenticate', () => {
    it('should call next with error when no authorization header', () => {
      authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0] as AuthenticationError;
      expect(error.message).toBe('No authentication token provided');
    });

    it('should call next with error for invalid authorization format', () => {
      mockRequest.headers = { authorization: 'InvalidFormat token' };

      authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should call next with error for missing token after Bearer', () => {
      mockRequest.headers = { authorization: 'Bearer' };

      authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should verify token and set user on request', () => {
      const token = 'valid-token';
      mockRequest.headers = { authorization: `Bearer ${token}` };

      (jwt.verify as jest.Mock).mockReturnValue({
        user_id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        type: 'access',
      });

      authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-secret-key');
      expect(mockRequest.user).toMatchObject({
        user_id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
      });
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next with error for expired token', () => {
      mockRequest.headers = { authorization: 'Bearer expired-token' };

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0] as AuthenticationError;
      expect(error.message).toBe('Token has expired');
    });

    it('should call next with error for invalid token', () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0] as AuthenticationError;
      expect(error.message).toBe('Invalid token');
    });

    it('should call next with error for wrong token type', () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      (jwt.verify as jest.Mock).mockReturnValue({
        user_id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        type: 'refresh', // Wrong type
      });

      authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0] as AuthenticationError;
      expect(error.message).toBe('Invalid token type');
    });

    it('should handle generic verification errors', () => {
      mockRequest.headers = { authorization: 'Bearer some-token' };

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Unknown error');
      });

      authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0] as AuthenticationError;
      expect(error.message).toBe('Token verification failed');
    });
  });

  describe('optionalAuth', () => {
    it('should continue without error when no token provided', () => {
      optionalAuth(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should set user when valid token provided', () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      (jwt.verify as jest.Mock).mockReturnValue({
        user_id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        type: 'access',
      });

      optionalAuth(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.user_id).toBe('user-123');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should continue without error for invalid token', () => {
      mockRequest.headers = { authorization: 'Bearer invalid-token' };

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      optionalAuth(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should not set user for refresh token type', () => {
      mockRequest.headers = { authorization: 'Bearer valid-token' };

      (jwt.verify as jest.Mock).mockReturnValue({
        user_id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        type: 'refresh',
      });

      optionalAuth(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockRequest.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('refreshToken', () => {
    it('should call next with error when no refresh token provided', async () => {
      mockRequest.body = {};

      await refreshToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0] as AuthenticationError;
      expect(error.message).toBe('No refresh token provided');
    });

    it('should call next with error for wrong token type', async () => {
      mockRequest.body = { refresh_token: 'some-token' };

      (jwt.verify as jest.Mock).mockReturnValue({
        user_id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        type: 'access', // Wrong type
      });

      await refreshToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0] as AuthenticationError;
      expect(error.message).toBe('Invalid token type');
    });

    it('should call next with error for non-existent user', async () => {
      mockRequest.body = { refresh_token: 'valid-refresh-token' };

      (jwt.verify as jest.Mock).mockReturnValue({
        user_id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        type: 'refresh',
      });

      (UserModel.findById as jest.Mock).mockResolvedValue(null);

      await refreshToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0] as AuthenticationError;
      expect(error.message).toBe('User not found or inactive');
    });

    it('should call next with error for inactive user', async () => {
      mockRequest.body = { refresh_token: 'valid-refresh-token' };

      (jwt.verify as jest.Mock).mockReturnValue({
        user_id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        type: 'refresh',
      });

      (UserModel.findById as jest.Mock).mockResolvedValue({
        ...mockDbUser,
        is_active: false,
      });

      await refreshToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should return new token pair for valid refresh', async () => {
      mockRequest.body = { refresh_token: 'valid-refresh-token' };

      (jwt.verify as jest.Mock).mockReturnValue({
        user_id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        type: 'refresh',
      });

      (UserModel.findById as jest.Mock).mockResolvedValue(mockDbUser);

      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      await refreshToken(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: expect.any(Number),
        }),
      });
    });
  });

  describe('generateAccessToken', () => {
    it('should generate access token with correct payload', () => {
      (jwt.sign as jest.Mock).mockReturnValue('generated-token');

      const token = generateAccessToken(mockUser);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          email: 'test@example.com',
          role: UserRole.APPLICANT,
          type: 'access',
        }),
        'test-secret-key',
        { expiresIn: '30m' }
      );
      expect(token).toBe('generated-token');
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate refresh token with correct payload', () => {
      (jwt.sign as jest.Mock).mockReturnValue('generated-refresh-token');

      const token = generateRefreshToken(mockUser);

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          email: 'test@example.com',
          role: UserRole.APPLICANT,
          type: 'refresh',
        }),
        'test-secret-key',
        { expiresIn: '7d' }
      );
      expect(token).toBe('generated-refresh-token');
    });
  });

  describe('createTokenPair', () => {
    it('should create both access and refresh tokens', () => {
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token');

      const pair = createTokenPair(mockUser);

      expect(pair).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: expect.any(Number),
      });
    });

    it('should return correct expiration time', () => {
      (jwt.sign as jest.Mock).mockReturnValue('token');

      const pair = createTokenPair(mockUser);

      // 30m = 1800 seconds
      expect(pair.expiresIn).toBe(1800);
    });
  });

  describe('all user roles', () => {
    const roles = [
      UserRole.APPLICANT,
      UserRole.ASSESSOR,
      UserRole.COORDINATOR,
      UserRole.SCHEME_OWNER,
    ];

    roles.forEach((role) => {
      it(`should authenticate ${role} correctly`, () => {
        mockRequest.headers = { authorization: 'Bearer valid-token' };

        (jwt.verify as jest.Mock).mockReturnValue({
          user_id: 'user-123',
          email: 'test@example.com',
          role,
          type: 'access',
        });

        authenticate(
          mockRequest as AuthRequest,
          mockResponse as Response,
          mockNext
        );

        expect(mockRequest.user?.role).toBe(role);
        expect(mockNext).toHaveBeenCalledWith();
      });
    });
  });

  describe('edge cases', () => {
    it('should handle token with only Bearer prefix and space', () => {
      mockRequest.headers = { authorization: 'Bearer ' };

      authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Empty token after Bearer should fail
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should handle multiple spaces in authorization header', () => {
      mockRequest.headers = { authorization: 'Bearer  double-space-token' };

      authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Should fail due to extra space
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should handle lowercase bearer', () => {
      mockRequest.headers = { authorization: 'bearer token' };

      authenticate(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      // Should fail - Bearer is case-sensitive
      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });
});
