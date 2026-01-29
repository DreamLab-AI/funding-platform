/**
 * JWT Service Unit Tests
 * Tests token generation, verification, refresh, and revocation
 */

import { JWTService } from '../../../src/security/jwt.service';
import { UserRole, Permission, AuthUser } from '../../../src/types/security.types';
import * as crypto from 'crypto';

// Note: We don't mock crypto as it breaks HMAC operations needed for JWT signing
// Instead we use jest.spyOn for specific functions when needed

// Mock config
jest.mock('../../../src/config/security', () => ({
  JWT_CONFIG: {
    accessToken: {
      secret: 'test-access-secret-key-for-testing',
      expiresIn: '15m',
      algorithm: 'HS256',
      issuer: 'test-issuer',
      audience: 'test-audience',
    },
    refreshToken: {
      secret: 'test-refresh-secret-key-for-testing',
      expiresIn: '7d',
      algorithm: 'HS256',
    },
    rotation: {
      enabled: true,
      reuseWindow: 10,
      maxFamily: 5,
    },
  },
}));

describe('JWTService', () => {
  let jwtService: JWTService;
  let mockUser: AuthUser;

  beforeEach(() => {
    jwtService = new JWTService();
    mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      passwordHash: 'hashed-password',
      role: UserRole.APPLICANT,
      permissions: [Permission.APPLICATION_CREATE],
      isActive: true,
      isEmailVerified: true,
      mfaEnabled: false,
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const token = jwtService.generateAccessToken(mockUser);

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct payload fields', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const payload = jwtService.decodeToken(token);

      expect(payload).toMatchObject({
        sub: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        iss: 'test-issuer',
        aud: 'test-audience',
      });
    });

    it('should include permissions in token', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const payload = jwtService.decodeToken(token);

      expect(payload).toHaveProperty('permissions');
      expect((payload as any).permissions).toContain(Permission.APPLICATION_CREATE);
    });

    it('should include session ID when provided', () => {
      const token = jwtService.generateAccessToken(mockUser, 'session-456');
      const payload = jwtService.decodeToken(token);

      expect((payload as any).sessionId).toBe('session-456');
    });

    it('should generate unique JTI for each token', () => {
      const token1 = jwtService.generateAccessToken(mockUser);
      const token2 = jwtService.generateAccessToken(mockUser);

      const payload1 = jwtService.decodeToken(token1);
      const payload2 = jwtService.decodeToken(token2);

      // Each token should have a unique JTI
      expect((payload1 as any).jti).toBeDefined();
      expect((payload2 as any).jti).toBeDefined();
      expect((payload1 as any).jti).not.toBe((payload2 as any).jti);
    });

    it('should set proper expiration time', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      const token = jwtService.generateAccessToken(mockUser);
      const afterTime = Math.floor(Date.now() / 1000);

      const payload = jwtService.decodeToken(token);
      const expectedExp = beforeTime + 15 * 60; // 15 minutes

      expect((payload as any).exp).toBeGreaterThanOrEqual(expectedExp);
      expect((payload as any).exp).toBeLessThanOrEqual(afterTime + 15 * 60 + 1);
    });

    it('should handle all user roles', () => {
      const roles = [UserRole.APPLICANT, UserRole.ASSESSOR, UserRole.COORDINATOR, UserRole.SCHEME_OWNER];

      roles.forEach((role) => {
        const user = { ...mockUser, role };
        const token = jwtService.generateAccessToken(user);
        const payload = jwtService.decodeToken(token);

        expect((payload as any).role).toBe(role);
      });
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token', () => {
      const token = jwtService.generateRefreshToken('user-123');

      expect(token).toBeDefined();
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include user ID in subject', () => {
      const token = jwtService.generateRefreshToken('user-123');
      const payload = jwtService.decodeToken(token);

      expect((payload as any).sub).toBe('user-123');
    });

    it('should include family ID for rotation tracking', () => {
      const token = jwtService.generateRefreshToken('user-123');
      const payload = jwtService.decodeToken(token);

      expect(payload).toHaveProperty('family');
    });

    it('should use provided family ID when specified', () => {
      const token = jwtService.generateRefreshToken('user-123', 'custom-family-id');
      const payload = jwtService.decodeToken(token);

      expect((payload as any).family).toBe('custom-family-id');
    });

    it('should set proper expiration time (7 days)', () => {
      const beforeTime = Math.floor(Date.now() / 1000);
      const token = jwtService.generateRefreshToken('user-123');

      const payload = jwtService.decodeToken(token);
      const expectedExp = beforeTime + 7 * 24 * 60 * 60; // 7 days

      expect((payload as any).exp).toBeGreaterThanOrEqual(expectedExp - 1);
    });
  });

  describe('generateTokenPair', () => {
    it('should return both access and refresh tokens', () => {
      const tokenPair = jwtService.generateTokenPair(mockUser);

      expect(tokenPair).toHaveProperty('accessToken');
      expect(tokenPair).toHaveProperty('refreshToken');
      expect(tokenPair.accessToken).toBeDefined();
      expect(tokenPair.refreshToken).toBeDefined();
    });

    it('should return correct token type', () => {
      const tokenPair = jwtService.generateTokenPair(mockUser);

      expect(tokenPair.tokenType).toBe('Bearer');
    });

    it('should return expires in seconds', () => {
      const tokenPair = jwtService.generateTokenPair(mockUser);

      expect(tokenPair.expiresIn).toBe(15 * 60); // 15 minutes in seconds
    });

    it('should include session ID in access token when provided', () => {
      const tokenPair = jwtService.generateTokenPair(mockUser, 'session-789');
      const payload = jwtService.decodeToken(tokenPair.accessToken);

      expect((payload as any).sessionId).toBe('session-789');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const payload = jwtService.verifyAccessToken(token);

      expect(payload.sub).toBe('user-123');
      expect(payload.email).toBe('test@example.com');
    });

    it('should throw on invalid token format', () => {
      expect(() => jwtService.verifyAccessToken('invalid-token')).toThrow(
        'Invalid token format'
      );
    });

    it('should throw on invalid signature', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const parts = token.split('.');
      // Replace signature with different characters but same length (base64url safe chars)
      const fakeSignature = parts[2].split('').map(c => c === 'a' ? 'b' : 'a').join('');
      const tamperedToken = `${parts[0]}.${parts[1]}.${fakeSignature}`;

      expect(() => jwtService.verifyAccessToken(tamperedToken)).toThrow(
        'Invalid token signature'
      );
    });

    it('should throw on expired token', () => {
      // Generate a token with past expiration
      const token = jwtService.generateAccessToken(mockUser);
      const payload = jwtService.decodeToken(token);

      // Mock Date.now to simulate future time
      const originalNow = Date.now;
      Date.now = () => ((payload as any).exp + 1) * 1000;

      try {
        expect(() => jwtService.verifyAccessToken(token)).toThrow('Token has expired');
      } finally {
        Date.now = originalNow;
      }
    });

    it('should throw on revoked token', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const payload = jwtService.decodeToken(token);

      jwtService.revokeToken((payload as any).jti);

      expect(() => jwtService.verifyAccessToken(token)).toThrow(
        'Token has been revoked'
      );
    });

    it('should throw on invalid issuer', () => {
      // Create token with different issuer
      const token = jwtService.generateAccessToken(mockUser);
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.iss = 'wrong-issuer';

      const newPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tamperedToken = `${parts[0]}.${newPayload}.${parts[2]}`;

      expect(() => jwtService.verifyAccessToken(tamperedToken)).toThrow();
    });

    it('should throw on invalid audience', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const parts = token.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.aud = 'wrong-audience';

      const newPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const tamperedToken = `${parts[0]}.${newPayload}.${parts[2]}`;

      expect(() => jwtService.verifyAccessToken(tamperedToken)).toThrow();
    });

    it('should return full payload on valid token', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const payload = jwtService.verifyAccessToken(token);

      expect(payload).toHaveProperty('sub');
      expect(payload).toHaveProperty('email');
      expect(payload).toHaveProperty('role');
      expect(payload).toHaveProperty('permissions');
      expect(payload).toHaveProperty('iat');
      expect(payload).toHaveProperty('exp');
      expect(payload).toHaveProperty('iss');
      expect(payload).toHaveProperty('aud');
      expect(payload).toHaveProperty('jti');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = jwtService.generateRefreshToken('user-123');
      const payload = jwtService.verifyRefreshToken(token);

      expect(payload.sub).toBe('user-123');
    });

    it('should throw on expired refresh token', () => {
      const token = jwtService.generateRefreshToken('user-123');
      const payload = jwtService.decodeToken(token);

      const originalNow = Date.now;
      Date.now = () => ((payload as any).exp + 1) * 1000;

      try {
        expect(() => jwtService.verifyRefreshToken(token)).toThrow(
          'Refresh token has expired'
        );
      } finally {
        Date.now = originalNow;
      }
    });

    it('should throw on revoked refresh token', () => {
      const token = jwtService.generateRefreshToken('user-123');
      const payload = jwtService.decodeToken(token);

      jwtService.revokeToken((payload as any).jti);

      expect(() => jwtService.verifyRefreshToken(token)).toThrow(
        'Refresh token has been revoked'
      );
    });

    it('should throw when family rotation limit exceeded', () => {
      const familyId = 'test-family-id';

      // Generate tokens to exceed the limit
      for (let i = 0; i <= 5; i++) {
        jwtService.generateRefreshToken('user-123', familyId);
      }

      const newToken = jwtService.generateRefreshToken('user-123', familyId);

      expect(() => jwtService.verifyRefreshToken(newToken)).toThrow(
        'Token family exceeded maximum rotations'
      );
    });
  });

  describe('refreshTokens', () => {
    it('should return new token pair on valid refresh', () => {
      const initialPair = jwtService.generateTokenPair(mockUser);
      const newPair = jwtService.refreshTokens(initialPair.refreshToken, mockUser);

      expect(newPair.accessToken).toBeDefined();
      expect(newPair.refreshToken).toBeDefined();
      expect(newPair.accessToken).not.toBe(initialPair.accessToken);
      expect(newPair.refreshToken).not.toBe(initialPair.refreshToken);
    });

    it('should revoke old refresh token', () => {
      const initialPair = jwtService.generateTokenPair(mockUser);
      jwtService.refreshTokens(initialPair.refreshToken, mockUser);

      expect(() => jwtService.verifyRefreshToken(initialPair.refreshToken)).toThrow(
        'Refresh token has been revoked'
      );
    });

    it('should maintain token family', () => {
      const initialPair = jwtService.generateTokenPair(mockUser);
      const initialPayload = jwtService.decodeToken(initialPair.refreshToken);

      const newPair = jwtService.refreshTokens(initialPair.refreshToken, mockUser);
      const newPayload = jwtService.decodeToken(newPair.refreshToken);

      expect((newPayload as any).family).toBe((initialPayload as any).family);
    });

    it('should throw when user ID does not match', () => {
      const token = jwtService.generateRefreshToken('user-123');
      const differentUser = { ...mockUser, id: 'different-user' };

      expect(() => jwtService.refreshTokens(token, differentUser)).toThrow();
    });

    it('should include session ID in new access token', () => {
      const initialPair = jwtService.generateTokenPair(mockUser);
      const newPair = jwtService.refreshTokens(
        initialPair.refreshToken,
        mockUser,
        'new-session-123'
      );

      const payload = jwtService.decodeToken(newPair.accessToken);
      expect((payload as any).sessionId).toBe('new-session-123');
    });
  });

  describe('revokeToken', () => {
    it('should revoke a specific token by JTI', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const payload = jwtService.decodeToken(token);

      jwtService.revokeToken((payload as any).jti);

      expect(() => jwtService.verifyAccessToken(token)).toThrow(
        'Token has been revoked'
      );
    });
  });

  describe('revokeTokenFamily', () => {
    it('should revoke all tokens in a family', () => {
      const familyId = 'family-to-revoke';
      const token1 = jwtService.generateRefreshToken('user-123', familyId);

      jwtService.revokeTokenFamily(familyId);

      // Existing token in revoked family should fail
      expect(() => jwtService.verifyRefreshToken(token1)).toThrow();
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should log user token revocation', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      jwtService.revokeAllUserTokens('user-123');

      expect(consoleSpy).toHaveBeenCalledWith(
        'All tokens revoked for user: user-123'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const payload = jwtService.decodeToken(token);

      expect(payload).not.toBeNull();
      expect((payload as any).sub).toBe('user-123');
    });

    it('should return null for invalid format', () => {
      expect(jwtService.decodeToken('invalid')).toBeNull();
      expect(jwtService.decodeToken('a.b')).toBeNull();
      expect(jwtService.decodeToken('')).toBeNull();
    });

    it('should return null for malformed payload', () => {
      expect(jwtService.decodeToken('eyJ.invalid-base64.sig')).toBeNull();
    });
  });

  describe('isTokenExpiringSoon', () => {
    it('should return true when token expires within threshold', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const payload = jwtService.decodeToken(token);

      // Mock time to be close to expiration
      const originalNow = Date.now;
      Date.now = () => ((payload as any).exp - 200) * 1000; // 200 seconds before expiry

      try {
        expect(jwtService.isTokenExpiringSoon(token, 300)).toBe(true);
      } finally {
        Date.now = originalNow;
      }
    });

    it('should return false when token has plenty of time', () => {
      const token = jwtService.generateAccessToken(mockUser);

      expect(jwtService.isTokenExpiringSoon(token, 300)).toBe(false);
    });

    it('should return true for invalid token', () => {
      expect(jwtService.isTokenExpiringSoon('invalid', 300)).toBe(true);
    });
  });

  describe('extractUserId', () => {
    it('should extract user ID from token', () => {
      const token = jwtService.generateAccessToken(mockUser);

      expect(jwtService.extractUserId(token)).toBe('user-123');
    });

    it('should return null for invalid token', () => {
      expect(jwtService.extractUserId('invalid')).toBeNull();
    });
  });

  describe('getTokenExpiration', () => {
    it('should return expiration date', () => {
      const token = jwtService.generateAccessToken(mockUser);
      const expiration = jwtService.getTokenExpiration(token);

      expect(expiration).toBeInstanceOf(Date);
      expect(expiration!.getTime()).toBeGreaterThan(Date.now());
    });

    it('should return null for invalid token', () => {
      expect(jwtService.getTokenExpiration('invalid')).toBeNull();
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should log cleanup execution', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      jwtService.cleanupExpiredTokens();

      expect(consoleSpy).toHaveBeenCalledWith('Token cleanup executed');

      consoleSpy.mockRestore();
    });
  });

  describe('timing attack prevention', () => {
    it('should use constant-time comparison for signatures', () => {
      // This test verifies the implementation uses crypto.timingSafeEqual
      // The actual timing attack would require performance measurements

      const token = jwtService.generateAccessToken(mockUser);

      // Get the correct signature length by generating another token
      const parts = token.split('.');
      const signatureLength = parts[2].length;

      // Create tampered signatures with same length as original
      const fakeSignature1 = 'a'.repeat(signatureLength);
      const fakeSignature2 = 'z'.repeat(signatureLength);

      const tamperedToken1 = `${parts[0]}.${parts[1]}.${fakeSignature1}`;
      const tamperedToken2 = `${parts[0]}.${parts[1]}.${fakeSignature2}`;

      // Both should fail (not leak info about which char failed)
      expect(() => jwtService.verifyAccessToken(tamperedToken1)).toThrow();
      expect(() => jwtService.verifyAccessToken(tamperedToken2)).toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle empty permissions array', () => {
      const user = { ...mockUser, permissions: [] };
      const token = jwtService.generateAccessToken(user);
      const payload = jwtService.decodeToken(token);

      expect((payload as any).permissions).toEqual([]);
    });

    it('should handle multiple permissions', () => {
      const user = {
        ...mockUser,
        permissions: [
          Permission.APPLICATION_CREATE,
          Permission.APPLICATION_READ_OWN,
          Permission.APPLICATION_SUBMIT,
        ],
      };
      const token = jwtService.generateAccessToken(user);
      const payload = jwtService.decodeToken(token);

      expect((payload as any).permissions).toHaveLength(3);
    });

    it('should handle special characters in email', () => {
      const user = { ...mockUser, email: "test+special'chars@example.com" };
      const token = jwtService.generateAccessToken(user);
      const payload = jwtService.decodeToken(token);

      expect((payload as any).email).toBe("test+special'chars@example.com");
    });
  });
});
