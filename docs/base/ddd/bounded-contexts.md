# Bounded Contexts

**Funding Application Submission & Assessment Platform**

This document defines the six bounded contexts of the platform, the entities each owns, their relationships, and the anti-corruption layers at context boundaries.

---

## Context Map

```
+---------------------+        +---------------------+
|  CALL MANAGEMENT    |<-------+    SUBMISSION        |
|  CONTEXT            | CallRef|    CONTEXT            |
|                     |        |                       |
| FundingCall         |        | Application           |
| CallConfiguration   |        | ApplicationFile       |
| Criterion[]         |        | Confirmation          |
| AssessorPoolMember  |        | Applicant (User ref)  |
+----------+----------+        +----------+------------+
           |                              |
    Status |                    Assignment |
    Events |                     Ref       |
           v                              v
+---------------------+        +---------------------+
|     ASSESSMENT      |<-------+      RESULTS         |
|     CONTEXT         | Scores |      CONTEXT          |
|                     |        |                       |
| Assignment          |        | ApplicationResult     |
| Assessment          |        | CriterionAggregate    |
| CriterionScore      |        | AssessorScore         |
| COIDeclaration      |        | MasterResultsResponse |
+---------------------+        | VarianceFlag          |
                               | CallProgress          |
+---------------------+        +---------------------+
|  USER MANAGEMENT    |
|  CONTEXT            |        +---------------------+
|                     |        |      AUDIT           |
| User                |        |      CONTEXT          |
| Role                |        |                       |
| Permission          |        | AuditLog             |
| Session             |        | AuditAction          |
| UserIdentity (Nostr)|        | NotificationLog      |
+---------------------+        +---------------------+
```

---

## 1. Call Management Context

### Purpose

Manages the configuration and lifecycle of funding calls. This is the primary context for coordinators to set up application windows, define assessment criteria, and manage assessor pools.

### Entities Owned

| Entity | Role | Source File |
|--------|------|-------------|
| **FundingCall** | Aggregate root | `/backend/src/models/fundingCall.model.ts` |
| **Criterion** | Value object (embedded JSON) | `/backend/src/types/index.ts` lines 183-191 |
| **SubmissionRequirements** | Value object (embedded JSON) | `/backend/src/types/index.ts` lines 193-200 |
| **AssessorPoolMember** | Entity (junction) | `/backend/src/models/fundingCall.model.ts` lines 329-381 |

### Key Invariants

1. `close_at` must be after `open_at` (enforced by DB constraint `funding_calls_dates_check`)
2. Status transitions follow a strict linear path: Draft -> Open -> Closed -> In Assessment -> Completed -> Archived (enforced by `isValidStatusTransition()` in model)
3. Only draft calls can be deleted
4. Criteria must be defined before a call can be opened for assessment
5. Retention policy must be between 1 and 100 years

### Relationships to Other Contexts

| Target Context | Relationship Type | Integration Pattern |
|---------------|-------------------|---------------------|
| Submission | Published Language | Application references `call_id`; submission deadline and requirements read from FundingCall |
| Assessment | Customer-Supplier | Assessment context consumes criteria and assessor pool; Call Management is the supplier |
| User Management | Conformist | AssessorPoolMember references User; uses `user_id` FK |
| Audit | Published Language | Controller emits audit log entries on create, update, status change, clone |

### Anti-Corruption Layer

The Call Management context shields itself from external concerns:
- Criteria are stored as embedded JSON, not as separate normalised tables, preventing external contexts from modifying scoring rubrics directly
- AssessorPoolMember soft-deletes via `is_active` flag rather than hard deletion, preserving referential integrity with the Assessment context
- Status transition validation is encapsulated within `FundingCallModel.isValidStatusTransition()` and cannot be bypassed by other contexts

### Implementation Notes

The `calls.controller.ts` serves as the application service for this context. It coordinates between the model, validation schemas, and audit middleware. Demo data fallback exists in `listCalls` and `listOpenCalls` for when the database is unavailable.

---

## 2. Submission Context

### Purpose

Handles the applicant journey: creating draft applications, uploading files, completing confirmations, and submitting before the deadline.

