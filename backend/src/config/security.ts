/**
 * Security Configuration Constants
 * Centralized security settings for the Funding Application Platform
 * Aligned with PRD Section 12: Security, Privacy & Compliance
 */

import { PasswordPolicy, SecurityHeadersConfig, CORSConfig } from '../types/security.types';

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * JWT Configuration
 */
export const JWT_CONFIG = {
  // Access token settings
  accessToken: {
    secret: process.env.JWT_ACCESS_SECRET || 'access-secret-change-in-production',
    expiresIn: isProduction ? '15m' : '1h', // 15 minutes in production, 1 hour in dev
    algorithm: 'HS256' as const,
    issuer: process.env.JWT_ISSUER || 'funding-platform',
    audience: process.env.JWT_AUDIENCE || 'funding-platform-api',
  },

  // Refresh token settings
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-change-in-production',
    expiresIn: '7d', // 7 days
    algorithm: 'HS256' as const,
  },

  // Token rotation settings
  rotation: {
    enabled: true,
    reuseWindow: 10, // seconds - window for refresh token reuse detection
    maxFamily: 5, // Max tokens in a family before forced re-authentication
  },
};

/**
 * Password Policy Configuration
 * Aligned with PRD 12.1: Strong password policy
 */
export const PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventReuse: 5, // Prevent reuse of last 5 passwords
  maxAge: 90, // Password expires after 90 days
};

/**
 * Bcrypt Configuration
 */
export const BCRYPT_CONFIG = {
  saltRounds: isProduction ? 12 : 10, // Higher rounds in production
};

/**
 * Session Configuration
 * Aligned with PRD 12.1: 30 minutes inactivity timeout
 */
export const SESSION_CONFIG = {
  inactivityTimeout: 30 * 60 * 1000, // 30 minutes in milliseconds
  absoluteTimeout: 12 * 60 * 60 * 1000, // 12 hours absolute maximum
  extendOnActivity: true,
  cookieName: 'funding_session',
  secure: isProduction, // HTTPS only in production
  sameSite: 'strict' as const,
  httpOnly: true,
};

/**
 * Rate Limiting Configuration
 * Aligned with PRD 13.2: Rate limiting to prevent abuse
 */
export const RATE_LIMIT_CONFIG = {
  // General API rate limiting
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Authentication endpoints (stricter)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: false,
  },

  // Password reset (prevent enumeration)
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 requests per hour
    message: 'Too many password reset requests, please try again later.',
  },

  // File upload (prevent abuse)
  fileUpload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 uploads per hour
    message: 'Too many file uploads, please try again later.',
  },

  // Export requests (resource intensive)
  export: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 exports per hour
    message: 'Too many export requests, please try again later.',
  },
};

/**
 * CORS Configuration
 * Aligned with PRD 15.3: UK/EU hosting
 */
export const CORS_CONFIG: CORSConfig = {
  allowedOrigins: process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-CSRF-Token',
    'X-Request-ID',
    'Accept',
    'Origin',
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Request-ID',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * Security Headers Configuration (Helmet)
 */
export const SECURITY_HEADERS_CONFIG: SecurityHeadersConfig = {
  contentSecurityPolicy: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Consider removing unsafe-inline in production
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join('; '),
  xFrameOptions: 'DENY',
  xContentTypeOptions: 'nosniff',
  xXssProtection: '1; mode=block',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'interest-cohort=()',
  ].join(', '),
};

/**
 * CSRF Configuration
 */
export const CSRF_CONFIG = {
  tokenLength: 32,
  headerName: 'X-CSRF-Token',
  cookieName: 'csrf_token',
  secure: isProduction,
  sameSite: 'strict' as const,
  httpOnly: false, // Must be readable by JavaScript
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * File Upload Security Configuration
 * Aligned with PRD NFR-004: Support uploads up to 50MB
 */
export const FILE_UPLOAD_CONFIG = {
  maxFileSize: 50 * 1024 * 1024, // 50MB
  maxFiles: 10, // Maximum files per request

  // Allowed MIME types per PRD FR-002
  allowedMimeTypes: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'application/zip',
  ],

  // Allowed extensions
  allowedExtensions: [
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.mp4',
    '.mov',
    '.zip',
  ],

  // Virus scanning
  virusScan: {
    enabled: isProduction,
    timeout: 30000, // 30 seconds
    quarantinePath: '/tmp/quarantine',
  },
};

