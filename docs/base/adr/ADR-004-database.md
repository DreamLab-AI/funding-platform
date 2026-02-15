# ADR-004: Database Technology

## Status
Accepted

## Context
The platform manages relational data with complex relationships: funding calls contain criteria configurations, applications reference calls and contain files and confirmations, assignments link applications to assessors, and assessments reference assignments with structured scoring data. The PRD specifies PostgreSQL as the recommended database (Section 8.2) and UUID primary keys (Appendix B.7).

## Decision
We use **PostgreSQL 15** with UUID primary keys, JSONB columns for flexible configuration, and database-level enforcement of business rules.

Schema design (defined in `database/migrations/001_initial_schema.sql`):

**Core Tables:**
- `users` (UUID PK, email, password_hash, role enum, email_verified, locked_until, soft delete via deleted_at)
- `funding_calls` (UUID PK, name, description, open_at/close_at TIMESTAMPTZ, status enum, requirements JSONB, criteria_config JSONB, retention_policy, edi_form_url)
- `applications` (UUID PK, call_id FK, applicant_id FK, reference_number UNIQUE, status enum, submitted_at, receipt tracking)
- `application_files` (UUID PK, application_id FK, filename, file_path, file_size, mime_type, file_hash SHA-256, scan_status enum, category)
- `confirmations` (UUID PK, application_id FK, type enum, confirmed_at, ip_address, UNIQUE(application_id, type))
- `assessors` (UUID PK, user_id FK optional, name, email, organisation, expertise_tags JSONB)
- `call_assessor_pool` (UUID PK, call_id FK, assessor_id FK, UNIQUE(call_id, assessor_id))
- `assignments` (UUID PK, application_id FK, assessor_id FK, status enum, UNIQUE(application_id, assessor_id))
- `assessments` (UUID PK, assignment_id FK UNIQUE, scores_json JSONB, overall_score DECIMAL, coi_confirmed, status enum)
- `audit_logs` (UUID PK, actor_id, action, target_type, target_id, details JSONB, ip_address, timestamp, RULES: no UPDATE, no DELETE)
- `notification_logs` (UUID PK, recipient tracking, external_message_id, status)
- `sessions` (UUID PK, user_id FK, token_hash SHA-256 UNIQUE, expires_at, revoked_at)

**Extensions (Migration 003):**
- `user_identities` (Nostr DID integration with nostr_pubkey, nip05_identifier, did)
- `nostr_auth_challenges` (short-lived authentication challenges)
- `users_with_nostr` VIEW joining users to their Nostr identities

**Database-level constraints:**
- `funding_calls_dates_check`: close_at > open_at
- `applications_submitted_check`: submitted_at required when status = 'submitted'
- `assessments_submitted_check`: submitted_at and coi_confirmed required when status = 'submitted'
- `application_files_size_check`: file_size > 0 AND <= 52428800 (50MB)
- Email format regex constraints on users, applications, assessors tables
- Audit log immutability via PostgreSQL RULEs preventing UPDATE and DELETE

**Indexing strategy (Migration 002):**
- 50+ indexes covering common query patterns: status filtering, call-based lookups, assessor workload, full-text search on applicant names and call descriptions, GIN indexes on JSONB columns, partial indexes for active records and pending scans.
- Composite indexes for coordinator views (applications by call + status + submitted_at) and assessor views (assignments by assessor + status).

**Automated features:**
- `update_updated_at_column()` trigger on all mutable tables
- `generate_application_reference()` trigger generating human-readable references (e.g., FUND-2026-0001)
- `cleanup_expired_nostr_challenges()` function for maintenance

## Consequences

### Positive
- Relational integrity with foreign keys prevents orphaned records across the call-application-assignment-assessment chain.
- JSONB columns provide flexibility for criteria_config and scores_json without schema migrations when assessment rubric structures evolve.
- Database-level constraints enforce critical business rules (deadline ordering, file size limits, COI confirmation) as a safety net below the application layer.
- UUID primary keys prevent enumeration attacks and support future distributed deployments.
- Audit log immutability is enforced at the database level, not just the application level.

### Negative
- JSONB columns sacrifice some query optimization compared to normalized tables. Mitigation: GIN indexes on JSONB columns.
- UUID primary keys are larger than integers (16 bytes vs 4 bytes), increasing index size.
- The application reference number generation trigger uses a sequence query that could have race conditions under very high concurrency. Mitigation: the UNIQUE constraint on reference_number prevents duplicates.

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **MySQL/MariaDB** | Weaker JSONB support, no native UUID type, less mature constraint system. PostgreSQL's JSONB with GIN indexing is a better fit for flexible configuration storage. |
| **MongoDB** | Document model is attractive for flexible schemas, but the platform's data has strong relational semantics (call -> application -> assignment -> assessment chain). Referential integrity is critical for audit compliance. |
| **SQLite** | Insufficient for concurrent access from multiple server processes. Not suitable for production deployment. |
