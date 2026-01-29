/**
 * CSRF Service
 * Cross-Site Request Forgery protection
 * Implements double-submit cookie pattern
 */

import * as crypto from 'crypto';
import { CSRF_CONFIG } from '../config/security';
import { CSRFToken } from '../types/security.types';

/**
 * In-memory token storage (replace with Redis in production)
 */
const tokenStore = new Map<string, CSRFToken>();

/**
 * CSRF Service class
 */
export class CSRFService {
  private readonly tokenLength: number;
  private readonly headerName: string;
  private readonly cookieName: string;
  private readonly maxAge: number;

  constructor() {
    this.tokenLength = CSRF_CONFIG.tokenLength;
    this.headerName = CSRF_CONFIG.headerName;
    this.cookieName = CSRF_CONFIG.cookieName;
    this.maxAge = CSRF_CONFIG.maxAge;
  }

  /**
   * Generate a new CSRF token
   */
  generateToken(sessionId?: string): CSRFToken {
    const token = crypto.randomBytes(this.tokenLength).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.maxAge);

    const csrfToken: CSRFToken = {
      token,
      createdAt: now,
      expiresAt,
    };

    // Store token with session association if provided
    const key = sessionId ? `${sessionId}:${token}` : token;
    tokenStore.set(key, csrfToken);

    return csrfToken;
  }

  /**
   * Validate a CSRF token
   */
  validateToken(token: string, sessionId?: string): boolean {
    if (!token || token.length !== this.tokenLength * 2) {
      return false;
    }

    const key = sessionId ? `${sessionId}:${token}` : token;
    const storedToken = tokenStore.get(key);

    if (!storedToken) {
      // Try without session prefix for backwards compatibility
      const tokenOnly = tokenStore.get(token);
      if (!tokenOnly) {
        return false;
      }
      return this.isTokenValid(tokenOnly);
    }

    return this.isTokenValid(storedToken);
  }

  /**
   * Check if token is valid and not expired
   */
  private isTokenValid(csrfToken: CSRFToken): boolean {
    const now = new Date();
    return csrfToken.expiresAt > now;
  }

  /**
   * Revoke a CSRF token
   */
  revokeToken(token: string, sessionId?: string): void {
    const key = sessionId ? `${sessionId}:${token}` : token;
    tokenStore.delete(key);
    // Also try without session prefix
    tokenStore.delete(token);
  }

  /**
   * Revoke all tokens for a session
   */
  revokeSessionTokens(sessionId: string): void {
    for (const key of tokenStore.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        tokenStore.delete(key);
      }
    }
  }

  /**
   * Generate token and cookie options for response
   */
  createTokenResponse(sessionId?: string): {
    token: string;
    cookieOptions: {
      name: string;
      value: string;
      options: {
        maxAge: number;
        httpOnly: boolean;
        secure: boolean;
        sameSite: 'strict' | 'lax' | 'none';
        path: string;
      };
    };
  } {
    const csrfToken = this.generateToken(sessionId);

    return {
      token: csrfToken.token,
      cookieOptions: {
        name: this.cookieName,
        value: csrfToken.token,
        options: {
          maxAge: this.maxAge,
          httpOnly: CSRF_CONFIG.httpOnly,
          secure: CSRF_CONFIG.secure,
          sameSite: CSRF_CONFIG.sameSite,
          path: '/',
        },
      },
    };
  }

  /**
   * Extract token from request (header or body)
   */
  extractToken(headers: Record<string, string | string[] | undefined>, body?: Record<string, unknown>): string | null {
    // Check header first (preferred)
    const headerToken = headers[this.headerName.toLowerCase()] || headers[this.headerName];
    if (headerToken) {
      return Array.isArray(headerToken) ? headerToken[0] : headerToken;
    }

    // Check body for _csrf field
    if (body && typeof body._csrf === 'string') {
      return body._csrf;
    }

    return null;
  }

  /**
   * Extract token from cookie
   */
  extractCookieToken(cookies: Record<string, string>): string | null {
    return cookies[this.cookieName] || null;
  }

  /**
   * Validate double-submit pattern (cookie + header/body must match)
   */
  validateDoubleSubmit(
    cookieToken: string | null,
    requestToken: string | null,
    sessionId?: string
  ): { valid: boolean; error?: string } {
    if (!cookieToken) {
      return { valid: false, error: 'CSRF cookie missing' };
    }

    if (!requestToken) {
      return { valid: false, error: 'CSRF token missing from request' };
    }

    // Constant-time comparison to prevent timing attacks
    if (cookieToken.length !== requestToken.length) {
      return { valid: false, error: 'CSRF token mismatch' };
    }

    const tokensMatch = crypto.timingSafeEqual(
      Buffer.from(cookieToken),
      Buffer.from(requestToken)
    );

    if (!tokensMatch) {
      return { valid: false, error: 'CSRF token mismatch' };
    }

    // Validate token is in store and not expired
    if (!this.validateToken(cookieToken, sessionId)) {
      return { valid: false, error: 'CSRF token expired or invalid' };
    }

    return { valid: true };
  }

  /**
   * Clean up expired tokens (maintenance task)
   */
  cleanupExpiredTokens(): number {
    const now = new Date();
    let removed = 0;

    for (const [key, token] of tokenStore.entries()) {
      if (token.expiresAt <= now) {
        tokenStore.delete(key);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Get configuration for client-side usage
   */
  getClientConfig(): {
    headerName: string;
    cookieName: string;
  } {
    return {
      headerName: this.headerName,
      cookieName: this.cookieName,
    };
  }

  /**
   * Check if request method requires CSRF validation
   */
  requiresValidation(method: string): boolean {
    // Safe methods don't require CSRF validation
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    return !safeMethods.includes(method.toUpperCase());
  }

  /**
   * Get the number of active tokens
   */
  getActiveTokenCount(): number {
    return tokenStore.size;
  }
}

// Export singleton instance
export const csrfService = new CSRFService();

// Export class for testing
export default CSRFService;
