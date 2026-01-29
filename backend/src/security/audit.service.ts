/**
 * Audit Service
 * Immutable audit logging for all significant actions
 * Aligned with PRD 12.4: Audit & Logging requirements
 */

import * as crypto from 'crypto';
import {
  AuditLogEntry,
  AuditAction,
  AuditTargetType,
  UserRole,
  AuthUser,
  JWTPayload,
} from '../types/security.types';
import { AUDIT_CONFIG } from '../config/security';

/**
 * In-memory audit log storage (replace with database in production)
 */
const auditLogs: AuditLogEntry[] = [];

/**
 * Audit context for request tracking
 */
export interface AuditContext {
  user?: AuthUser | JWTPayload;
  ipAddress: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Helper to get user ID from either AuthUser (id) or JWTPayload (sub)
 */
function getUserId(user: AuthUser | JWTPayload | undefined): string | undefined {
  if (!user) return undefined;
  return 'sub' in user ? user.sub : user.id;
}

/**
 * Audit event options
 */
export interface AuditEventOptions {
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string;
  details?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Audit query options
 */
export interface AuditQueryOptions {
  actorId?: string;
  actorRole?: UserRole;
  action?: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
  startDate?: Date;
  endDate?: Date;
  success?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Audit Service class
 */
export class AuditService {
  private readonly retentionDays: number;
  private readonly mandatoryEvents: string[];

  constructor() {
    this.retentionDays = AUDIT_CONFIG.retentionDays;
    this.mandatoryEvents = AUDIT_CONFIG.mandatoryEvents;
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Create an immutable audit log entry
   */
  log(context: AuditContext, options: AuditEventOptions): AuditLogEntry {
    const entry: AuditLogEntry = {
      eventId: this.generateEventId(),
      actorId: getUserId(context.user) || 'anonymous',
      actorRole: context.user?.role || UserRole.APPLICANT,
      actorEmail: 'email' in (context.user || {}) ? (context.user as AuthUser).email : undefined,
      action: options.action,
      targetType: options.targetType,
      targetId: options.targetId,
      details: this.sanitizeDetails(options.details || {}),
      ipAddress: this.anonymizeIpAddress(context.ipAddress),
      userAgent: context.userAgent,
      timestamp: new Date(),
      success: options.success !== false, // Default to true
      errorMessage: options.errorMessage,
    };

    // Store the entry (in production, this would be a database insert)
    this.persistEntry(entry);

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      this.logToConsole(entry);
    }

    return entry;
  }

  /**
   * Log authentication event
   */
  logAuth(
    context: AuditContext,
    action: AuditAction,
    success: boolean,
    details?: Record<string, unknown>
  ): AuditLogEntry {
    return this.log(context, {
      action,
      targetType: AuditTargetType.USER,
      targetId: getUserId(context.user),
      details,
      success,
    });
  }

  /**
   * Log login attempt
   */
  logLogin(context: AuditContext, userId: string, success: boolean, reason?: string): AuditLogEntry {
    return this.log(
      { ...context, user: { sub: userId, role: UserRole.APPLICANT } as JWTPayload },
      {
        action: success ? AuditAction.LOGIN : AuditAction.LOGIN_FAILED,
        targetType: AuditTargetType.USER,
        targetId: userId,
        details: { reason },
        success,
        errorMessage: !success ? reason : undefined,
      }
    );
  }

  /**
   * Log logout
   */
  logLogout(context: AuditContext): AuditLogEntry {
    return this.log(context, {
      action: AuditAction.LOGOUT,
      targetType: AuditTargetType.USER,
      targetId: getUserId(context.user),
      success: true,
    });
  }

  /**
   * Log password change
   */
  logPasswordChange(context: AuditContext, success: boolean, reason?: string): AuditLogEntry {
    return this.log(context, {
      action: AuditAction.PASSWORD_CHANGE,
      targetType: AuditTargetType.USER,
      targetId: getUserId(context.user),
      details: { reason },
      success,
      errorMessage: !success ? reason : undefined,
    });
  }

  /**
   * Log application event
   */
  logApplicationEvent(
    context: AuditContext,
    action: AuditAction,
    applicationId: string,
    details?: Record<string, unknown>
  ): AuditLogEntry {
    return this.log(context, {
      action,
      targetType: AuditTargetType.APPLICATION,
      targetId: applicationId,
      details,
      success: true,
    });
  }

