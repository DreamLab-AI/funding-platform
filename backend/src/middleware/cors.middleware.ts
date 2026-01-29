/**
 * CORS Middleware
 * Cross-Origin Resource Sharing configuration
 * Aligned with PRD 15.3: UK/EU hosting requirements
 */

import { CORS_CONFIG } from '../config/security';
import { CORSConfig } from '../types/security.types';

/**
 * Request interface for CORS middleware
 */
interface CORSRequest {
  method: string;
  headers: {
    origin?: string;
    'access-control-request-method'?: string;
    'access-control-request-headers'?: string;
    [key: string]: string | string[] | undefined;
  };
}

/**
 * Response interface for CORS middleware
 */
interface CORSResponse {
  setHeader: (name: string, value: string | number | boolean) => void;
  status: (code: number) => { end: () => void };
}

/**
 * CORS middleware options
 */
export interface CORSMiddlewareOptions extends Partial<CORSConfig> {
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) return false;

  // Check for wildcard
  if (allowedOrigins.includes('*')) return true;

  // Check exact match
  if (allowedOrigins.includes(origin)) return true;

  // Check pattern match (e.g., *.example.com)
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      if (origin.endsWith(domain)) {
        // Ensure it's a subdomain match, not just ending with the string
        const prefix = origin.slice(0, origin.length - domain.length);
        if (prefix.endsWith('.') || prefix === 'https://') {
          return true;
        }
      }
    }
  }

  // Check regex patterns
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('/') && allowed.endsWith('/')) {
      const regex = new RegExp(allowed.slice(1, -1));
      if (regex.test(origin)) return true;
    }
  }

  return false;
}

/**
 * Set CORS headers on response
 */
function setCORSHeaders(
  res: CORSResponse,
  origin: string | undefined,
  config: CORSConfig
): void {
  // Access-Control-Allow-Origin
  if (origin && isOriginAllowed(origin, config.allowedOrigins)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    // Vary header is important when origin can change
    res.setHeader('Vary', 'Origin');
  } else if (config.allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  // Access-Control-Allow-Credentials
  if (config.credentials) {
    res.setHeader('Access-Control-Allow-Credentials', true);
  }

  // Access-Control-Expose-Headers
  if (config.exposedHeaders.length > 0) {
    res.setHeader('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));
  }
}

/**
 * Set preflight CORS headers
 */
function setPreflightHeaders(
  res: CORSResponse,
  config: CORSConfig,
  requestMethod?: string,
  requestHeaders?: string
): void {
  // Access-Control-Allow-Methods
  const allowedMethods = requestMethod && config.allowedMethods.includes(requestMethod.toUpperCase())
    ? requestMethod.toUpperCase()
    : config.allowedMethods.join(', ');
  res.setHeader('Access-Control-Allow-Methods', allowedMethods);

  // Access-Control-Allow-Headers
  if (requestHeaders) {
    // Check if all requested headers are allowed
    const requested = requestHeaders.split(',').map((h) => h.trim().toLowerCase());
    const allowed = config.allowedHeaders.map((h) => h.toLowerCase());
    const validHeaders = requested.filter((h) => allowed.includes(h) || h === 'content-type');
    res.setHeader('Access-Control-Allow-Headers', validHeaders.join(', '));
  } else {
    res.setHeader('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));
  }

  // Access-Control-Max-Age
  if (config.maxAge > 0) {
    res.setHeader('Access-Control-Max-Age', config.maxAge);
  }
}

/**
 * Create CORS middleware
 */
export function createCORSMiddleware(options?: CORSMiddlewareOptions) {
  const config: CORSConfig = {
    ...CORS_CONFIG,
    ...options,
  };

  const preflightContinue = options?.preflightContinue ?? false;
  const optionsSuccessStatus = options?.optionsSuccessStatus ?? 204;

  return function corsMiddleware(
    req: CORSRequest,
    res: CORSResponse,
    next: () => void
  ): void {
    const origin = req.headers.origin;

    // Set CORS headers for all requests
    setCORSHeaders(res, origin, config);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      setPreflightHeaders(
        res,
        config,
        req.headers['access-control-request-method'],
        req.headers['access-control-request-headers']
      );

      if (!preflightContinue) {
        res.status(optionsSuccessStatus).end();
        return;
      }
    }

    next();
  };
}

/**
 * CORS validation utility
 */
export function validateCORSOrigin(origin: string | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!origin) {
    return {
      valid: false,
      error: 'Origin header is required',
    };
  }

  if (!isOriginAllowed(origin, CORS_CONFIG.allowedOrigins)) {
    return {
      valid: false,
      error: `Origin ${origin} is not allowed`,
    };
  }

  return { valid: true };
}

/**
 * Add origin to allowed list at runtime (for development)
 */
export function addAllowedOrigin(origin: string): void {
  if (!CORS_CONFIG.allowedOrigins.includes(origin)) {
    CORS_CONFIG.allowedOrigins.push(origin);
  }
}

/**
 * Remove origin from allowed list
 */
export function removeAllowedOrigin(origin: string): void {
  const index = CORS_CONFIG.allowedOrigins.indexOf(origin);
  if (index > -1) {
    CORS_CONFIG.allowedOrigins.splice(index, 1);
  }
}

/**
 * Get current CORS configuration
 */
export function getCORSConfig(): CORSConfig {
  return { ...CORS_CONFIG };
}

/**
 * Pre-configured CORS middleware with default settings
 */
export const corsMiddleware = createCORSMiddleware();

/**
 * Strict CORS middleware (no wildcards, credentials required)
 */
export const strictCORSMiddleware = createCORSMiddleware({
  credentials: true,
  allowedOrigins: CORS_CONFIG.allowedOrigins.filter((o) => o !== '*'),
});

/**
 * Development CORS middleware (allows localhost)
 */
export const developmentCORSMiddleware = createCORSMiddleware({
  allowedOrigins: [
    ...CORS_CONFIG.allowedOrigins,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ],
  credentials: true,
});

export default createCORSMiddleware;