/**
 * Sanitization Configuration
 */
export const SANITIZE_CONFIG = {
  // HTML sanitization options
  html: {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    allowedAttributes: {
      a: ['href', 'title', 'target'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  },

  // Input length limits
  maxLengths: {
    name: 255,
    email: 254,
    description: 10000,
    comment: 5000,
    shortText: 500,
  },
};

/**
 * Account Lockout Configuration
 */
export const LOCKOUT_CONFIG = {
  maxFailedAttempts: 5,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  resetFailedAttemptsAfter: 60 * 60 * 1000, // 1 hour
};

/**
 * Audit Log Configuration
 * Aligned with PRD 12.4: Audit & Logging requirements
 */
export const AUDIT_CONFIG = {
  // Events that must always be logged
  mandatoryEvents: [
    'auth.login',
    'auth.login_failed',
    'auth.logout',
    'auth.password_change',
    'application.submit',
    'file.download',
    'assessment.submit',
    'call.create',
    'call.status_change',
    'user.role_change',
    'gdpr.export',
    'gdpr.delete',
  ],

  // Retention period (days)
  retentionDays: isProduction ? 2555 : 90, // 7 years in production (per PRD NFR-013)

  // Log sensitive data (should be false in production)
  logSensitiveData: !isProduction,
};

/**
 * GDPR Configuration
 * Aligned with PRD 12.3: GDPR Compliance
 */
export const GDPR_CONFIG = {
  // Default data retention (days)
  defaultRetentionDays: 2555, // 7 years per PRD NFR-013

  // Data export settings
  export: {
    format: 'json' as const,
    maxProcessingTime: 24 * 60 * 60 * 1000, // 24 hours
    downloadLinkValidityHours: 72,
  },

  // Data deletion settings
  deletion: {
    gracePeriodDays: 30, // 30 days to cancel deletion request
    anonymizeInsteadOfDelete: true, // Keep anonymized records for audit
  },

  // Consent version - increment when privacy policy changes
  consentVersion: '1.0',
};

/**
 * Role-Based Access Control Configuration
 * Aligned with PRD Section 4.1: Role Definitions
 */
export const RBAC_CONFIG = {
  // Role hierarchy (higher index = more permissions)
  roleHierarchy: {
    applicant: 0,
    assessor: 1,
    coordinator: 2,
    scheme_owner: 3,
  },

  // Whether to allow role inheritance
  inheritPermissions: false,

  // Super admin role (for emergency access)
  superAdminRole: 'coordinator', // Coordinators have highest operational access
};

/**
 * Security event notification
 */
export const SECURITY_NOTIFICATIONS = {
  // Email notifications for security events
  notifyOnEvents: [
    'auth.login_failed', // After threshold
    'auth.password_change',
    'auth.mfa_disable',
    'user.role_change',
    'system.rate_limit_exceeded',
  ],

  // Threshold for failed login notifications
  failedLoginNotificationThreshold: 3,

  // Admin email for security alerts
  adminEmail: process.env.SECURITY_ADMIN_EMAIL || 'security@example.com',
};

/**
 * Export all configs as a single object for convenience
 */
export const SECURITY_CONFIG = {
  jwt: JWT_CONFIG,
  password: PASSWORD_POLICY,
  bcrypt: BCRYPT_CONFIG,
  session: SESSION_CONFIG,
  rateLimit: RATE_LIMIT_CONFIG,
  cors: CORS_CONFIG,
  headers: SECURITY_HEADERS_CONFIG,
  csrf: CSRF_CONFIG,
  fileUpload: FILE_UPLOAD_CONFIG,
  sanitize: SANITIZE_CONFIG,
  lockout: LOCKOUT_CONFIG,
  audit: AUDIT_CONFIG,
  gdpr: GDPR_CONFIG,
  rbac: RBAC_CONFIG,
  notifications: SECURITY_NOTIFICATIONS,
  isProduction,
  isTest,
};

export default SECURITY_CONFIG;