### Entities Owned

| Entity | Role | Source File |
|--------|------|-------------|
| **Application** | Aggregate root | `/backend/src/models/application.model.ts` |
| **ApplicationFile** | Entity (child) | `/backend/src/models/application.model.ts` lines 295-366 |
| **Confirmation** | Entity (child) | `/backend/src/models/application.model.ts` lines 375-433 |

### Key Invariants

1. An application cannot be submitted without all required confirmations (`hasAllConfirmations()` method)
2. An application cannot be submitted after the call's `close_at` deadline (enforced in Europe/London timezone, server-side)
3. Submitted applications are locked for editing
4. Reference numbers are auto-generated in the format `{CALL_PREFIX}-{YEAR}-{SEQUENCE}` (database trigger `generate_application_reference`)
5. The `submitted_at` timestamp must be non-null when status is `submitted` (DB constraint `applications_submitted_check`)
6. Files must pass virus scanning before storage (currently stubbed)

### Relationships to Other Contexts

| Target Context | Relationship Type | Integration Pattern |
|---------------|-------------------|---------------------|
| Call Management | Customer-Supplier | Reads call configuration for requirements validation; Application is the customer |
| Assessment | Published Language | Applications become assessment targets via Assignment; Application ID is the shared identifier |
| User Management | Conformist | `applicant_id` references User entity |
| Audit | Published Language | Emits audit entries for create, submit, withdraw, reopen, file upload/download/delete |

### Anti-Corruption Layer

- The Submission context maintains its own denormalised `applicant_name`, `applicant_email`, and `applicant_organisation` fields on the Application entity rather than always joining to the User table. This ensures application records remain stable even if user profiles change.
- File storage is abstracted through `FileService` which adapts between S3 and local storage, preventing storage infrastructure details from leaking into the domain model.
- Reference number generation is delegated to the database via a trigger, preventing application code from generating inconsistent references.

### Implementation Notes

Two implementations coexist for the applications controller:
1. `ApplicationModel` class in `/backend/src/models/application.model.ts` (structured model pattern)
2. `applicationsController` in `/backend/src/controllers/applications.controller.ts` (direct pool queries)

This is a gap -- the controller bypasses the model layer in many operations, leading to inconsistent data access patterns.

---

## 3. Assessment Context

### Purpose

Manages the assignment of applications to assessors and the capture of structured evaluation scores, comments, and conflict-of-interest declarations.

### Entities Owned

| Entity | Role | Source File |
|--------|------|-------------|
| **Assignment** | Entity | `/backend/src/models/assessment.model.ts` lines 15-255 (`AssignmentModel`) |
| **Assessment** | Aggregate root | `/backend/src/models/assessment.model.ts` lines 258-488 (`AssessmentModel`) |
| **CriterionScore** | Value object (embedded JSON) | `/backend/src/types/index.ts` lines 375-379 |

### Key Invariants

1. Each application-assessor pair has at most one assignment (DB constraint `assignments_unique`)
2. Each assignment produces at most one assessment (DB constraint on `assignment_id UNIQUE`)
3. An assessment cannot be submitted without COI confirmation (`assessments_submitted_check` constraint)
4. Scores must be within valid ranges (0 to `max_points` per criterion) -- validated by `ScoringService.validateScores()`
5. Assessors can only view and assess their own assignments
6. A submitted assessment is locked; only coordinators can return it for revision
7. Bulk assignment uses round-robin distribution to balance workload

### Relationships to Other Contexts

| Target Context | Relationship Type | Integration Pattern |
|---------------|-------------------|---------------------|
| Submission | Customer-Supplier | Reads Application data for assessor review; Assessment is the customer |
| Call Management | Customer-Supplier | Reads Criterion definitions for validation; consumes assessor pool |
| Results | Published Language | Assessment scores are consumed by ScoringService for aggregation |
| User Management | Conformist | `assessor_id` and `assigned_by` reference User entity |
| Audit | Published Language | Emits audit entries for assignment, assessment creation/update/submit/return |

### Anti-Corruption Layer

