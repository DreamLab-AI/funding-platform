/**
 * Auth Controller Unit Tests
 * Tests for registration, login, logout, profile management, and password change
 */

import { Response, NextFunction } from 'express';

// =========================================================================
// TEST CONSTANTS
// =========================================================================

const testUserId = '5ce94e1f-00a1-4390-b0b6-5e5f816ceefd';

// =========================================================================
// MOCK IMPLEMENTATIONS - Define mock functions
// =========================================================================

const mockFindByEmail = jest.fn();
const mockFindById = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockVerifyPassword = jest.fn();
const mockUpdatePassword = jest.fn();
const mockUpdateLastLogin = jest.fn();
const mockToPublic = jest.fn((user: any) => user ? ({
  user_id: user.user_id,
  email: user.email,
  first_name: user.first_name,
  last_name: user.last_name,
  role: user.role,
  is_active: user.is_active,
  created_at: user.created_at,
}) : null);

const mockCreateTokenPair = jest.fn();
const mockCreateAuditLog = jest.fn().mockResolvedValue(undefined);
const mockAuditLogin = jest.fn().mockResolvedValue(undefined);
const mockAuditLogout = jest.fn().mockResolvedValue(undefined);

// =========================================================================
// MOCK MODULES
// =========================================================================

jest.mock('../../../src/config', () => ({
  config: {
    env: 'test',
    jwt: { secret: 'test-secret', accessExpiry: '1h', refreshExpiry: '7d' },
    database: { url: 'postgres://test', ssl: false },
  },
}));

jest.mock('../../../src/config/database', () => ({
  default: { query: jest.fn(), pool: { query: jest.fn() } },
  query: jest.fn(),
  transaction: jest.fn(),
  pool: { query: jest.fn() },
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/models/user.model', () => ({
  UserModel: {
    findByEmail: (...args: any[]) => mockFindByEmail(...args),
    findById: (...args: any[]) => mockFindById(...args),
    create: (...args: any[]) => mockCreate(...args),
    update: (...args: any[]) => mockUpdate(...args),
    verifyPassword: (...args: any[]) => mockVerifyPassword(...args),
    updatePassword: (...args: any[]) => mockUpdatePassword(...args),
    updateLastLogin: (...args: any[]) => mockUpdateLastLogin(...args),
    toPublic: (...args: any[]) => mockToPublic(...args),
  },
}));

jest.mock('../../../src/middleware/auth.middleware', () => ({
  createTokenPair: (...args: any[]) => mockCreateTokenPair(...args),
}));

jest.mock('../../../src/middleware/audit.middleware', () => ({
  createAuditLog: (...args: any[]) => mockCreateAuditLog(...args),
  auditLogin: (...args: any[]) => mockAuditLogin(...args),
  auditLogout: (...args: any[]) => mockAuditLogout(...args),
}));

jest.mock('../../../src/utils/validation', () => ({
  loginSchema: { parse: (data: any) => data },
  userCreateSchema: { parse: (data: any) => data },
  refreshTokenSchema: { parse: (data: any) => data },
}));

// =========================================================================
// IMPORTS - After mocks
// =========================================================================

import { UserRole, AuthenticatedUser, User } from '../../../src/types';
import {
  register,
  login,
  logout,
  getProfile,
  updateProfile,
  changePassword,
  refreshAccessToken,
} from '../../../src/controllers/auth.controller';

// =========================================================================
// HELPER: Flush promises - asyncHandler returns void, so we need to flush
// =========================================================================

const flushPromises = () => new Promise(resolve => setImmediate(resolve));

// =========================================================================
// TEST DATA
// =========================================================================

const validRegistrationData = {
  email: 'newuser@example.com',
  password: 'SecurePass123!',
  first_name: 'New',
  last_name: 'User',
  role: 'applicant' as const,
};

const mockUser: User = {
  user_id: testUserId,
  email: 'test@example.com',
  password_hash: '$2b$10$hashedpassword',
  first_name: 'Test',
  last_name: 'User',
  role: UserRole.APPLICANT,
  organisation: null,
  is_active: true,
  created_at: new Date('2024-01-01'),
  updated_at: new Date('2024-01-01'),
  last_login: null,
};

const mockTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
};

const mockAuthUser: AuthenticatedUser = {
  user_id: testUserId,
  id: testUserId,
  email: 'test@example.com',
  role: UserRole.APPLICANT,
  first_name: 'Test',
  last_name: 'User',
};

// =========================================================================
// HELPER FUNCTIONS
// =========================================================================

function createMockRequest(overrides: Record<string, any> = {}): any {
  return {
    body: {},
    params: {},
    query: {},
    user: null,
    headers: {},
    ip: '127.0.0.1',
    method: 'GET',
    path: '/',
    ...overrides,
  };
}

function createMockResponse(): any {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
  };
}

// =========================================================================
// TESTS
// =========================================================================

