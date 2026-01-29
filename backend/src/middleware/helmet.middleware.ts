/**
 * Security Headers Middleware (Helmet-like)
 * Sets security-related HTTP headers
 * Aligned with PRD 12: Security requirements
 */

import { SECURITY_HEADERS_CONFIG } from '../config/security';
import { SecurityHeadersConfig } from '../types/security.types';

/**
 * Response interface for security headers middleware
 */
interface SecurityResponse {
  setHeader: (name: string, value: string) => void;
  removeHeader: (name: string) => void;
}

/**
 * Request interface
 */
interface SecurityRequest {
  secure?: boolean;
  headers: {
    'x-forwarded-proto'?: string;
    [key: string]: string | string[] | undefined;
  };
}

/**
 * Security headers middleware options
 */
export interface SecurityHeadersOptions {
  contentSecurityPolicy?: string | false;
  crossOriginEmbedderPolicy?: string | false;
  crossOriginOpenerPolicy?: string | false;
  crossOriginResourcePolicy?: string | false;
  dnsPrefetchControl?: boolean;
  expectCt?: { maxAge: number; enforce?: boolean; reportUri?: string } | false;
  frameguard?: 'deny' | 'sameorigin' | false;
  hidePoweredBy?: boolean;
  hsts?: { maxAge: number; includeSubDomains?: boolean; preload?: boolean } | false;
  ieNoOpen?: boolean;
  noSniff?: boolean;
  originAgentCluster?: boolean;
  permittedCrossDomainPolicies?: 'none' | 'master-only' | 'by-content-type' | 'all' | false;
  referrerPolicy?: string | false;
  xssFilter?: boolean;
  permissionsPolicy?: string | false;
}

/**
 * Check if request is over HTTPS
 */
function isSecureRequest(req: SecurityRequest): boolean {
  return req.secure === true || req.headers['x-forwarded-proto'] === 'https';
}

/**
 * Set Content-Security-Policy header
 */
function setContentSecurityPolicy(res: SecurityResponse, policy: string | false): void {
  if (policy === false) return;
  res.setHeader('Content-Security-Policy', policy);
}

/**
 * Set X-Frame-Options header
 */
function setFrameGuard(res: SecurityResponse, option: 'deny' | 'sameorigin' | false): void {
  if (option === false) return;
  res.setHeader('X-Frame-Options', option.toUpperCase());
}

/**
 * Set Strict-Transport-Security header
 */
function setHSTS(
  res: SecurityResponse,
  req: SecurityRequest,
  options: { maxAge: number; includeSubDomains?: boolean; preload?: boolean } | false
): void {
  if (options === false) return;

  // Only set HSTS for HTTPS connections
  if (!isSecureRequest(req)) return;

  let value = `max-age=${options.maxAge}`;
  if (options.includeSubDomains) value += '; includeSubDomains';
  if (options.preload) value += '; preload';

  res.setHeader('Strict-Transport-Security', value);
}

/**
 * Set X-Content-Type-Options header
 */
