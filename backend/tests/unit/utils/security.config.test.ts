/**
 * Security Configuration Unit Tests
 * Tests all security configuration constants in config/security.ts
 */

describe('Security Configuration', () => {
  // Store original env
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('JWT Configuration', () => {
    it('should have access token settings', async () => {
      const { JWT_CONFIG } = await import('../../../src/config/security');

      expect(JWT_CONFIG.accessToken).toBeDefined();
      expect(JWT_CONFIG.accessToken.secret).toBeDefined();
      expect(JWT_CONFIG.accessToken.expiresIn).toBeDefined();
      expect(JWT_CONFIG.accessToken.algorithm).toBe('HS256');
      expect(JWT_CONFIG.accessToken.issuer).toBeDefined();
      expect(JWT_CONFIG.accessToken.audience).toBeDefined();
    });

    it('should have refresh token settings', async () => {
      const { JWT_CONFIG } = await import('../../../src/config/security');

      expect(JWT_CONFIG.refreshToken).toBeDefined();
      expect(JWT_CONFIG.refreshToken.secret).toBeDefined();
      expect(JWT_CONFIG.refreshToken.expiresIn).toBe('7d');
      expect(JWT_CONFIG.refreshToken.algorithm).toBe('HS256');
    });

    it('should have rotation settings', async () => {
      const { JWT_CONFIG } = await import('../../../src/config/security');

      expect(JWT_CONFIG.rotation).toBeDefined();
      expect(JWT_CONFIG.rotation.enabled).toBe(true);
      expect(JWT_CONFIG.rotation.reuseWindow).toBe(10);
      expect(JWT_CONFIG.rotation.maxFamily).toBe(5);
    });

    it('should use environment variables for secrets', async () => {
      process.env.JWT_ACCESS_SECRET = 'test-access-secret';
      process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
      jest.resetModules();

      const { JWT_CONFIG } = await import('../../../src/config/security');

      expect(JWT_CONFIG.accessToken.secret).toBe('test-access-secret');
      expect(JWT_CONFIG.refreshToken.secret).toBe('test-refresh-secret');
    });

    it('should have different token expiry for production', async () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();

      const { JWT_CONFIG } = await import('../../../src/config/security');

      expect(JWT_CONFIG.accessToken.expiresIn).toBe('15m');
    });
  });

  describe('Password Policy', () => {
    it('should have secure password requirements', async () => {
      const { PASSWORD_POLICY } = await import('../../../src/config/security');

      expect(PASSWORD_POLICY.minLength).toBe(12);
      expect(PASSWORD_POLICY.maxLength).toBe(128);
      expect(PASSWORD_POLICY.requireUppercase).toBe(true);
      expect(PASSWORD_POLICY.requireLowercase).toBe(true);
      expect(PASSWORD_POLICY.requireNumbers).toBe(true);
      expect(PASSWORD_POLICY.requireSpecialChars).toBe(true);
    });

    it('should prevent password reuse', async () => {
      const { PASSWORD_POLICY } = await import('../../../src/config/security');

      expect(PASSWORD_POLICY.preventReuse).toBe(5);
    });

    it('should set password expiry', async () => {
      const { PASSWORD_POLICY } = await import('../../../src/config/security');

      expect(PASSWORD_POLICY.maxAge).toBe(90); // 90 days
    });
  });

  describe('Bcrypt Configuration', () => {
    it('should have salt rounds configured', async () => {
      const { BCRYPT_CONFIG } = await import('../../../src/config/security');

      expect(BCRYPT_CONFIG.saltRounds).toBeGreaterThanOrEqual(10);
      expect(BCRYPT_CONFIG.saltRounds).toBeLessThanOrEqual(12);
    });

    it('should use higher salt rounds in production', async () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();

      const { BCRYPT_CONFIG } = await import('../../../src/config/security');

      expect(BCRYPT_CONFIG.saltRounds).toBe(12);
    });
  });

  describe('Session Configuration', () => {
    it('should have inactivity timeout of 30 minutes', async () => {
      const { SESSION_CONFIG } = await import('../../../src/config/security');

      expect(SESSION_CONFIG.inactivityTimeout).toBe(30 * 60 * 1000);
    });

    it('should have absolute timeout of 12 hours', async () => {
      const { SESSION_CONFIG } = await import('../../../src/config/security');

      expect(SESSION_CONFIG.absoluteTimeout).toBe(12 * 60 * 60 * 1000);
    });

    it('should have secure cookie settings', async () => {
      const { SESSION_CONFIG } = await import('../../../src/config/security');

      expect(SESSION_CONFIG.sameSite).toBe('strict');
      expect(SESSION_CONFIG.httpOnly).toBe(true);
      expect(SESSION_CONFIG.extendOnActivity).toBe(true);
    });

    it('should use secure cookies in production', async () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();

      const { SESSION_CONFIG } = await import('../../../src/config/security');

      expect(SESSION_CONFIG.secure).toBe(true);
    });
  });

  describe('Rate Limit Configuration', () => {
    it('should have general rate limits', async () => {
      const { RATE_LIMIT_CONFIG } = await import('../../../src/config/security');

      expect(RATE_LIMIT_CONFIG.general.windowMs).toBe(15 * 60 * 1000);
      expect(RATE_LIMIT_CONFIG.general.max).toBe(100);
      expect(RATE_LIMIT_CONFIG.general.standardHeaders).toBe(true);
    });

    it('should have stricter auth rate limits', async () => {
      const { RATE_LIMIT_CONFIG } = await import('../../../src/config/security');

      expect(RATE_LIMIT_CONFIG.auth.max).toBe(5);
      expect(RATE_LIMIT_CONFIG.auth.max).toBeLessThan(RATE_LIMIT_CONFIG.general.max);
    });

    it('should have password reset rate limits', async () => {
      const { RATE_LIMIT_CONFIG } = await import('../../../src/config/security');

      expect(RATE_LIMIT_CONFIG.passwordReset.windowMs).toBe(60 * 60 * 1000);
      expect(RATE_LIMIT_CONFIG.passwordReset.max).toBe(3);
    });

    it('should have file upload rate limits', async () => {
      const { RATE_LIMIT_CONFIG } = await import('../../../src/config/security');

      expect(RATE_LIMIT_CONFIG.fileUpload.max).toBe(50);
    });

    it('should have export rate limits', async () => {
      const { RATE_LIMIT_CONFIG } = await import('../../../src/config/security');

      expect(RATE_LIMIT_CONFIG.export.max).toBe(10);
    });
  });

  describe('CORS Configuration', () => {
    it('should have allowed origins', async () => {
      const { CORS_CONFIG } = await import('../../../src/config/security');

      expect(CORS_CONFIG.allowedOrigins).toBeDefined();
      expect(Array.isArray(CORS_CONFIG.allowedOrigins)).toBe(true);
    });

    it('should have allowed methods', async () => {
      const { CORS_CONFIG } = await import('../../../src/config/security');

      expect(CORS_CONFIG.allowedMethods).toContain('GET');
      expect(CORS_CONFIG.allowedMethods).toContain('POST');
      expect(CORS_CONFIG.allowedMethods).toContain('PUT');
      expect(CORS_CONFIG.allowedMethods).toContain('DELETE');
    });

    it('should have allowed headers including security headers', async () => {
      const { CORS_CONFIG } = await import('../../../src/config/security');

      expect(CORS_CONFIG.allowedHeaders).toContain('Content-Type');
      expect(CORS_CONFIG.allowedHeaders).toContain('Authorization');
      expect(CORS_CONFIG.allowedHeaders).toContain('X-CSRF-Token');
    });

    it('should expose rate limit headers', async () => {
      const { CORS_CONFIG } = await import('../../../src/config/security');

      expect(CORS_CONFIG.exposedHeaders).toContain('X-RateLimit-Limit');
      expect(CORS_CONFIG.exposedHeaders).toContain('X-RateLimit-Remaining');
      expect(CORS_CONFIG.exposedHeaders).toContain('X-RateLimit-Reset');
    });

    it('should allow credentials', async () => {
      const { CORS_CONFIG } = await import('../../../src/config/security');

      expect(CORS_CONFIG.credentials).toBe(true);
    });

    it('should use custom origins from environment', async () => {
      process.env.CORS_ORIGINS = 'https://app.example.com,https://admin.example.com';
      jest.resetModules();

      const { CORS_CONFIG } = await import('../../../src/config/security');

      expect(CORS_CONFIG.allowedOrigins).toContain('https://app.example.com');
      expect(CORS_CONFIG.allowedOrigins).toContain('https://admin.example.com');
    });
  });

  describe('Security Headers Configuration', () => {
    it('should have Content-Security-Policy', async () => {
      const { SECURITY_HEADERS_CONFIG } = await import('../../../src/config/security');

      expect(SECURITY_HEADERS_CONFIG.contentSecurityPolicy).toBeDefined();
      expect(SECURITY_HEADERS_CONFIG.contentSecurityPolicy).toContain("default-src 'self'");
    });

    it('should have X-Frame-Options set to DENY', async () => {
      const { SECURITY_HEADERS_CONFIG } = await import('../../../src/config/security');

      expect(SECURITY_HEADERS_CONFIG.xFrameOptions).toBe('DENY');
    });

    it('should have X-Content-Type-Options set to nosniff', async () => {
      const { SECURITY_HEADERS_CONFIG } = await import('../../../src/config/security');

      expect(SECURITY_HEADERS_CONFIG.xContentTypeOptions).toBe('nosniff');
    });

    it('should have X-XSS-Protection enabled', async () => {
      const { SECURITY_HEADERS_CONFIG } = await import('../../../src/config/security');

      expect(SECURITY_HEADERS_CONFIG.xXssProtection).toBe('1; mode=block');
    });

    it('should have Strict-Transport-Security', async () => {
      const { SECURITY_HEADERS_CONFIG } = await import('../../../src/config/security');

      expect(SECURITY_HEADERS_CONFIG.strictTransportSecurity).toContain('max-age=');
      expect(SECURITY_HEADERS_CONFIG.strictTransportSecurity).toContain('includeSubDomains');
    });

    it('should have Referrer-Policy', async () => {
      const { SECURITY_HEADERS_CONFIG } = await import('../../../src/config/security');

      expect(SECURITY_HEADERS_CONFIG.referrerPolicy).toBe('strict-origin-when-cross-origin');
    });

    it('should have Permissions-Policy', async () => {
      const { SECURITY_HEADERS_CONFIG } = await import('../../../src/config/security');

      expect(SECURITY_HEADERS_CONFIG.permissionsPolicy).toContain('camera=()');
      expect(SECURITY_HEADERS_CONFIG.permissionsPolicy).toContain('microphone=()');
    });
  });

  describe('CSRF Configuration', () => {
    it('should have token settings', async () => {
      const { CSRF_CONFIG } = await import('../../../src/config/security');

      expect(CSRF_CONFIG.tokenLength).toBe(32);
      expect(CSRF_CONFIG.headerName).toBe('X-CSRF-Token');
      expect(CSRF_CONFIG.cookieName).toBe('csrf_token');
    });

    it('should have cookie settings', async () => {
      const { CSRF_CONFIG } = await import('../../../src/config/security');

      expect(CSRF_CONFIG.sameSite).toBe('strict');
      expect(CSRF_CONFIG.httpOnly).toBe(false); // Must be readable by JS
      expect(CSRF_CONFIG.maxAge).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('File Upload Configuration', () => {
    it('should have max file size of 50MB', async () => {
      const { FILE_UPLOAD_CONFIG } = await import('../../../src/config/security');

      expect(FILE_UPLOAD_CONFIG.maxFileSize).toBe(50 * 1024 * 1024);
    });

    it('should have max files limit', async () => {
      const { FILE_UPLOAD_CONFIG } = await import('../../../src/config/security');

      expect(FILE_UPLOAD_CONFIG.maxFiles).toBe(10);
    });

    it('should have allowed MIME types', async () => {
      const { FILE_UPLOAD_CONFIG } = await import('../../../src/config/security');

      expect(FILE_UPLOAD_CONFIG.allowedMimeTypes).toContain('application/pdf');
      expect(FILE_UPLOAD_CONFIG.allowedMimeTypes).toContain('image/jpeg');
      expect(FILE_UPLOAD_CONFIG.allowedMimeTypes).toContain('image/png');
    });

    it('should have allowed extensions', async () => {
      const { FILE_UPLOAD_CONFIG } = await import('../../../src/config/security');

      expect(FILE_UPLOAD_CONFIG.allowedExtensions).toContain('.pdf');
      expect(FILE_UPLOAD_CONFIG.allowedExtensions).toContain('.docx');
      expect(FILE_UPLOAD_CONFIG.allowedExtensions).toContain('.jpg');
    });

    it('should have virus scan settings', async () => {
      const { FILE_UPLOAD_CONFIG } = await import('../../../src/config/security');

      expect(FILE_UPLOAD_CONFIG.virusScan).toBeDefined();
      expect(FILE_UPLOAD_CONFIG.virusScan.timeout).toBe(30000);
      expect(FILE_UPLOAD_CONFIG.virusScan.quarantinePath).toBeDefined();
    });

    it('should enable virus scanning in production', async () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();

      const { FILE_UPLOAD_CONFIG } = await import('../../../src/config/security');

      expect(FILE_UPLOAD_CONFIG.virusScan.enabled).toBe(true);
    });
  });

  describe('Sanitization Configuration', () => {
    it('should have HTML sanitization options', async () => {
      const { SANITIZE_CONFIG } = await import('../../../src/config/security');

      expect(SANITIZE_CONFIG.html.allowedTags).toBeDefined();
      expect(SANITIZE_CONFIG.html.allowedTags).toContain('p');
      expect(SANITIZE_CONFIG.html.allowedTags).toContain('a');
      expect(SANITIZE_CONFIG.html.allowedTags).not.toContain('script');
    });

    it('should have allowed URL schemes', async () => {
      const { SANITIZE_CONFIG } = await import('../../../src/config/security');

      expect(SANITIZE_CONFIG.html.allowedSchemes).toContain('https');
      expect(SANITIZE_CONFIG.html.allowedSchemes).toContain('mailto');
      expect(SANITIZE_CONFIG.html.allowedSchemes).not.toContain('javascript');
    });

    it('should have max length limits', async () => {
      const { SANITIZE_CONFIG } = await import('../../../src/config/security');

      expect(SANITIZE_CONFIG.maxLengths.name).toBe(255);
      expect(SANITIZE_CONFIG.maxLengths.email).toBe(254);
      expect(SANITIZE_CONFIG.maxLengths.description).toBe(10000);
    });
  });

  describe('Account Lockout Configuration', () => {
    it('should have lockout settings', async () => {
      const { LOCKOUT_CONFIG } = await import('../../../src/config/security');

      expect(LOCKOUT_CONFIG.maxFailedAttempts).toBe(5);
      expect(LOCKOUT_CONFIG.lockoutDuration).toBe(15 * 60 * 1000);
      expect(LOCKOUT_CONFIG.resetFailedAttemptsAfter).toBe(60 * 60 * 1000);
    });
  });

  describe('Audit Configuration', () => {
    it('should have mandatory audit events', async () => {
      const { AUDIT_CONFIG } = await import('../../../src/config/security');

      expect(AUDIT_CONFIG.mandatoryEvents).toContain('auth.login');
      expect(AUDIT_CONFIG.mandatoryEvents).toContain('auth.login_failed');
      expect(AUDIT_CONFIG.mandatoryEvents).toContain('application.submit');
      expect(AUDIT_CONFIG.mandatoryEvents).toContain('gdpr.export');
    });

    it('should have 7-year retention in production', async () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();

      const { AUDIT_CONFIG } = await import('../../../src/config/security');

      expect(AUDIT_CONFIG.retentionDays).toBe(2555); // ~7 years
    });

    it('should not log sensitive data in production', async () => {
      process.env.NODE_ENV = 'production';
      jest.resetModules();

      const { AUDIT_CONFIG } = await import('../../../src/config/security');

      expect(AUDIT_CONFIG.logSensitiveData).toBe(false);
    });
  });

  describe('GDPR Configuration', () => {
    it('should have default retention period', async () => {
      const { GDPR_CONFIG } = await import('../../../src/config/security');

      expect(GDPR_CONFIG.defaultRetentionDays).toBe(2555); // 7 years
    });

    it('should have export settings', async () => {
      const { GDPR_CONFIG } = await import('../../../src/config/security');

      expect(GDPR_CONFIG.export.format).toBe('json');
      expect(GDPR_CONFIG.export.maxProcessingTime).toBe(24 * 60 * 60 * 1000);
      expect(GDPR_CONFIG.export.downloadLinkValidityHours).toBe(72);
    });

    it('should have deletion settings', async () => {
      const { GDPR_CONFIG } = await import('../../../src/config/security');

      expect(GDPR_CONFIG.deletion.gracePeriodDays).toBe(30);
      expect(GDPR_CONFIG.deletion.anonymizeInsteadOfDelete).toBe(true);
    });

    it('should have consent version', async () => {
      const { GDPR_CONFIG } = await import('../../../src/config/security');

      expect(GDPR_CONFIG.consentVersion).toBeDefined();
    });
  });

  describe('RBAC Configuration', () => {
    it('should have role hierarchy', async () => {
      const { RBAC_CONFIG } = await import('../../../src/config/security');

      expect(RBAC_CONFIG.roleHierarchy.applicant).toBe(0);
      expect(RBAC_CONFIG.roleHierarchy.assessor).toBe(1);
      expect(RBAC_CONFIG.roleHierarchy.coordinator).toBe(2);
      expect(RBAC_CONFIG.roleHierarchy.scheme_owner).toBe(3);
    });

    it('should define super admin role', async () => {
      const { RBAC_CONFIG } = await import('../../../src/config/security');

      expect(RBAC_CONFIG.superAdminRole).toBeDefined();
    });

    it('should configure permission inheritance', async () => {
      const { RBAC_CONFIG } = await import('../../../src/config/security');

      expect(RBAC_CONFIG.inheritPermissions).toBeDefined();
    });
  });

  describe('Security Notifications Configuration', () => {
    it('should have notification events', async () => {
      const { SECURITY_NOTIFICATIONS } = await import('../../../src/config/security');

      expect(SECURITY_NOTIFICATIONS.notifyOnEvents).toContain('auth.login_failed');
      expect(SECURITY_NOTIFICATIONS.notifyOnEvents).toContain('auth.password_change');
    });

    it('should have failed login threshold', async () => {
      const { SECURITY_NOTIFICATIONS } = await import('../../../src/config/security');

      expect(SECURITY_NOTIFICATIONS.failedLoginNotificationThreshold).toBe(3);
    });

    it('should have admin email', async () => {
      const { SECURITY_NOTIFICATIONS } = await import('../../../src/config/security');

      expect(SECURITY_NOTIFICATIONS.adminEmail).toBeDefined();
    });
  });

  describe('Combined Security Config Export', () => {
    it('should export all configs as single object', async () => {
      const { SECURITY_CONFIG } = await import('../../../src/config/security');

      expect(SECURITY_CONFIG.jwt).toBeDefined();
      expect(SECURITY_CONFIG.password).toBeDefined();
      expect(SECURITY_CONFIG.bcrypt).toBeDefined();
      expect(SECURITY_CONFIG.session).toBeDefined();
      expect(SECURITY_CONFIG.rateLimit).toBeDefined();
      expect(SECURITY_CONFIG.cors).toBeDefined();
      expect(SECURITY_CONFIG.headers).toBeDefined();
      expect(SECURITY_CONFIG.csrf).toBeDefined();
      expect(SECURITY_CONFIG.fileUpload).toBeDefined();
      expect(SECURITY_CONFIG.sanitize).toBeDefined();
      expect(SECURITY_CONFIG.lockout).toBeDefined();
      expect(SECURITY_CONFIG.audit).toBeDefined();
      expect(SECURITY_CONFIG.gdpr).toBeDefined();
      expect(SECURITY_CONFIG.rbac).toBeDefined();
      expect(SECURITY_CONFIG.notifications).toBeDefined();
    });

    it('should export environment flags', async () => {
      const { SECURITY_CONFIG } = await import('../../../src/config/security');

      expect(typeof SECURITY_CONFIG.isProduction).toBe('boolean');
      expect(typeof SECURITY_CONFIG.isTest).toBe('boolean');
    });

    it('should have default export', async () => {
      const defaultConfig = await import('../../../src/config/security');

      expect(defaultConfig.default).toBeDefined();
    });
  });
});
