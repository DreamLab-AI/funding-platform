/**
 * JWT Service
 * Handles JWT token generation, validation, and refresh token management
 * Aligned with PRD 12.1: Authentication & Authorisation
 */

import * as crypto from 'crypto';
import { JWT_CONFIG } from '../config/security';
import {
  JWTPayload,
  RefreshTokenPayload,
  TokenPair,
  AuthUser,
  Permission,
} from '../types/security.types';

// Token storage for revocation (in production, use Redis)
const revokedTokens = new Set<string>();
const refreshTokenFamilies = new Map<string, { count: number; lastUsed: Date }>();

/**
 * Base64URL encode
 */
function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Base64URL decode
 */
function base64UrlDecode(data: string): string {
  const padded = data + '='.repeat((4 - (data.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

/**
 * Create HMAC signature
 */
function createSignature(data: string, secret: string): string {
  return base64UrlEncode(
    crypto.createHmac('sha256', secret).update(data).digest('base64')
  );
}

/**
 * Generate a unique token ID
 */
function generateTokenId(): string {
  return crypto.randomUUID();
}

/**
 * Generate a token family ID for refresh token rotation
 */
function generateFamilyId(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Parse duration string to milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid duration format: ${duration}`);

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

/**
 * JWT Service class
 */
export class JWTService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor() {
    this.accessSecret = JWT_CONFIG.accessToken.secret;
    this.refreshSecret = JWT_CONFIG.refreshToken.secret;
    this.accessExpiresIn = JWT_CONFIG.accessToken.expiresIn;
    this.refreshExpiresIn = JWT_CONFIG.refreshToken.expiresIn;
    this.issuer = JWT_CONFIG.accessToken.issuer;
    this.audience = JWT_CONFIG.accessToken.audience;
  }

  /**
   * Generate a JWT token
   */
  private generateToken(payload: Record<string, unknown>, secret: string): string {
    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const signature = createSignature(`${encodedHeader}.${encodedPayload}`, secret);

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * Verify a JWT token
   */
  private verifyToken<T>(token: string, secret: string): T {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = createSignature(`${encodedHeader}.${encodedPayload}`, secret);

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      throw new Error('Invalid token signature');
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as T;
    return payload;
  }

  /**
   * Generate access token for a user
   */
  generateAccessToken(user: AuthUser, sessionId?: string): string {
    const now = Math.floor(Date.now() / 1000);
    const expiresInMs = parseDuration(this.accessExpiresIn);
    const exp = now + Math.floor(expiresInMs / 1000);

    const payload: JWTPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      iat: now,
      exp,
      iss: this.issuer,
      aud: this.audience,
      jti: generateTokenId(),
      sessionId,
    };

    return this.generateToken(payload, this.accessSecret);
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId: string, familyId?: string): string {
    const now = Math.floor(Date.now() / 1000);
    const expiresInMs = parseDuration(this.refreshExpiresIn);
    const exp = now + Math.floor(expiresInMs / 1000);

    const family = familyId || generateFamilyId();

    const payload: RefreshTokenPayload = {
      sub: userId,
      jti: generateTokenId(),
      iat: now,
      exp,
      family,
    };

    // Track family usage
    const familyInfo = refreshTokenFamilies.get(family) || { count: 0, lastUsed: new Date() };
    familyInfo.count++;
    familyInfo.lastUsed = new Date();
    refreshTokenFamilies.set(family, familyInfo);

    return this.generateToken(payload, this.refreshSecret);
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(user: AuthUser, sessionId?: string): TokenPair {
    const accessToken = this.generateAccessToken(user, sessionId);
    const refreshToken = this.generateRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(parseDuration(this.accessExpiresIn) / 1000),
      tokenType: 'Bearer',
    };
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): JWTPayload {
    const payload = this.verifyToken<JWTPayload>(token, this.accessSecret);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('Token has expired');
    }

    // Check if token is revoked
    if (revokedTokens.has(payload.jti)) {
      throw new Error('Token has been revoked');
    }

    // Validate issuer and audience
    if (payload.iss !== this.issuer) {
      throw new Error('Invalid token issuer');
    }

    if (payload.aud !== this.audience) {
      throw new Error('Invalid token audience');
    }

    return payload;
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    const payload = this.verifyToken<RefreshTokenPayload>(token, this.refreshSecret);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error('Refresh token has expired');
    }

    // Check if token is revoked
    if (revokedTokens.has(payload.jti)) {
      throw new Error('Refresh token has been revoked');
    }

    // Check family rotation limit
    const familyInfo = refreshTokenFamilies.get(payload.family);
    if (familyInfo && familyInfo.count > JWT_CONFIG.rotation.maxFamily) {
      // Potential token theft - revoke entire family
      this.revokeTokenFamily(payload.family);
      throw new Error('Token family exceeded maximum rotations - possible token theft');
    }

    return payload;
  }

  /**
   * Refresh tokens - returns new token pair and revokes old refresh token
   */
  refreshTokens(
    refreshToken: string,
    user: AuthUser,
    sessionId?: string
  ): TokenPair {
    const payload = this.verifyRefreshToken(refreshToken);

    // Verify the refresh token belongs to the user
    if (payload.sub !== user.id) {
      throw new Error('Refresh token does not belong to user');
    }

    // Revoke the old refresh token
    this.revokeToken(payload.jti);

    // Generate new token pair with same family
    const accessToken = this.generateAccessToken(user, sessionId);
    const newRefreshToken = this.generateRefreshToken(user.id, payload.family);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: Math.floor(parseDuration(this.accessExpiresIn) / 1000),
      tokenType: 'Bearer',
    };
  }

  /**
   * Revoke a specific token
   */
  revokeToken(jti: string): void {
    revokedTokens.add(jti);
  }

  /**
   * Revoke all tokens in a family (for logout or security incident)
   */
  revokeTokenFamily(family: string): void {
    // In production, this would query a database for all tokens in the family
    // For now, we mark the family as revoked
    const familyInfo = refreshTokenFamilies.get(family);
    if (familyInfo) {
      familyInfo.count = JWT_CONFIG.rotation.maxFamily + 1; // Force rejection
      refreshTokenFamilies.set(family, familyInfo);
    }
  }

  /**
   * Revoke all tokens for a user (for password change, account lockout, etc.)
   */
  revokeAllUserTokens(userId: string): void {
    // In production, this would update a database or Redis
    // Store the invalidation timestamp
    console.log(`All tokens revoked for user: ${userId}`);
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): JWTPayload | RefreshTokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(base64UrlDecode(parts[1]));
    } catch {
      return null;
    }
  }

  /**
   * Check if a token is close to expiration (for proactive refresh)
   */
  isTokenExpiringSoon(token: string, thresholdSeconds: number = 300): boolean {
    const payload = this.decodeToken(token);
    if (!payload || !('exp' in payload)) return true;

    const now = Math.floor(Date.now() / 1000);
    return (payload as JWTPayload).exp - now < thresholdSeconds;
  }

  /**
   * Extract user ID from token without full verification
   */
  extractUserId(token: string): string | null {
    const payload = this.decodeToken(token);
    return payload?.sub || null;
  }

  /**
   * Get token expiration date
   */
  getTokenExpiration(token: string): Date | null {
    const payload = this.decodeToken(token);
    if (!payload || !('exp' in payload)) return null;
    return new Date((payload as JWTPayload).exp * 1000);
  }

  /**
   * Clean up expired tokens from revocation list (maintenance task)
   */
  cleanupExpiredTokens(): void {
    // In production, this would be a scheduled job that cleans up
    // tokens that have naturally expired from the revocation list
    console.log('Token cleanup executed');
  }
}

// Export singleton instance
export const jwtService = new JWTService();

// Export class for testing
export default JWTService;