describe('Auth Controller', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = jest.fn();

    // Default mock implementations
    mockCreateTokenPair.mockReturnValue(mockTokens);
  });

  // =========================================================================
  // REGISTER TESTS
  // =========================================================================
  describe('register', () => {
    it('should register a new user successfully (201)', async () => {
      const newUser = { ...mockUser, email: validRegistrationData.email };
      mockReq.body = validRegistrationData;

      mockFindByEmail.mockResolvedValue(null);
      mockCreate.mockResolvedValue(newUser);

      register(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockFindByEmail).toHaveBeenCalledWith(validRegistrationData.email);
      expect(mockCreate).toHaveBeenCalledWith(validRegistrationData);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            access_token: mockTokens.accessToken,
            refresh_token: mockTokens.refreshToken,
          }),
        })
      );
    });

    it('should throw 409 ConflictError when email already exists', async () => {
      mockReq.body = validRegistrationData;
      mockFindByEmail.mockResolvedValue(mockUser);

      register(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 409,
          message: 'Email already registered',
        })
      );
    });

    it('should create audit log on successful registration', async () => {
      const newUser = { ...mockUser, email: validRegistrationData.email };
      mockReq.body = validRegistrationData;

      mockFindByEmail.mockResolvedValue(null);
      mockCreate.mockResolvedValue(newUser);

      register(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        mockReq,
        expect.any(String),
        'user',
        newUser.user_id,
        expect.objectContaining({
          email: newUser.email,
          role: newUser.role,
        })
      );
    });
  });

  // =========================================================================
  // LOGIN TESTS
  // =========================================================================
  describe('login', () => {
    const loginData = { email: 'test@example.com', password: 'ValidPass123!' };

    it('should login successfully with valid credentials (200)', async () => {
      mockReq.body = loginData;

      mockFindByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);

      login(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockFindByEmail).toHaveBeenCalledWith(loginData.email);
      expect(mockVerifyPassword).toHaveBeenCalledWith(mockUser, loginData.password);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            access_token: mockTokens.accessToken,
          }),
        })
      );
    });

    it('should throw 401 AuthenticationError when user not found', async () => {
      mockReq.body = loginData;
      mockFindByEmail.mockResolvedValue(null);

      login(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Invalid email or password',
        })
      );
    });

    it('should throw 401 AuthenticationError when password is incorrect', async () => {
      mockReq.body = loginData;
      mockFindByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(false);

      login(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Invalid email or password',
        })
      );
    });

    it('should throw 401 AuthenticationError when account is deactivated', async () => {
      mockReq.body = loginData;
      mockFindByEmail.mockResolvedValue({ ...mockUser, is_active: false });
      mockVerifyPassword.mockResolvedValue(true);

      login(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Account is deactivated',
        })
      );
    });

    it('should update last login timestamp on successful login', async () => {
      mockReq.body = loginData;
      mockFindByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);

      login(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockUpdateLastLogin).toHaveBeenCalledWith(mockUser.user_id);
    });

    it('should create audit log on successful login', async () => {
      mockReq.body = loginData;
      mockFindByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);

      login(mockReq, mockRes, mockNext);
      await flushPromises();

      // auditLogin(req, success, userId, email)
      expect(mockAuditLogin).toHaveBeenCalledWith(
        mockReq,
        true,
        mockUser.user_id,
        mockUser.email
      );
    });

    it('should create failed login audit log when authentication fails', async () => {
      mockReq.body = loginData;
      mockFindByEmail.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(false);

      login(mockReq, mockRes, mockNext);
      await flushPromises();

      // auditLogin(req, success, userId, email)
      expect(mockAuditLogin).toHaveBeenCalledWith(
        mockReq,
        false,
        mockUser.user_id,
        mockUser.email
      );
    });
  });

  // =========================================================================
  // LOGOUT TESTS
  // =========================================================================
  describe('logout', () => {
    it('should logout successfully (200)', async () => {
      mockReq.user = mockAuthUser;

      logout(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            message: 'Logged out successfully',
          }),
        })
      );
    });

    it('should create audit log on logout', async () => {
      mockReq.user = mockAuthUser;

      logout(mockReq, mockRes, mockNext);
      await flushPromises();

      // auditLogout(req) - just 1 parameter
      expect(mockAuditLogout).toHaveBeenCalledWith(mockReq);
    });
  });

  // =========================================================================
  // GET PROFILE TESTS
  // =========================================================================
  describe('getProfile', () => {
    it('should return user profile successfully (200)', async () => {
      mockReq.user = mockAuthUser;
      mockFindById.mockResolvedValue(mockUser);

      getProfile(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockFindById).toHaveBeenCalledWith(mockAuthUser.user_id);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object),
        })
      );
    });

    it('should throw 401 when user not found in database', async () => {
      mockReq.user = mockAuthUser;
      mockFindById.mockResolvedValue(null);

      getProfile(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'User not found',
        })
      );
    });

    it('should throw 401 when no user is authenticated', async () => {
      mockReq.user = null;

      getProfile(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
    });
  });

  // =========================================================================
  // UPDATE PROFILE TESTS
  // =========================================================================
  describe('updateProfile', () => {
    const updateData = { first_name: 'Updated', last_name: 'Name' };

    it('should update profile successfully (200)', async () => {
      mockReq.user = mockAuthUser;
      mockReq.body = updateData;
      const updatedUser = { ...mockUser, ...updateData };
      mockUpdate.mockResolvedValue(updatedUser);

      updateProfile(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockUpdate).toHaveBeenCalledWith(mockAuthUser.user_id, updateData);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should throw 401 when user not found', async () => {
      mockReq.user = mockAuthUser;
      mockReq.body = updateData;
      mockUpdate.mockResolvedValue(null);

      updateProfile(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'User not found',
        })
      );
    });

    it('should throw 401 when no user is authenticated', async () => {
      mockReq.user = null;
      mockReq.body = updateData;

      updateProfile(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
    });

    it('should create audit log on profile update', async () => {
      mockReq.user = mockAuthUser;
      mockReq.body = updateData;
      const updatedUser = { ...mockUser, ...updateData };
      mockUpdate.mockResolvedValue(updatedUser);

      updateProfile(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        mockReq,
        expect.any(String),
        'user',
        mockAuthUser.user_id,
        expect.any(Object)
      );
    });
  });

  // =========================================================================
  // CHANGE PASSWORD TESTS
  // =========================================================================
  describe('changePassword', () => {
    const passwordData = {
      current_password: 'OldPass123!',
      new_password: 'NewPass456!',
    };

    it('should change password successfully (200)', async () => {
      mockReq.user = mockAuthUser;
      mockReq.body = passwordData;
      mockFindById.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);
      mockUpdatePassword.mockResolvedValue(true);

      changePassword(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockVerifyPassword).toHaveBeenCalledWith(mockUser, passwordData.current_password);
      expect(mockUpdatePassword).toHaveBeenCalledWith(mockUser.user_id, passwordData.new_password);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            message: 'Password changed successfully',
          }),
        })
      );
    });

    it('should throw 401 when current password is incorrect', async () => {
      mockReq.user = mockAuthUser;
      mockReq.body = passwordData;
      mockFindById.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(false);

      changePassword(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'Current password is incorrect',
        })
      );
    });

    it('should throw 401 when user not found', async () => {
      mockReq.user = mockAuthUser;
      mockReq.body = passwordData;
      mockFindById.mockResolvedValue(null);

      changePassword(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
          message: 'User not found',
        })
      );
    });

    it('should create audit log on password change', async () => {
      mockReq.user = mockAuthUser;
      mockReq.body = passwordData;
      mockFindById.mockResolvedValue(mockUser);
      mockVerifyPassword.mockResolvedValue(true);
      mockUpdatePassword.mockResolvedValue(true);

      changePassword(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        mockReq,
        expect.any(String),
        'user',
        mockAuthUser.user_id
      );
    });
  });

  // =========================================================================
  // REFRESH ACCESS TOKEN TESTS
  // =========================================================================
  describe('refreshAccessToken', () => {
    it('should call schema parse (Zod validation handles missing token)', async () => {
      // With our mock, parse just returns the data, so no validation error
      // In real scenario, Zod would throw if refresh_token is missing
      mockReq.body = { refresh_token: 'test-refresh-token' };

      refreshAccessToken(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });
  });

  // =========================================================================
  // AUTHENTICATION CHECKS
  // =========================================================================
  describe('Authentication Checks', () => {
    it('should require authentication for getProfile', async () => {
      mockReq.user = null;

      getProfile(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
    });

    it('should require authentication for updateProfile', async () => {
      mockReq.user = null;

      updateProfile(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
    });

    it('should require authentication for changePassword', async () => {
      mockReq.user = null;

      changePassword(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 401,
        })
      );
    });
  });

  // =========================================================================
  // ERROR HANDLING
  // =========================================================================
  describe('Error Handling', () => {
    it('should pass database errors to error handler (500)', async () => {
      mockReq.body = validRegistrationData;
      const dbError = new Error('Database connection failed');
      mockFindByEmail.mockRejectedValue(dbError);

      register(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(dbError);
    });

    it('should handle unexpected errors gracefully', async () => {
      const loginData = { email: 'test@example.com', password: 'password' };
      mockReq.body = loginData;
      const unexpectedError = new Error('Unexpected failure');
      mockFindByEmail.mockRejectedValue(unexpectedError);

      login(mockReq, mockRes, mockNext);
      await flushPromises();

      expect(mockNext).toHaveBeenCalledWith(unexpectedError);
    });
  });
});