function setNoSniff(res: SecurityResponse, enabled: boolean): void {
  if (!enabled) return;
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

/**
 * Set X-XSS-Protection header
 */
function setXSSFilter(res: SecurityResponse, enabled: boolean): void {
  if (!enabled) return;
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

/**
 * Set Referrer-Policy header
 */
function setReferrerPolicy(res: SecurityResponse, policy: string | false): void {
  if (policy === false) return;
  res.setHeader('Referrer-Policy', policy);
}

/**
 * Set Permissions-Policy header
 */
function setPermissionsPolicy(res: SecurityResponse, policy: string | false): void {
  if (policy === false) return;
  res.setHeader('Permissions-Policy', policy);
}

/**
 * Set X-DNS-Prefetch-Control header
 */
function setDNSPrefetchControl(res: SecurityResponse, enabled: boolean): void {
  res.setHeader('X-DNS-Prefetch-Control', enabled ? 'on' : 'off');
}

/**
 * Set X-Download-Options header (IE)
 */
function setIENoOpen(res: SecurityResponse, enabled: boolean): void {
  if (!enabled) return;
  res.setHeader('X-Download-Options', 'noopen');
}

/**
 * Set X-Permitted-Cross-Domain-Policies header
 */
function setCrossDomainPolicies(
  res: SecurityResponse,
  policy: 'none' | 'master-only' | 'by-content-type' | 'all' | false
): void {
  if (policy === false) return;
  res.setHeader('X-Permitted-Cross-Domain-Policies', policy);
}

/**
 * Set Cross-Origin-Embedder-Policy header
 */
function setCrossOriginEmbedderPolicy(res: SecurityResponse, policy: string | false): void {
  if (policy === false) return;
  res.setHeader('Cross-Origin-Embedder-Policy', policy);
}

/**
 * Set Cross-Origin-Opener-Policy header
 */
function setCrossOriginOpenerPolicy(res: SecurityResponse, policy: string | false): void {
  if (policy === false) return;
  res.setHeader('Cross-Origin-Opener-Policy', policy);
}

/**
 * Set Cross-Origin-Resource-Policy header
 */
function setCrossOriginResourcePolicy(res: SecurityResponse, policy: string | false): void {
  if (policy === false) return;
  res.setHeader('Cross-Origin-Resource-Policy', policy);
}

/**
 * Set Origin-Agent-Cluster header
 */
function setOriginAgentCluster(res: SecurityResponse, enabled: boolean): void {
  if (!enabled) return;
  res.setHeader('Origin-Agent-Cluster', '?1');
}

/**
 * Remove X-Powered-By header
 */
function hidePoweredBy(res: SecurityResponse, hide: boolean): void {
  if (!hide) return;
  res.removeHeader('X-Powered-By');
}

/**
 * Create security headers middleware
 */
export function createSecurityHeadersMiddleware(options?: SecurityHeadersOptions) {
  const config: Required<SecurityHeadersOptions> = {
    contentSecurityPolicy: SECURITY_HEADERS_CONFIG.contentSecurityPolicy,
    crossOriginEmbedderPolicy: 'require-corp',
    crossOriginOpenerPolicy: 'same-origin',
    crossOriginResourcePolicy: 'same-origin',
    dnsPrefetchControl: false,
    expectCt: false,
    frameguard: SECURITY_HEADERS_CONFIG.xFrameOptions === 'DENY' ? 'deny' : 'sameorigin',
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: 'none',
    referrerPolicy: SECURITY_HEADERS_CONFIG.referrerPolicy,
    xssFilter: true,
    permissionsPolicy: SECURITY_HEADERS_CONFIG.permissionsPolicy,
    ...options,
  };

  return function securityHeadersMiddleware(
    req: SecurityRequest,
    res: SecurityResponse,
    next: () => void
  ): void {
    // Content Security Policy
    setContentSecurityPolicy(res, config.contentSecurityPolicy);

    // Frame options
    setFrameGuard(res, config.frameguard);

    // HSTS
    setHSTS(res, req, config.hsts);

    // Content type sniffing
    setNoSniff(res, config.noSniff);

    // XSS filter
    setXSSFilter(res, config.xssFilter);

    // Referrer policy
    setReferrerPolicy(res, config.referrerPolicy);

    // Permissions policy
    setPermissionsPolicy(res, config.permissionsPolicy);

    // DNS prefetch control
    setDNSPrefetchControl(res, config.dnsPrefetchControl);

    // IE download options
    setIENoOpen(res, config.ieNoOpen);

    // Cross-domain policies
    setCrossDomainPolicies(res, config.permittedCrossDomainPolicies);

    // Cross-origin policies
    setCrossOriginEmbedderPolicy(res, config.crossOriginEmbedderPolicy);
    setCrossOriginOpenerPolicy(res, config.crossOriginOpenerPolicy);
    setCrossOriginResourcePolicy(res, config.crossOriginResourcePolicy);

    // Origin agent cluster
    setOriginAgentCluster(res, config.originAgentCluster);

    // Hide X-Powered-By
    hidePoweredBy(res, config.hidePoweredBy);

    next();
  };
}

/**
 * Pre-configured middleware with default settings
 */
export const securityHeadersMiddleware = createSecurityHeadersMiddleware();

/**
 * Strict security headers for sensitive endpoints
 */
export const strictSecurityHeadersMiddleware = createSecurityHeadersMiddleware({
  contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'",
  crossOriginEmbedderPolicy: 'require-corp',
  crossOriginOpenerPolicy: 'same-origin',
  crossOriginResourcePolicy: 'same-origin',
  frameguard: 'deny',
});

/**
 * Relaxed security headers for API endpoints that need to embed resources
 */
export const apiSecurityHeadersMiddleware = createSecurityHeadersMiddleware({
  contentSecurityPolicy: false, // APIs typically don't need CSP
  frameguard: false, // APIs don't render in frames
  xssFilter: false, // XSS protection is for HTML pages
  crossOriginResourcePolicy: 'cross-origin', // Allow cross-origin API requests
});

/**
 * Development-friendly security headers
 */
export const developmentSecurityHeadersMiddleware = createSecurityHeadersMiddleware({
  hsts: false, // Don't enforce HTTPS in development
  contentSecurityPolicy: false, // Disable CSP for easier debugging
});

/**
 * Get current security headers configuration
 */
export function getSecurityHeadersConfig(): SecurityHeadersConfig {
  return { ...SECURITY_HEADERS_CONFIG };
}

/**
 * Validate CSP directive
 */
export function validateCSPDirective(directive: string): {
  valid: boolean;
  error?: string;
} {
  const validDirectives = [
    'default-src',
    'script-src',
    'style-src',
    'img-src',
    'connect-src',
    'font-src',
    'object-src',
    'media-src',
    'frame-src',
    'child-src',
    'worker-src',
    'frame-ancestors',
    'form-action',
    'base-uri',
    'manifest-src',
    'upgrade-insecure-requests',
    'block-all-mixed-content',
    'report-uri',
    'report-to',
  ];

  const directiveName = directive.split(' ')[0];

  if (!validDirectives.includes(directiveName)) {
    return {
      valid: false,
      error: `Unknown CSP directive: ${directiveName}`,
    };
  }

  return { valid: true };
}

export default createSecurityHeadersMiddleware;
