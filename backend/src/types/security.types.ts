/**
 * Security Types for Funding Application Platform
 * Defines all security-related interfaces and enums
 */

// User Roles as defined in PRD Section 4.1
export enum UserRole {
  APPLICANT = 'applicant',
  ASSESSOR = 'assessor',
  COORDINATOR = 'coordinator',
  SCHEME_OWNER = 'scheme_owner',
}

// Permission actions for RBAC
export enum Permission {
  // Application permissions
  APPLICATION_CREATE = 'application:create',
  APPLICATION_READ_OWN = 'application:read:own',
  APPLICATION_READ_ALL = 'application:read:all',
  APPLICATION_UPDATE_OWN = 'application:update:own',
  APPLICATION_DELETE_OWN = 'application:delete:own',
  APPLICATION_SUBMIT = 'application:submit',
  APPLICATION_WITHDRAW = 'application:withdraw',
  APPLICATION_REOPEN = 'application:reopen',
  APPLICATION_EXPORT = 'application:export',
  APPLICATION_DOWNLOAD_FILES = 'application:download:files',

  // Assessment permissions
  ASSESSMENT_CREATE = 'assessment:create',
  ASSESSMENT_READ_OWN = 'assessment:read:own',
  ASSESSMENT_READ_ALL = 'assessment:read:all',
  ASSESSMENT_UPDATE_OWN = 'assessment:update:own',
  ASSESSMENT_SUBMIT = 'assessment:submit',
  ASSESSMENT_RETURN = 'assessment:return',

  // Call management permissions
  CALL_CREATE = 'call:create',
  CALL_READ = 'call:read',
  CALL_UPDATE = 'call:update',
  CALL_DELETE = 'call:delete',
  CALL_CLONE = 'call:clone',
  CALL_CONFIGURE = 'call:configure',

  // Assessor pool permissions
  ASSESSOR_POOL_MANAGE = 'assessor_pool:manage',
  ASSESSOR_ASSIGN = 'assessor:assign',
  ASSESSOR_REMOVE = 'assessor:remove',

  // Results permissions
  RESULTS_VIEW_MASTER = 'results:view:master',
  RESULTS_EXPORT = 'results:export',

  // User management permissions
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',

  // Audit permissions
  AUDIT_READ = 'audit:read',

  // GDPR permissions
  GDPR_EXPORT_DATA = 'gdpr:export:data',
  GDPR_DELETE_DATA = 'gdpr:delete:data',
}

// JWT Token payload
export interface JWTPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
  permissions: Permission[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  jti: string; // JWT ID for revocation
  sessionId?: string;
}

// Refresh token payload
export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
  family: string; // Token family for rotation
}

// Token pair response
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

// User for authentication
export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  mfaSecret?: string;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLoginAt?: Date;
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Password policy
export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventReuse: number; // Number of previous passwords to check
  maxAge: number; // Days before password expires
}

// Password validation result
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'fair' | 'good' | 'strong';
}

// Audit log entry
export interface AuditLogEntry {
  eventId: string;
  actorId: string;
  actorRole: UserRole;
  actorEmail?: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

// Audit actions
export enum AuditAction {
  // Authentication
  LOGIN = 'auth.login',
  LOGIN_FAILED = 'auth.login_failed',
  LOGOUT = 'auth.logout',
  PASSWORD_CHANGE = 'auth.password_change',
  PASSWORD_RESET_REQUEST = 'auth.password_reset_request',
  PASSWORD_RESET_COMPLETE = 'auth.password_reset_complete',
  MFA_ENABLE = 'auth.mfa_enable',
  MFA_DISABLE = 'auth.mfa_disable',
  TOKEN_REFRESH = 'auth.token_refresh',
  TOKEN_REVOKE = 'auth.token_revoke',