  /**
   * Log file operation
   */
  logFileOperation(
    context: AuditContext,
    action: AuditAction,
    fileId: string,
    details?: Record<string, unknown>
  ): AuditLogEntry {
    return this.log(context, {
      action,
      targetType: AuditTargetType.FILE,
      targetId: fileId,
      details,
      success: true,
    });
  }

  /**
   * Log assessment event
   */
  logAssessmentEvent(
    context: AuditContext,
    action: AuditAction,
    assessmentId: string,
    details?: Record<string, unknown>
  ): AuditLogEntry {
    return this.log(context, {
      action,
      targetType: AuditTargetType.ASSESSMENT,
      targetId: assessmentId,
      details,
      success: true,
    });
  }

  /**
   * Log funding call event
   */
  logCallEvent(
    context: AuditContext,
    action: AuditAction,
    callId: string,
    details?: Record<string, unknown>
  ): AuditLogEntry {
    return this.log(context, {
      action,
      targetType: AuditTargetType.FUNDING_CALL,
      targetId: callId,
      details,
      success: true,
    });
  }

  /**
   * Log user management event
   */
  logUserManagement(
    context: AuditContext,
    action: AuditAction,
    targetUserId: string,
    details?: Record<string, unknown>
  ): AuditLogEntry {
    return this.log(context, {
      action,
      targetType: AuditTargetType.USER,
      targetId: targetUserId,
      details,
      success: true,
    });
  }

  /**
   * Log GDPR event
   */
  logGDPREvent(
    context: AuditContext,
    action: AuditAction,
    targetUserId: string,
    details?: Record<string, unknown>
  ): AuditLogEntry {
    return this.log(context, {
      action,
      targetType: AuditTargetType.USER,
      targetId: targetUserId,
      details,
      success: true,
    });
  }

  /**
   * Log system error
   */
  logSystemError(
    context: AuditContext,
    errorMessage: string,
    details?: Record<string, unknown>
  ): AuditLogEntry {
    return this.log(context, {
      action: AuditAction.SYSTEM_ERROR,
      targetType: AuditTargetType.SYSTEM,
      details: { ...details, errorMessage },
      success: false,
      errorMessage,
    });
  }

  /**
   * Log rate limit exceeded
   */
  logRateLimitExceeded(
    context: AuditContext,
    endpoint: string,
    limit: number
  ): AuditLogEntry {
    return this.log(context, {
      action: AuditAction.RATE_LIMIT_EXCEEDED,
      targetType: AuditTargetType.SYSTEM,
      details: { endpoint, limit },
      success: false,
      errorMessage: `Rate limit exceeded: ${limit} requests to ${endpoint}`,
    });
  }

