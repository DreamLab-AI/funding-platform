/**
 * Rate Limiting Middleware
 * Prevents API abuse and brute force attacks
 * Aligned with PRD 13.2: Rate limiting to prevent abuse
 */

import { RATE_LIMIT_CONFIG } from '../config/security';
import { RateLimitInfo } from '../types/security.types';
import { auditService } from '../security/audit.service';
import { AuditAction, AuditTargetType } from '../types/security.types';

/**
 * Rate limit entry
 */
interface RateLimitEntry {
  count: number;
  resetAt: Date;
  firstRequest: Date;
}

/**
 * In-memory rate limit storage (use Redis in production)
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit configuration type
 */
interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}

/**
 * Request context for middleware
 */
interface RequestContext {
  ip: string;
  userId?: string;
  path: string;
  method: string;
  userAgent?: string;
}

/**
 * Rate limit result
 */
interface RateLimitResult {
  allowed: boolean;
  info: RateLimitInfo;
  error?: string;
}

/**
 * Rate Limiter class
 */
export class RateLimiter {
  private readonly defaultConfig: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.defaultConfig = {
      ...RATE_LIMIT_CONFIG.general,
      ...config,
    };
  }

  /**
   * Generate a unique key for rate limiting
   */
  private generateKey(context: RequestContext, keyType: 'ip' | 'user' | 'endpoint'): string {
    switch (keyType) {
      case 'ip':
        return `ratelimit:ip:${context.ip}`;
      case 'user':
        return `ratelimit:user:${context.userId || context.ip}`;
      case 'endpoint':
        return `ratelimit:endpoint:${context.ip}:${context.method}:${context.path}`;
      default:
        return `ratelimit:ip:${context.ip}`;
    }
  }

  /**
   * Check rate limit
   */
  check(
    context: RequestContext,
    config: RateLimitConfig = this.defaultConfig,
    keyType: 'ip' | 'user' | 'endpoint' = 'ip'
  ): RateLimitResult {
    const key = this.generateKey(context, keyType);
    const now = new Date();

    let entry = rateLimitStore.get(key);

    // Initialize or reset if window expired
    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 0,
        resetAt: new Date(now.getTime() + config.windowMs),
        firstRequest: now,
      };
    }

    // Increment counter
    entry.count++;
    rateLimitStore.set(key, entry);

    const remaining = Math.max(0, config.max - entry.count);
    const info: RateLimitInfo = {
      limit: config.max,
      remaining,
      reset: entry.resetAt,
      retryAfter: remaining === 0 ? Math.ceil((entry.resetAt.getTime() - now.getTime()) / 1000) : undefined,
    };

    if (entry.count > config.max) {
      // Log rate limit exceeded
      auditService.logRateLimitExceeded(
        {
          ipAddress: context.ip,
          userAgent: context.userAgent,
        },
        context.path,
        config.max
      );

      return {
        allowed: false,
        info,
        error: config.message,
      };
    }

    return {
      allowed: true,
      info,
    };
  }

  /**
   * Decrement counter (for skipping successful requests)
   */
  decrement(context: RequestContext, keyType: 'ip' | 'user' | 'endpoint' = 'ip'): void {
    const key = this.generateKey(context, keyType);
    const entry = rateLimitStore.get(key);

    if (entry && entry.count > 0) {
      entry.count--;
      rateLimitStore.set(key, entry);
    }
  }

  /**
   * Reset rate limit for a key
   */
  reset(context: RequestContext, keyType: 'ip' | 'user' | 'endpoint' = 'ip'): void {
    const key = this.generateKey(context, keyType);
    rateLimitStore.delete(key);
  }

  /**
   * Get current rate limit info without incrementing
   */
  getInfo(
    context: RequestContext,
    config: RateLimitConfig = this.defaultConfig,
    keyType: 'ip' | 'user' | 'endpoint' = 'ip'
  ): RateLimitInfo {
    const key = this.generateKey(context, keyType);
    const entry = rateLimitStore.get(key);
    const now = new Date();

    if (!entry || now >= entry.resetAt) {
      return {
        limit: config.max,
        remaining: config.max,
        reset: new Date(now.getTime() + config.windowMs),
      };
    }

    return {
      limit: config.max,
      remaining: Math.max(0, config.max - entry.count),
      reset: entry.resetAt,
    };
  }

  /**
   * Clean up expired entries (maintenance task)
   */
  cleanup(): number {
    const now = new Date();
    let removed = 0;

    for (const [key, entry] of rateLimitStore.entries()) {
      if (now >= entry.resetAt) {
        rateLimitStore.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * Pre-configured rate limiters
 */
export const generalRateLimiter = new RateLimiter(RATE_LIMIT_CONFIG.general);
export const authRateLimiter = new RateLimiter(RATE_LIMIT_CONFIG.auth);
export const passwordResetRateLimiter = new RateLimiter(RATE_LIMIT_CONFIG.passwordReset);
export const fileUploadRateLimiter = new RateLimiter(RATE_LIMIT_CONFIG.fileUpload);
export const exportRateLimiter = new RateLimiter(RATE_LIMIT_CONFIG.export);

/**
 * Express-compatible middleware factory
 */
export function createRateLimitMiddleware(
  limiter: RateLimiter,
  config?: Partial<RateLimitConfig>,
  keyType: 'ip' | 'user' | 'endpoint' = 'ip'
) {
  return function rateLimitMiddleware(
    req: {
      ip: string;
      user?: { id: string };
      path: string;
      method: string;
      headers: Record<string, string | string[] | undefined>;
    },
    res: {
      status: (code: number) => { json: (body: unknown) => void };
      setHeader: (name: string, value: string | number) => void;
    },
    next: () => void
  ): void {
    const context: RequestContext = {
      ip: req.ip,
      userId: req.user?.id,
      path: req.path,
      method: req.method,
      userAgent: Array.isArray(req.headers['user-agent'])
        ? req.headers['user-agent'][0]
        : req.headers['user-agent'],
    };

    const effectiveConfig: RateLimitConfig = {
      ...RATE_LIMIT_CONFIG.general,
      ...config,
    };

    const result = limiter.check(context, effectiveConfig, keyType);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', result.info.limit);
    res.setHeader('X-RateLimit-Remaining', result.info.remaining);
    res.setHeader('X-RateLimit-Reset', result.info.reset.toISOString());

    if (!result.allowed) {
      res.setHeader('Retry-After', result.info.retryAfter || 60);
      res.status(429).json({
        error: 'Too Many Requests',
        message: result.error,
        retryAfter: result.info.retryAfter,
      });
      return;
    }

    next();
  };
}

/**
 * Middleware for authentication endpoints
 */
export const authRateLimitMiddleware = createRateLimitMiddleware(
  authRateLimiter,
  RATE_LIMIT_CONFIG.auth,
  'ip'
);

/**
 * Middleware for password reset
 */
export const passwordResetRateLimitMiddleware = createRateLimitMiddleware(
  passwordResetRateLimiter,
  RATE_LIMIT_CONFIG.passwordReset,
  'ip'
);

/**
 * Middleware for file uploads
 */
export const fileUploadRateLimitMiddleware = createRateLimitMiddleware(
  fileUploadRateLimiter,
  RATE_LIMIT_CONFIG.fileUpload,
  'user'
);

/**
 * Middleware for exports
 */
export const exportRateLimitMiddleware = createRateLimitMiddleware(
  exportRateLimiter,
  RATE_LIMIT_CONFIG.export,
  'user'
);

/**
 * General API rate limit middleware
 */
export const generalRateLimitMiddleware = createRateLimitMiddleware(
  generalRateLimiter,
  RATE_LIMIT_CONFIG.general,
  'ip'
);

// Export class for testing
export default RateLimiter;