- The `AssignmentModel.belongsToAssessor()` method enforces that assessors can only interact with their own assignments, providing an access boundary
- The `AssessmentModel.createOrGet()` pattern ensures idempotent assessment creation, preventing duplicate assessments
- Score validation through `ScoringService.validateScores()` acts as a gateway, ensuring only valid scores enter the system
- The assessment submission flow atomically updates both the assessment status and the parent assignment status

### Implementation Notes

Assignment and Assessment models share a single file (`assessment.model.ts`) because they have a tight 1:1 relationship and always change together during the assessment submission workflow. The controller layer splits these into `assessments.controller.ts` and `assignments.controller.ts`.

---

## 4. Results Context

### Purpose

Aggregates assessment data into master results for coordinator decision-making. This is a read-heavy context that computes rankings, averages, variance flags, and exports.

### Entities Owned (Read Models)

| Entity | Role | Source File |
|--------|------|-------------|
| **ApplicationResult** | Read model | `/backend/src/types/index.ts` lines 443-456 |
| **CriterionAggregate** | Read model | `/backend/src/types/index.ts` lines 430-441 |
| **AssessorScore** | Read model | `/backend/src/types/index.ts` lines 421-428 |
| **MasterResultsResponse** | Read model | `/backend/src/types/index.ts` lines 458-469 |
| **CallProgress** | Read model | `/backend/src/types/index.ts` lines 612-622 |
| **AssessorProgress** | Read model | `/backend/src/types/index.ts` lines 602-610 |

### Key Computations

1. **Average score** per criterion and per application (arithmetic mean)
2. **Weighted average** when criteria have weights defined
3. **Variance** per criterion and overall, with high-variance flagging based on configurable threshold
4. **Ranking** by total or weighted average score (descending)
5. **Progress tracking** showing completion percentages per assessor

### Relationships to Other Contexts

| Target Context | Relationship Type | Integration Pattern |
|---------------|-------------------|---------------------|
| Assessment | Customer-Supplier | Reads submitted assessments with scores; Results is the customer |
| Call Management | Conformist | Reads criteria definitions and variance thresholds |
| Submission | Conformist | Reads application metadata for result presentation |
| Audit | Published Language | Emits audit entries for results view and export |

### Anti-Corruption Layer

- Results are computed on-demand rather than persisted, ensuring they always reflect the current state of assessments
- The `ScoringService` class in `/backend/src/services/scoring.service.ts` acts as the domain service that encapsulates all aggregation logic, shielding results consumers from the complexity of multi-table queries
- Export logic is isolated in `ExportService` (`/backend/src/services/export.service.ts`), preventing presentation format concerns from affecting computation
- Access to master results is restricted to the coordinator role (enforced at controller/middleware level)

### Implementation Notes

The results controller (`/backend/src/controllers/results.controller.ts`) contains several SQL aggregation queries that partially duplicate logic in `ScoringService`. The controller performs direct database queries for `getMasterResults`, `getSummary`, `getVarianceFlags`, and `getRanking`, while `ScoringService` provides a programmatic aggregation layer. This represents a gap where the Results context lacks a single authoritative computation path.

---

## 5. User Management Context

### Purpose

Handles user registration, authentication, authorization, profile management, and decentralised identity (Nostr DID) integration.

### Entities Owned

| Entity | Role | Source File |
|--------|------|-------------|
| **User** | Aggregate root | `/backend/src/models/user.model.ts` |
| **UserIdentity (Nostr)** | Entity (child) | `/database/migrations/003_user_identities.sql` |
| **Session** | Entity | `/database/migrations/001_initial_schema.sql` lines 450-464 |

### Supporting Types

| Type | Role | Source File |
|------|------|-------------|
| **Permission** | Enumeration | `/backend/src/types/security.types.ts` lines 15-65 |
| **JWTPayload** | Value object | `/backend/src/types/security.types.ts` lines 68-79 |
| **PasswordPolicy** | Value object | `/backend/src/types/security.types.ts` lines 118-127 |
| **GDPRConsent** | Value object | `/backend/src/types/security.types.ts` lines 272-280 |

### Key Invariants

