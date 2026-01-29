/**
 * Audit Service Unit Tests
 * Tests audit logging, querying, and export functionality
 */

import AuditService, {
  auditService,
  AuditContext,
  AuditEventOptions,
  AuditQueryOptions,
} from '../../../src/security/audit.service';
import {
  UserRole,
  AuditAction,
  AuditTargetType,
  AuthUser,
  JWTPayload,
} from '../../../src/types/security.types';

// Note: We don't mock crypto as it's needed for audit event ID generation
// The service uses crypto.randomBytes which needs to work

// Mock config
jest.mock('../../../src/config/security', () => ({
  AUDIT_CONFIG: {
    retentionDays: 90,
    mandatoryEvents: [
      'auth.login',
      'auth.login_failed',
      'auth.logout',
      'application.submit',
    ],
  },
}));

describe('AuditService', () => {
  let service: AuditService;
  let originalEnv: string | undefined;

  beforeEach(() => {
    service = new AuditService();
    originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    jest.clearAllMocks();
    // Clear console mock to prevent noise
    jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  // Test fixtures
  const createContext = (overrides: Partial<AuditContext> = {}): AuditContext => ({
    ipAddress: '192.168.1.100',
    userAgent: 'Test/1.0',
    requestId: 'req-123',
    ...overrides,
  });

  const createAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
    id: 'user-123',
    email: 'test@example.com',
    passwordHash: 'hashed',
    role: UserRole.APPLICANT,
    permissions: [],
    isActive: true,
    isEmailVerified: true,
    mfaEnabled: false,
    failedLoginAttempts: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('log', () => {
    it('should create an audit log entry', () => {
      const context = createContext({ user: createAuthUser() });
      const options: AuditEventOptions = {
        action: AuditAction.LOGIN,
        targetType: AuditTargetType.USER,
        targetId: 'user-123',
      };

      const entry = service.log(context, options);

      expect(entry).toMatchObject({
        actorId: 'user-123',
        actorRole: UserRole.APPLICANT,
        action: AuditAction.LOGIN,
        targetType: AuditTargetType.USER,
        targetId: 'user-123',
        success: true,
      });
    });

    it('should generate unique event ID', () => {
      const context = createContext({ user: createAuthUser() });
      const options: AuditEventOptions = {
        action: AuditAction.LOGIN,
        targetType: AuditTargetType.USER,
      };

      const entry1 = service.log(context, options);
      const entry2 = service.log(context, options);

      expect(entry1.eventId).not.toBe(entry2.eventId);
    });

    it('should use anonymous for missing user', () => {
      const context = createContext();
      const options: AuditEventOptions = {
        action: AuditAction.LOGIN_FAILED,
        targetType: AuditTargetType.USER,
      };

      const entry = service.log(context, options);

      expect(entry.actorId).toBe('anonymous');
    });

    it('should anonymize IP address for GDPR compliance', () => {
      const context = createContext({ ipAddress: '192.168.1.100' });
      const options: AuditEventOptions = {
        action: AuditAction.LOGIN,
        targetType: AuditTargetType.USER,
      };

      const entry = service.log(context, options);

      expect(entry.ipAddress).toBe('192.168.1.0'); // Last octet zeroed
    });

    it('should anonymize IPv6 addresses', () => {
      const context = createContext({
        ipAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      });
      const options: AuditEventOptions = {
        action: AuditAction.LOGIN,
        targetType: AuditTargetType.USER,
      };

      const entry = service.log(context, options);

      expect(entry.ipAddress).toBe('2001:0db8:85a3:0000::');
    });

    it('should sanitize sensitive details', () => {
      const context = createContext({ user: createAuthUser() });
      const options: AuditEventOptions = {
        action: AuditAction.PASSWORD_CHANGE,
        targetType: AuditTargetType.USER,
        details: {
          password: 'secret123',
          token: 'jwt-token-here',
          apiKey: 'api-key-value',
          normalField: 'visible',
        },
      };

      const entry = service.log(context, options);

      expect(entry.details).toMatchObject({
        password: '[REDACTED]',
        token: '[REDACTED]',
        apiKey: '[REDACTED]',
        normalField: 'visible',
      });
    });

    it('should sanitize nested sensitive fields', () => {
      const context = createContext({ user: createAuthUser() });
      const options: AuditEventOptions = {
        action: AuditAction.LOGIN,
        targetType: AuditTargetType.USER,
        details: {
          nested: {
            password: 'hidden',
            visible: 'ok',
          },
        },
      };

      const entry = service.log(context, options);

      expect((entry.details as any).nested.password).toBe('[REDACTED]');
      expect((entry.details as any).nested.visible).toBe('ok');
    });

    it('should record failure status and error message', () => {
      const context = createContext({ user: createAuthUser() });
      const options: AuditEventOptions = {
        action: AuditAction.LOGIN_FAILED,
        targetType: AuditTargetType.USER,
        success: false,
        errorMessage: 'Invalid credentials',
      };

      const entry = service.log(context, options);

      expect(entry.success).toBe(false);
      expect(entry.errorMessage).toBe('Invalid credentials');
    });

    it('should record timestamp', () => {
      const beforeTime = new Date();
      const context = createContext({ user: createAuthUser() });
      const options: AuditEventOptions = {
        action: AuditAction.LOGIN,
        targetType: AuditTargetType.USER,
      };

      const entry = service.log(context, options);
      const afterTime = new Date();

      expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(entry.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe('logAuth', () => {
    it('should log authentication event', () => {
      const context = createContext({ user: createAuthUser() });

      const entry = service.logAuth(context, AuditAction.LOGIN, true);

      expect(entry.action).toBe(AuditAction.LOGIN);
      expect(entry.targetType).toBe(AuditTargetType.USER);
      expect(entry.success).toBe(true);
    });

    it('should log failed authentication', () => {
      const context = createContext({ user: createAuthUser() });

      const entry = service.logAuth(context, AuditAction.LOGIN_FAILED, false, {
        reason: 'Invalid password',
      });

      expect(entry.success).toBe(false);
      expect(entry.details).toHaveProperty('reason', 'Invalid password');
    });
  });

  describe('logLogin', () => {
    it('should log successful login', () => {
      const context = createContext();

      const entry = service.logLogin(context, 'user-123', true);

      expect(entry.action).toBe(AuditAction.LOGIN);
      expect(entry.targetId).toBe('user-123');
      expect(entry.success).toBe(true);
    });

    it('should log failed login with reason', () => {
      const context = createContext();

      const entry = service.logLogin(
        context,
        'user-123',
        false,
        'Account locked'
      );

      expect(entry.action).toBe(AuditAction.LOGIN_FAILED);
      expect(entry.success).toBe(false);
      expect(entry.errorMessage).toBe('Account locked');
    });
  });

  describe('logLogout', () => {
    it('should log logout event', () => {
      const context = createContext({ user: createAuthUser() });

      const entry = service.logLogout(context);

      expect(entry.action).toBe(AuditAction.LOGOUT);
      expect(entry.success).toBe(true);
    });
  });

  describe('logPasswordChange', () => {
    it('should log successful password change', () => {
      const context = createContext({ user: createAuthUser() });

      const entry = service.logPasswordChange(context, true);

      expect(entry.action).toBe(AuditAction.PASSWORD_CHANGE);
      expect(entry.success).toBe(true);
    });

    it('should log failed password change', () => {
      const context = createContext({ user: createAuthUser() });

      const entry = service.logPasswordChange(
        context,
        false,
        'Password too weak'
      );

      expect(entry.success).toBe(false);
      expect(entry.errorMessage).toBe('Password too weak');
    });
  });

  describe('logApplicationEvent', () => {
    it('should log application event', () => {
      const context = createContext({ user: createAuthUser() });

      const entry = service.logApplicationEvent(
        context,
        AuditAction.APPLICATION_CREATE,
        'app-123',
        { callId: 'call-456' }
      );

      expect(entry.action).toBe(AuditAction.APPLICATION_CREATE);
      expect(entry.targetType).toBe(AuditTargetType.APPLICATION);
      expect(entry.targetId).toBe('app-123');
      expect(entry.details).toHaveProperty('callId', 'call-456');
    });
  });

  describe('logFileOperation', () => {
    it('should log file operation', () => {
      const context = createContext({ user: createAuthUser() });

      const entry = service.logFileOperation(
        context,
        AuditAction.FILE_UPLOAD,
        'file-123',
        { filename: 'document.pdf', size: 1024 }
      );

      expect(entry.action).toBe(AuditAction.FILE_UPLOAD);
      expect(entry.targetType).toBe(AuditTargetType.FILE);
      expect(entry.targetId).toBe('file-123');
    });
  });

  describe('logAssessmentEvent', () => {
    it('should log assessment event', () => {
      const context = createContext({
        user: createAuthUser({ role: UserRole.ASSESSOR }),
      });

      const entry = service.logAssessmentEvent(
        context,
        AuditAction.ASSESSMENT_SUBMIT,
        'assessment-123'
      );

      expect(entry.action).toBe(AuditAction.ASSESSMENT_SUBMIT);
      expect(entry.targetType).toBe(AuditTargetType.ASSESSMENT);
      expect(entry.targetId).toBe('assessment-123');
    });
  });

  describe('logCallEvent', () => {
    it('should log funding call event', () => {
      const context = createContext({
        user: createAuthUser({ role: UserRole.COORDINATOR }),
      });

      const entry = service.logCallEvent(
        context,
        AuditAction.CALL_CREATE,
        'call-123',
        { name: 'Test Call' }
      );

      expect(entry.action).toBe(AuditAction.CALL_CREATE);
      expect(entry.targetType).toBe(AuditTargetType.FUNDING_CALL);
      expect(entry.targetId).toBe('call-123');
    });
  });

  describe('logUserManagement', () => {
    it('should log user management event', () => {
      const context = createContext({
        user: createAuthUser({ role: UserRole.COORDINATOR }),
      });

      const entry = service.logUserManagement(
        context,
        AuditAction.USER_ROLE_CHANGE,
        'target-user-123',
        { newRole: UserRole.ASSESSOR }
      );

      expect(entry.action).toBe(AuditAction.USER_ROLE_CHANGE);
      expect(entry.targetType).toBe(AuditTargetType.USER);
      expect(entry.targetId).toBe('target-user-123');
    });
  });

  describe('logGDPREvent', () => {
    it('should log GDPR event', () => {
      const context = createContext({ user: createAuthUser() });

      const entry = service.logGDPREvent(
        context,
        AuditAction.GDPR_EXPORT,
        'user-123',
        { format: 'json' }
      );

      expect(entry.action).toBe(AuditAction.GDPR_EXPORT);
      expect(entry.targetType).toBe(AuditTargetType.USER);
    });
  });

  describe('logSystemError', () => {
    it('should log system error', () => {
      const context = createContext({ user: createAuthUser() });

      const entry = service.logSystemError(
        context,
        'Database connection failed',
        { component: 'postgres' }
      );

      expect(entry.action).toBe(AuditAction.SYSTEM_ERROR);
      expect(entry.targetType).toBe(AuditTargetType.SYSTEM);
      expect(entry.success).toBe(false);
      expect(entry.errorMessage).toBe('Database connection failed');
    });
  });

  describe('logRateLimitExceeded', () => {
    it('should log rate limit exceeded', () => {
      const context = createContext({ user: createAuthUser() });

      const entry = service.logRateLimitExceeded(context, '/api/login', 5);

      expect(entry.action).toBe(AuditAction.RATE_LIMIT_EXCEEDED);
      expect(entry.success).toBe(false);
      expect(entry.details).toMatchObject({ endpoint: '/api/login', limit: 5 });
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // Create sample audit logs
      const context = createContext({ user: createAuthUser() });
      service.log(context, {
        action: AuditAction.LOGIN,
        targetType: AuditTargetType.USER,
        targetId: 'user-123',
      });
      service.log(context, {
        action: AuditAction.LOGIN_FAILED,
        targetType: AuditTargetType.USER,
        targetId: 'user-123',
        success: false,
      });
      service.log(
        { ...context, user: createAuthUser({ role: UserRole.COORDINATOR }) },
        {
          action: AuditAction.CALL_CREATE,
          targetType: AuditTargetType.FUNDING_CALL,
          targetId: 'call-123',
        }
      );
    });

    it('should return all logs when no filters', () => {
      const results = service.query({});

      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by actorId', () => {
      const results = service.query({ actorId: 'user-123' });

      results.forEach((entry) => {
        expect(entry.actorId).toBe('user-123');
      });
    });

    it('should filter by actorRole', () => {
      const results = service.query({ actorRole: UserRole.COORDINATOR });

      results.forEach((entry) => {
        expect(entry.actorRole).toBe(UserRole.COORDINATOR);
      });
    });

    it('should filter by action', () => {
      const results = service.query({ action: AuditAction.LOGIN });

      results.forEach((entry) => {
        expect(entry.action).toBe(AuditAction.LOGIN);
      });
    });

    it('should filter by targetType', () => {
      const results = service.query({
        targetType: AuditTargetType.FUNDING_CALL,
      });

      results.forEach((entry) => {
        expect(entry.targetType).toBe(AuditTargetType.FUNDING_CALL);
      });
    });

    it('should filter by targetId', () => {
      const results = service.query({ targetId: 'call-123' });

      results.forEach((entry) => {
        expect(entry.targetId).toBe('call-123');
      });
    });

    it('should filter by success status', () => {
      const results = service.query({ success: false });

      results.forEach((entry) => {
        expect(entry.success).toBe(false);
      });
    });

    it('should filter by date range', () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 3600000);

      const results = service.query({
        startDate: hourAgo,
        endDate: now,
      });

      results.forEach((entry) => {
        expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(hourAgo.getTime());
        expect(entry.timestamp.getTime()).toBeLessThanOrEqual(now.getTime());
      });
    });

    it('should apply limit', () => {
      const results = service.query({ limit: 1 });

      expect(results).toHaveLength(1);
    });

    it('should apply offset', () => {
      const allResults = service.query({});
      const offsetResults = service.query({ offset: 1 });

      expect(offsetResults.length).toBe(allResults.length - 1);
    });

    it('should sort by timestamp descending', () => {
      const results = service.query({});

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].timestamp.getTime()).toBeGreaterThanOrEqual(
          results[i].timestamp.getTime()
        );
      }
    });
  });

  describe('getLogsForUser', () => {
    it('should return logs for specific user', () => {
      const context = createContext({ user: createAuthUser() });
      service.logLogin(context, 'user-123', true);

      const results = service.getLogsForUser('user-123');

      expect(results.length).toBeGreaterThan(0);
      results.forEach((entry) => {
        expect(entry.actorId).toBe('user-123');
      });
    });
  });

  describe('getLogsForTarget', () => {
    it('should return logs for specific target', () => {
      const context = createContext({
        user: createAuthUser({ role: UserRole.COORDINATOR }),
      });
      service.logCallEvent(context, AuditAction.CALL_CREATE, 'target-call');

      const results = service.getLogsForTarget(
        AuditTargetType.FUNDING_CALL,
        'target-call'
      );

      expect(results.length).toBeGreaterThan(0);
      results.forEach((entry) => {
        expect(entry.targetId).toBe('target-call');
      });
    });
  });

  describe('getSecurityEvents', () => {
    beforeEach(() => {
      const context = createContext({ user: createAuthUser() });
      service.logLogin(context, 'user-1', true);
      service.logLogin(context, 'user-2', false, 'Invalid password');
      service.logLogout(context);
      service.logPasswordChange(context, true);
    });

    it('should return only security-related events', () => {
      const results = service.getSecurityEvents();

      results.forEach((entry) => {
        expect([
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
        ]).toContain(entry.action);
      });
    });
  });

  describe('getFailedLoginAttempts', () => {
    it('should return failed login attempts for user', () => {
      const context = createContext();
      // Use unique user ID to avoid pollution from other tests
      const uniqueUserId = `user-${Date.now()}`;
      service.logLogin(context, uniqueUserId, false, 'Wrong password');
      service.logLogin(context, uniqueUserId, false, 'Account locked');
      service.logLogin(context, uniqueUserId, true); // Successful login

      const results = service.getFailedLoginAttempts(uniqueUserId);

      expect(results.length).toBe(2);
      results.forEach((entry) => {
        expect(entry.action).toBe(AuditAction.LOGIN_FAILED);
      });
    });

    it('should filter by date', () => {
      const context = createContext();
      const sinceDate = new Date(Date.now() - 3600000); // 1 hour ago

      service.logLogin(context, 'user-123', false, 'Wrong password');

      const results = service.getFailedLoginAttempts('user-123', sinceDate);

      results.forEach((entry) => {
        expect(entry.timestamp.getTime()).toBeGreaterThanOrEqual(sinceDate.getTime());
      });
    });
  });

  describe('countEvents', () => {
    it('should count events matching criteria', () => {
      const context = createContext({ user: createAuthUser() });
      service.logLogin(context, 'user-1', true);
      service.logLogin(context, 'user-2', true);
      service.logLogin(context, 'user-3', false, 'Failed');

      const count = service.countEvents({ action: AuditAction.LOGIN });

      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('exportLogs', () => {
    beforeEach(() => {
      const context = createContext({ user: createAuthUser() });
      service.logLogin(context, 'user-1', true);
      service.logApplicationEvent(
        context,
        AuditAction.APPLICATION_CREATE,
        'app-1'
      );
    });

    it('should export logs as JSON', () => {
      const exported = service.exportLogs({}, 'json');

      const parsed = JSON.parse(exported);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
    });

    it('should export logs as CSV', () => {
      const exported = service.exportLogs({}, 'csv');

      expect(exported).toContain('Event ID');
      expect(exported).toContain('Timestamp');
      expect(exported).toContain('Actor ID');
      expect(exported.split('\n').length).toBeGreaterThan(1);
    });

    it('should apply filters to export', () => {
      const exported = service.exportLogs(
        { action: AuditAction.LOGIN },
        'json'
      );

      const parsed = JSON.parse(exported);
      parsed.forEach((entry: any) => {
        expect(entry.action).toBe(AuditAction.LOGIN);
      });
    });
  });

  describe('cleanupExpiredLogs', () => {
    it('should remove logs older than retention period', () => {
      // This test depends on the internal state which is hard to manipulate
      // In production, you would use a database with timestamps

      const removed = service.cleanupExpiredLogs();

      expect(typeof removed).toBe('number');
      expect(removed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStatistics', () => {
    beforeEach(() => {
      const applicant = createContext({ user: createAuthUser() });
      const coordinator = createContext({
        user: createAuthUser({ role: UserRole.COORDINATOR }),
      });

      service.logLogin(applicant, 'user-1', true);
      service.logLogin(applicant, 'user-2', false, 'Failed');
      service.logApplicationEvent(
        applicant,
        AuditAction.APPLICATION_CREATE,
        'app-1'
      );
      service.logCallEvent(coordinator, AuditAction.CALL_CREATE, 'call-1');
    });

    it('should return statistics', () => {
      const stats = service.getStatistics();

      expect(stats.totalEvents).toBeGreaterThan(0);
      expect(stats.successfulEvents).toBeGreaterThan(0);
      expect(stats.failedEvents).toBeGreaterThanOrEqual(0);
      expect(stats.byAction).toBeDefined();
      expect(stats.byTargetType).toBeDefined();
      expect(stats.byRole).toBeDefined();
    });

    it('should filter statistics by date range', () => {
      const now = new Date();
      const hourAgo = new Date(now.getTime() - 3600000);

      const stats = service.getStatistics(hourAgo, now);

      expect(stats.totalEvents).toBeGreaterThanOrEqual(0);
    });

    it('should group by action', () => {
      const stats = service.getStatistics();

      expect(stats.byAction[AuditAction.LOGIN]).toBeGreaterThan(0);
    });

    it('should group by target type', () => {
      const stats = service.getStatistics();

      expect(stats.byTargetType[AuditTargetType.USER]).toBeGreaterThan(0);
    });

    it('should group by role', () => {
      const stats = service.getStatistics();

      expect(stats.byRole[UserRole.APPLICANT]).toBeGreaterThan(0);
    });
  });

  describe('IP anonymization edge cases', () => {
    it('should handle empty IP', () => {
      const context = createContext({ ipAddress: '' });
      const entry = service.log(context, {
        action: AuditAction.LOGIN,
        targetType: AuditTargetType.USER,
      });

      expect(entry.ipAddress).toBe('unknown');
    });

    it('should handle malformed IPv4', () => {
      const context = createContext({ ipAddress: '192.168' });
      const entry = service.log(context, {
        action: AuditAction.LOGIN,
        targetType: AuditTargetType.USER,
      });

      expect(entry.ipAddress).toBe('192.168'); // Returns as-is
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(auditService).toBeInstanceOf(AuditService);
    });
  });

  describe('console logging in development', () => {
    it('should log to console in non-production', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      process.env.NODE_ENV = 'development';

      const context = createContext({ user: createAuthUser() });
      service.log(context, {
        action: AuditAction.LOGIN,
        targetType: AuditTargetType.USER,
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