  // Application
  APPLICATION_CREATE = 'application.create',
  APPLICATION_UPDATE = 'application.update',
  APPLICATION_SUBMIT = 'application.submit',
  APPLICATION_WITHDRAW = 'application.withdraw',
  APPLICATION_REOPEN = 'application.reopen',
  APPLICATION_VIEW = 'application.view',
  APPLICATION_EXPORT = 'application.export',

  // File operations
  FILE_UPLOAD = 'file.upload',
  FILE_DOWNLOAD = 'file.download',
  FILE_DELETE = 'file.delete',
  FILE_SCAN = 'file.scan',

  // Assessment
  ASSESSMENT_CREATE = 'assessment.create',
  ASSESSMENT_UPDATE = 'assessment.update',
  ASSESSMENT_SUBMIT = 'assessment.submit',
  ASSESSMENT_RETURN = 'assessment.return',
  ASSESSMENT_VIEW = 'assessment.view',

  // Assignment
  ASSIGNMENT_CREATE = 'assignment.create',
  ASSIGNMENT_DELETE = 'assignment.delete',
  ASSIGNMENT_BULK = 'assignment.bulk',

  // Call management
  CALL_CREATE = 'call.create',
  CALL_UPDATE = 'call.update',
  CALL_DELETE = 'call.delete',
  CALL_STATUS_CHANGE = 'call.status_change',
  CALL_CLONE = 'call.clone',

  // Assessor pool
  ASSESSOR_ADD = 'assessor.add',
  ASSESSOR_REMOVE = 'assessor.remove',
  ASSESSOR_INVITE = 'assessor.invite',

  // Results
  RESULTS_VIEW = 'results.view',
  RESULTS_EXPORT = 'results.export',

  // User management
  USER_CREATE = 'user.create',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  USER_ROLE_CHANGE = 'user.role_change',

  // GDPR
  GDPR_EXPORT = 'gdpr.export',
  GDPR_DELETE = 'gdpr.delete',
  GDPR_CONSENT_UPDATE = 'gdpr.consent_update',

  // Configuration
  CONFIG_UPDATE = 'config.update',

  // System
  SYSTEM_ERROR = 'system.error',
  RATE_LIMIT_EXCEEDED = 'system.rate_limit_exceeded',
}

// Audit target types
export enum AuditTargetType {
  USER = 'user',
  APPLICATION = 'application',
  ASSESSMENT = 'assessment',
  ASSIGNMENT = 'assignment',
  FUNDING_CALL = 'funding_call',
  FILE = 'file',
  ASSESSOR = 'assessor',
  RESULTS = 'results',
  SYSTEM = 'system',
  CONFIG = 'config',
}

// CSRF token
export interface CSRFToken {
  token: string;
  createdAt: Date;
  expiresAt: Date;
}

// Rate limit info
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

// File validation result
export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  file?: {
    originalName: string;
    mimeType: string;
    size: number;
    extension: string;
  };
  scanStatus?: 'pending' | 'clean' | 'infected' | 'error';
}

// GDPR consent
export interface GDPRConsent {
  userId: string;
  dataProcessing: boolean;
  dataSharing: boolean;
  marketing: boolean;
  consentedAt: Date;
  ipAddress: string;
  version: string;
}

// Data export request
export interface DataExportRequest {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt?: Date;
}

// Data deletion request
export interface DataDeletionRequest {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: Date;
  completedAt?: Date;
  reason?: string;
}

// Session info
export interface SessionInfo {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastActivityAt: Date;
  expiresAt: Date;
  isRevoked: boolean;
}

// Security headers configuration
export interface SecurityHeadersConfig {
  contentSecurityPolicy: string;
  xFrameOptions: 'DENY' | 'SAMEORIGIN';
  xContentTypeOptions: 'nosniff';
  xXssProtection: '1; mode=block';
  strictTransportSecurity: string;
  referrerPolicy: string;
  permissionsPolicy: string;
}

// CORS configuration
export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

// Request context for security
export interface SecurityContext {
  user?: AuthUser;
  sessionId?: string;
  ipAddress: string;
  userAgent?: string;
  csrfToken?: string;
  requestId: string;
}