1. Email addresses must be unique (DB constraint `users_email_check`)
2. Passwords are hashed with bcrypt (12 salt rounds)
3. Users must have exactly one role
4. Soft deletion via `is_active = false` rather than hard delete
5. Each user can link at most one Nostr identity (constraint `user_identities_user_unique`)
6. DID must match format `did:nostr:<pubkey>` (DB trigger `validate_user_identity_did`)

### Relationships to Other Contexts

| Target Context | Relationship Type | Integration Pattern |
|---------------|-------------------|---------------------|
| Call Management | Published Language | Users are referenced as `created_by` on calls and as assessor pool members |
| Submission | Published Language | Users are referenced as `applicant_id` on applications |
| Assessment | Published Language | Users are referenced as `assessor_id` on assignments |
| Audit | Published Language | Users are referenced as `actor_id` on audit logs |
| All Contexts | Open Host Service | JWT-based authentication middleware provides identity to all API endpoints |

### Anti-Corruption Layer

- `UserModel.toPublic()` strips sensitive data (password hash, MFA secrets) before returning user data to other contexts
- The `AuthenticatedUser` interface (slim subset of User) is what other contexts receive through the request pipeline, preventing access to sensitive fields
- Password verification and hashing are encapsulated within `UserModel`, preventing other contexts from handling raw credentials
- RBAC permissions defined in `security.types.ts` create a formal access control layer between contexts

### Implementation Notes

The User Management context has a structural divergence between the migration schema and the TypeScript types:
- Migration `001` defines `users.name` as a single field; the model expects `first_name` and `last_name`
- Migration `001` uses `users.id`; the model expects `users.user_id`

This suggests the model layer operates against a different schema version than what migration 001 creates. Either the actual database has been modified since the migration, or there is an intermediary migration that alters these columns.

---

## 6. Audit Context

### Purpose

Provides an immutable, append-only record of all significant actions for governance, compliance, and security investigation.

### Entities Owned

| Entity | Role | Source File |
|--------|------|-------------|
| **AuditLog** | Aggregate root | `/backend/src/models/auditLog.model.ts` |
| **NotificationLog** | Entity | `/database/migrations/001_initial_schema.sql` lines 419-442 |

### Key Invariants

1. Audit logs are append-only (enforced by DB rules `audit_logs_no_update` and `audit_logs_no_delete`)
2. Every significant action across all contexts must produce an audit entry
3. Actor information is denormalised into the log entry to survive user deletion
4. Data retention is governed by per-call `retention_years` configuration

### Relationships to Other Contexts

| Source Context | Integration Pattern |
|---------------|---------------------|
| All Contexts | Published Language -- all controllers emit audit entries via `createAuditLog()` middleware |

### Anti-Corruption Layer

- The audit context is write-only from the perspective of other contexts; they emit events but never read audit data (except coordinators via the API)
- Database rules physically prevent modification of audit records, even by admin users
- The `AuditLogModel.deleteOlderThan()` method is the only deletion pathway, intended for GDPR data retention compliance
- Audit entries are created via a dedicated middleware function (`createAuditLog` in `/backend/src/middleware/audit.middleware.ts`), decoupling audit emission from business logic

### Implementation Notes

The `notification_logs` table exists in the migration but has no corresponding TypeScript model or service. Email sending is handled by `EmailService` but delivery tracking/status is not persisted. This is a gap -- sent notifications cannot currently be queried through the platform.

---

## Cross-Context Communication Summary

| From | To | Mechanism | Data Exchanged |
|------|----|-----------|----------------|
| Call Management | Submission | Shared database FK | `call_id`, requirements, deadlines |
| Call Management | Assessment | Shared database FK + JSON | `call_id`, criteria, assessor pool |
| Submission | Assessment | Shared database FK | `application_id` via Assignment |
| Assessment | Results | Database query + service | Assessment scores, criterion IDs |
| All | User Management | JWT middleware | `AuthenticatedUser` on request object |
| All | Audit | Middleware function | `AuditLogCreateInput` records |

All cross-context communication currently uses shared database access (no message bus or event streaming). This is appropriate for the monolithic architecture but represents a coupling point if contexts were to be separated into services.