  /**
   * Query audit logs
   */
  query(options: AuditQueryOptions): AuditLogEntry[] {
    let results = [...auditLogs];

    // Apply filters
    if (options.actorId) {
      results = results.filter((e) => e.actorId === options.actorId);
    }

    if (options.actorRole) {
      results = results.filter((e) => e.actorRole === options.actorRole);
    }

    if (options.action) {
      results = results.filter((e) => e.action === options.action);
    }

    if (options.targetType) {
      results = results.filter((e) => e.targetType === options.targetType);
    }

    if (options.targetId) {
      results = results.filter((e) => e.targetId === options.targetId);
    }

    if (options.startDate) {
      results = results.filter((e) => e.timestamp >= options.startDate!);
    }

    if (options.endDate) {
      results = results.filter((e) => e.timestamp <= options.endDate!);
    }

    if (options.success !== undefined) {
      results = results.filter((e) => e.success === options.success);
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    results = results.slice(offset, offset + limit);

    return results;
  }

  /**
   * Get audit logs for a specific user
   */
  getLogsForUser(userId: string, limit: number = 100): AuditLogEntry[] {
    return this.query({ actorId: userId, limit });
  }

  /**
   * Get audit logs for a specific target
   */
  getLogsForTarget(targetType: AuditTargetType, targetId: string, limit: number = 100): AuditLogEntry[] {
    return this.query({ targetType, targetId, limit });
  }

  /**
   * Get recent security events
   */
  getSecurityEvents(limit: number = 100): AuditLogEntry[] {
    const securityActions = [
      AuditAction.LOGIN,
      AuditAction.LOGIN_FAILED,
      AuditAction.LOGOUT,
      AuditAction.PASSWORD_CHANGE,
      AuditAction.PASSWORD_RESET_REQUEST,
      AuditAction.PASSWORD_RESET_COMPLETE,
      AuditAction.MFA_ENABLE,
      AuditAction.MFA_DISABLE,
      AuditAction.TOKEN_REVOKE,
      AuditAction.USER_ROLE_CHANGE,
      AuditAction.RATE_LIMIT_EXCEEDED,
    ];

    return auditLogs
      .filter((e) => securityActions.includes(e.action))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get failed login attempts for a user
   */
  getFailedLoginAttempts(userId: string, sinceDate?: Date): AuditLogEntry[] {
    return this.query({
      actorId: userId,
      action: AuditAction.LOGIN_FAILED,
      startDate: sinceDate,
    });
  }

  /**
   * Count events matching criteria
   */
  countEvents(options: Omit<AuditQueryOptions, 'limit' | 'offset'>): number {
    return this.query({ ...options, limit: Number.MAX_SAFE_INTEGER }).length;
  }

  /**
   * Export audit logs for compliance
   */
  exportLogs(
    options: AuditQueryOptions,
    format: 'json' | 'csv' = 'json'
  ): string {
    const logs = this.query(options);

    if (format === 'csv') {
      const headers = [
        'Event ID',
        'Timestamp',
        'Actor ID',
        'Actor Role',
        'Action',
        'Target Type',
        'Target ID',
        'Success',
        'IP Address',
        'Details',
      ];

      const rows = logs.map((log) => [
        log.eventId,
        log.timestamp.toISOString(),
        log.actorId,
        log.actorRole,
        log.action,
        log.targetType,
        log.targetId || '',
        log.success.toString(),
        log.ipAddress,
        JSON.stringify(log.details),
      ]);

      return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    }

    return JSON.stringify(logs, null, 2);
  }

  /**
   * Clean up expired audit logs
   */
  cleanupExpiredLogs(): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    const initialCount = auditLogs.length;

    // Filter out expired logs
    const validLogs = auditLogs.filter((log) => log.timestamp >= cutoffDate);

    // Clear and repopulate
    auditLogs.length = 0;
    auditLogs.push(...validLogs);

    return initialCount - auditLogs.length;
  }

  /**
   * Persist audit entry (in production, write to database)
   */
  private persistEntry(entry: AuditLogEntry): void {
    // Add to in-memory storage
    auditLogs.push(entry);

    // In production, this would be:
    // await this.auditRepository.insert(entry);

    // For mandatory events, ensure they are never lost
    if (this.mandatoryEvents.includes(entry.action)) {
      // In production, consider writing to a separate persistent store
      // or using a write-ahead log for durability
    }
  }

  /**
   * Sanitize details to remove sensitive information
   */
  private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeDetails(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Anonymize IP address for GDPR compliance (keep network portion)
   */
  private anonymizeIpAddress(ip: string): string {
    if (!ip) return 'unknown';

    // IPv4
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
      }
    }

    // IPv6
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 4) {
        return `${parts.slice(0, 4).join(':')}::`;
      }
    }

    return ip;
  }

  /**
   * Log to console in development
   */
  private logToConsole(entry: AuditLogEntry): void {
    const icon = entry.success ? '✓' : '✗';
    const timestamp = entry.timestamp.toISOString();
    console.log(
      `[AUDIT ${icon}] ${timestamp} | ${entry.action} | ${entry.actorRole}:${entry.actorId} | ${entry.targetType}:${entry.targetId || 'N/A'}`
    );
  }

  /**
   * Get audit statistics
   */
  getStatistics(startDate?: Date, endDate?: Date): {
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    byAction: Record<string, number>;
    byTargetType: Record<string, number>;
    byRole: Record<string, number>;
  } {
    let logs = auditLogs;

    if (startDate) {
      logs = logs.filter((l) => l.timestamp >= startDate);
    }
    if (endDate) {
      logs = logs.filter((l) => l.timestamp <= endDate);
    }

    const byAction: Record<string, number> = {};
    const byTargetType: Record<string, number> = {};
    const byRole: Record<string, number> = {};

    for (const log of logs) {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byTargetType[log.targetType] = (byTargetType[log.targetType] || 0) + 1;
      byRole[log.actorRole] = (byRole[log.actorRole] || 0) + 1;
    }

    return {
      totalEvents: logs.length,
      successfulEvents: logs.filter((l) => l.success).length,
      failedEvents: logs.filter((l) => !l.success).length,
      byAction,
      byTargetType,
      byRole,
    };
  }
}

// Export singleton instance
export const auditService = new AuditService();

// Export class for testing
export default AuditService;
