# ADR-009: Audit Logging Strategy

## Status
Accepted

## Context
PRD 12.4 mandates immutable logging of all significant actions: application submissions, file downloads, assessor assignments, assessment submissions, administrative overrides, login/logout events, and configuration changes. The audit trail must support GDPR compliance (PRD 12.3) and governance review. Retention period is 7 years in production (NFR-013).

## Decision
We implement a **multi-layer audit logging system** with database-level immutability enforcement and application-level structured logging.

### Database Layer

**Audit logs table** (`database/migrations/001_initial_schema.sql`):
- Columns: event_id (UUID PK), actor_id, actor_role, actor_email, action, target_type, target_id, details (JSONB), ip_address, user_agent, request_id, timestamp.
- **Immutability enforced via PostgreSQL RULEs:**
  - `audit_logs_no_update`: UPDATE operations silently ignored.
  - `audit_logs_no_delete`: DELETE operations silently ignored.
- Comprehensive indexing: timestamp DESC, actor_id, action, target (type + id), action + timestamp, request_id, ip_address.

### Application Layer

**Audit Service** (`backend/src/security/audit.service.ts`):
- Structured `AuditLogEntry` type with eventId, actorId, actorRole, action, targetType, targetId, details, ipAddress, userAgent, timestamp, success, errorMessage.
- 40+ audit actions defined in `AuditAction` enum covering auth, application, file, assessment, assignment, call, assessor, results, user, GDPR, config, and system events.
- 10 target types: user, application, assessment, assignment, funding_call, file, assessor, results, system, config.
- Specialized logging methods: `logAuth()`, `logLogin()`, `logLogout()`, `logPasswordChange()`, `logApplicationEvent()`, `logFileOperation()`, `logAssessmentEvent()`, `logCallEvent()`, `logUserManagement()`, `logGDPREvent()`, `logSystemError()`, `logRateLimitExceeded()`.

**Security features:**
- Sensitive data sanitization: password, token, secret, apiKey, creditCard values replaced with `[REDACTED]`.
- IP address anonymization: IPv4 last octet zeroed, IPv6 truncated to first 4 groups (GDPR compliance).
- Mandatory events list enforced (`AUDIT_CONFIG.mandatoryEvents`): auth.login, auth.login_failed, auth.logout, auth.password_change, application.submit, file.download, assessment.submit, call.create, call.status_change, user.role_change, gdpr.export, gdpr.delete.

**Audit Middleware** (`backend/src/middleware/audit.middleware.ts`):
- Applied to all `/api/` routes via `app.use('/api/', auditMiddleware)`.
- Captures request context (IP, user agent, user) for all API calls.

**Querying and export:**
- `query()` method with filtering by actor, role, action, target, date range, success, with pagination.
- `exportLogs()` supporting JSON and CSV formats for compliance reporting.
- `getSecurityEvents()` for security-focused queries.
- `getStatistics()` for dashboard metrics (totals, by action, by target type, by role).

**Configuration:**
- Retention: 2555 days (7 years) in production, 90 days in development.
- Sensitive data logging disabled in production.

## Consequences

### Positive
- Database-level immutability prevents tampering even with direct database access.
- Structured audit events enable automated compliance reporting and anomaly detection.
- IP anonymization supports GDPR requirements while retaining enough information for security investigations.
- The mandatory events list ensures critical actions are never silently dropped.

### Negative
- **GAP: Audit service currently uses in-memory storage.** The `persistEntry()` method stores to an array rather than the database. Production deployment must wire this to the `audit_logs` table.
- Audit log volume will grow significantly over 7 years. Partitioning by month or year should be implemented for production.
- The no-update/no-delete rules prevent correction of erroneous entries. An addendum/correction pattern should be established.

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **External audit service (Datadog, Splunk)** | Adds external dependency and cost. Self-hosted database storage is simpler and keeps data within UK/EU boundaries. External services can be used in addition to, not instead of, database logging. |
| **Event sourcing for full state reconstruction** | Architecturally sound but adds significant complexity. The current approach logs significant actions, which is sufficient for audit compliance. |
| **Append-only log file** | Difficult to query, no indexing, harder to secure against tampering. Database with immutability rules is superior. |
