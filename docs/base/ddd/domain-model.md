# Domain Model

**Funding Application Submission & Assessment Platform**

This document defines the core domain entities, value objects, and their relationships as implemented in the codebase. Each concept is mapped to its concrete source files.

---

## 1. Domain Overview

The platform manages the lifecycle of funding applications from submission through structured assessment to consolidated results. The domain centres on four core aggregates (FundingCall, Application, Assessment, User) and a cross-cutting Audit concern.

```
FundingCall (1) ----< (N) Application (1) ----< (N) ApplicationFile
     |                       |
     |                       +----< (N) Confirmation
     |                       |
     +----< (N) AssessorPool |
     |       Member          +----< (N) Assignment (1) ----< (1) Assessment
     |                                    |                        |
     +--- Criterion[]                     |                        +--- CriterionScore[]
     +--- SubmissionRequirements          |                        +--- COIDeclaration
                                          |
                                    User (Assessor)
```

---

## 2. Entities

Entities have identity that persists across state changes.

### 2.1 FundingCall

A time-bounded application window with its own configuration, criteria, and assessor pool.

| Property | Type | Description |
|----------|------|-------------|
| `call_id` | UUID (PK) | Unique identifier |
| `name` | string | Human-readable name |
| `description` | string | Call description |
| `open_at` | timestamptz | When submissions open |
| `close_at` | timestamptz | Submission deadline |
| `status` | CallStatus enum | Lifecycle state |
| `submission_requirements` | JSON (SubmissionRequirements) | File types, sizes, confirmations |
| `criteria` | JSON (Criterion[]) | Assessment rubric |
| `required_assessors_per_application` | integer | How many assessors per application |
| `variance_threshold` | decimal | Threshold for flagging high score variance |
| `retention_years` | integer | GDPR data retention period |
| `created_by` | UUID (FK) | Coordinator who created the call |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification |

**Source files:**
- Type definition: `/backend/src/types/index.ts` (lines 202-217, `FundingCall` interface)
- Model: `/backend/src/models/fundingCall.model.ts` (entire file, `FundingCallModel` class)
- Controller: `/backend/src/controllers/calls.controller.ts`
- Migration: `/database/migrations/001_initial_schema.sql` (lines 94-122, `funding_calls` table)

### 2.2 Application

An applicant submission for a specific funding call, including uploaded files and signed confirmations.

| Property | Type | Description |
|----------|------|-------------|
| `application_id` | UUID (PK) | Unique identifier |
| `call_id` | UUID (FK) | Parent funding call |
| `applicant_id` | UUID (FK) | Submitting user |
| `reference_number` | string (unique) | Human-readable reference (e.g. `INNO-2026-0001`) |
| `applicant_name` | string | Applicant display name |
| `applicant_email` | string | Contact email |
| `applicant_organisation` | string (optional) | Organisation name |
| `status` | ApplicationStatus enum | draft, submitted, withdrawn, reopened |
| `files` | ApplicationFile[] | Uploaded documents (loaded via join) |
| `confirmations` | Confirmation[] | Acknowledgements (loaded via join) |
| `submitted_at` | timestamptz | When the application was submitted |
| `withdrawn_at` | timestamptz | When withdrawn (if applicable) |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification |

**Source files:**
- Type definition: `/backend/src/types/index.ts` (lines 279-294, `Application` interface)
- Model: `/backend/src/models/application.model.ts` (entire file, `ApplicationModel` class)
- Controller: `/backend/src/controllers/applications.controller.ts`
- Migration: `/database/migrations/001_initial_schema.sql` (lines 133-162, `applications` table)

### 2.3 Assignment

Links an application to an assessor, tracking the review lifecycle.

| Property | Type | Description |
|----------|------|-------------|
| `assignment_id` | UUID (PK) | Unique identifier |
| `application_id` | UUID (FK) | Application being assessed |
| `assessor_id` | UUID (FK) | Assigned assessor user |
| `assigned_at` | timestamptz | When assignment was made |
| `assigned_by` | UUID (FK) | Coordinator who assigned |
| `due_at` | timestamptz (optional) | Assessment deadline |
| `status` | AssignmentStatus enum | pending, in_progress, completed, returned |
| `started_at` | timestamptz | When assessor began review |
| `completed_at` | timestamptz | When assessment was completed |

**Source files:**
- Type definition: `/backend/src/types/index.ts` (lines 338-348, `Assignment` interface)
- Model: `/backend/src/models/assessment.model.ts` (lines 15-255, `AssignmentModel` class)
- Controller: `/backend/src/controllers/assignments.controller.ts`
- Migration: `/database/migrations/001_initial_schema.sql` (lines 312-331, `assignments` table)

### 2.4 Assessment

An assessor's evaluation of an assigned application, containing criterion scores, comments, and COI declaration.

| Property | Type | Description |
|----------|------|-------------|
| `assessment_id` | UUID (PK) | Unique identifier |
| `assignment_id` | UUID (FK, unique) | One assessment per assignment |
| `scores` | JSON (CriterionScore[]) | Per-criterion scores and comments |
| `overall_score` | decimal | Calculated aggregate score |
| `overall_comment` | string (optional) | General assessor commentary |
| `coi_confirmed` | boolean | Conflict of interest declaration status |
| `coi_details` | string (optional) | Details if COI exists |
| `status` | AssessmentStatus enum | draft, submitted, returned |
| `submitted_at` | timestamptz | When formally submitted |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last modification |

**Source files:**
- Type definition: `/backend/src/types/index.ts` (lines 381-393, `Assessment` interface)
- Model: `/backend/src/models/assessment.model.ts` (lines 258-488, `AssessmentModel` class)
- Controller: `/backend/src/controllers/assessments.controller.ts`
- Migration: `/database/migrations/001_initial_schema.sql` (lines 340-373, `assessments` table)

### 2.5 User

A platform user who may act as applicant, assessor, coordinator, scheme owner, or admin.

| Property | Type | Description |
|----------|------|-------------|
| `user_id` | UUID (PK) | Unique identifier |
| `email` | string (unique) | Login email |
| `password_hash` | string | bcrypt hashed password |
| `first_name` | string | Given name |
| `last_name` | string | Surname |
| `role` | UserRole enum | applicant, assessor, coordinator, scheme_owner, admin |
| `organisation` | string (optional) | Affiliated organisation |
| `expertise_tags` | string[] (optional) | Areas of expertise (assessors) |
| `is_active` | boolean | Whether account is enabled |
| `email_verified` | boolean | Whether email has been verified |
| `mfa_enabled` | boolean | Multi-factor auth status |
| `last_login_at` | timestamptz | Most recent login |
| `created_at` | timestamptz | Account creation |
| `updated_at` | timestamptz | Last profile update |

**Source files:**
- Type definition: `/backend/src/types/index.ts` (lines 118-133, `User` interface)
- Model: `/backend/src/models/user.model.ts` (entire file, `UserModel` class)
- Controller: `/backend/src/controllers/auth.controller.ts`
- Migration: `/database/migrations/001_initial_schema.sql` (lines 68-84, `users` table)

### 2.6 AuditLog

Immutable record of significant platform actions.

| Property | Type | Description |
|----------|------|-------------|
| `event_id` | UUID (PK) | Unique identifier |
| `actor_id` | UUID (FK, optional) | User who performed the action |
| `actor_role` | UserRole (optional) | Role at time of action |
| `actor_email` | string (optional) | Email preserved even if user deleted |
| `action` | AuditAction enum | What happened |
| `target_type` | string | Entity type affected |
| `target_id` | UUID (optional) | Entity instance affected |
| `details` | JSON | Action-specific context |
| `ip_address` | INET (optional) | Client IP |
| `user_agent` | string (optional) | Client user agent |
| `timestamp` | timestamptz | When the action occurred |

**Source files:**
- Type definition: `/backend/src/types/index.ts` (lines 475-487, `AuditLog` interface)
- Model: `/backend/src/models/auditLog.model.ts` (entire file, `AuditLogModel` class)
- Migration: `/database/migrations/001_initial_schema.sql` (lines 383-413, `audit_logs` table)

---

## 3. Value Objects

Value objects are defined by their attributes, not identity. They are immutable within a single transaction context.

### 3.1 Criterion

Defines one dimension of assessment scoring.

| Property | Type | Description |
|----------|------|-------------|
| `criterion_id` | string | Identifier (UUID generated on creation) |
| `name` | string | Criterion label |
| `description` | string | Guidance text |
| `max_points` | number | Maximum score |
| `weight` | number (optional) | Weighting factor |
| `comments_required` | boolean | Whether assessor must comment |
| `order` | number | Display position |

**Source:** `/backend/src/types/index.ts` (lines 183-191, `Criterion` interface)

Stored as JSONB array within `funding_calls.criteria` column.

### 3.2 SubmissionRequirements

Configurable constraints for what applicants must provide.

| Property | Type | Description |
|----------|------|-------------|
| `allowed_file_types` | string[] | Permitted MIME types or extensions |
| `max_file_size` | number | Maximum bytes per file |
| `required_confirmations` | ConfirmationType[] | Which confirmations are mandatory |
| `guidance_text` | string (optional) | Inline guidance |
| `guidance_url` | string (optional) | Link to external guidance |
| `edi_form_url` | string (optional) | Link to external EDI form |

**Source:** `/backend/src/types/index.ts` (lines 193-200, `SubmissionRequirements` interface)

Stored as JSONB within `funding_calls.submission_requirements` column.

### 3.3 CriterionScore

A single criterion score from one assessor for one application.

| Property | Type | Description |
|----------|------|-------------|
| `criterion_id` | string | Links to parent Criterion |
| `score` | number | Numeric score (0 to max_points) |
| `comment` | string (optional) | Assessor's notes for this criterion |

**Source:** `/backend/src/types/index.ts` (lines 375-379, `CriterionScore` interface)

Stored as JSONB array within `assessments.scores` column.

### 3.4 ApplicationFile

Metadata for a file uploaded as part of an application.

| Property | Type | Description |
|----------|------|-------------|
| `file_id` | UUID | Identifier |
| `application_id` | UUID | Parent application |
| `filename` | string | Storage filename |
| `original_filename` | string | User-provided name |
| `file_path` | string | S3/local path |
| `file_size` | number | Bytes |
| `mime_type` | string | Content type |
| `scan_status` | FileScanStatus enum | pending, clean, infected, error |
| `uploaded_at` | timestamptz | Upload timestamp |

**Source:** `/backend/src/types/index.ts` (lines 259-269, `ApplicationFile` interface)

### 3.5 Confirmation

Record that an applicant acknowledged a required condition.

| Property | Type | Description |
|----------|------|-------------|
| `confirmation_id` | UUID | Identifier |
| `application_id` | UUID | Parent application |
| `type` | ConfirmationType enum | guidance_read, edi_completed, data_sharing_consent |
| `confirmed_at` | timestamptz | When confirmed |
| `ip_address` | string | Client IP for audit |

**Source:** `/backend/src/types/index.ts` (lines 271-277, `Confirmation` interface)

### 3.6 AssessorPoolMember

A link between a user (assessor) and a funding call, representing eligibility to be assigned.

| Property | Type | Description |
|----------|------|-------------|
| `pool_id` | UUID | Identifier |
| `call_id` | UUID | Funding call |
| `user_id` | UUID | Assessor user |
| `invited_at` | timestamptz | When added to pool |
| `accepted_at` | timestamptz (optional) | When invitation accepted |
| `expertise_tags` | string[] (optional) | Per-call expertise tagging |
| `is_active` | boolean | Whether currently in pool |

**Source:** `/backend/src/types/index.ts` (lines 324-332, `AssessorPoolMember` interface)

---

## 4. Enumerations

All enumerations are defined in `/backend/src/types/index.ts` (lines 7-112).

### 4.1 UserRole
`applicant` | `assessor` | `coordinator` | `scheme_owner` | `admin`

### 4.2 CallStatus
`draft` -> `open` -> `closed` -> `in_assessment` -> `completed` -> `archived`

Status transitions are enforced in `FundingCallModel.isValidStatusTransition()` at `/backend/src/models/fundingCall.model.ts` (lines 393-404).

### 4.3 ApplicationStatus
`draft` | `submitted` | `withdrawn` | `reopened`

### 4.4 AssignmentStatus
`pending` | `in_progress` | `completed` | `returned`

Note: The migration uses `assigned` instead of `pending`. This is a divergence between the TypeScript enum and the database enum.

### 4.5 AssessmentStatus
`draft` | `submitted` | `returned`

### 4.6 FileScanStatus
`pending` | `clean` | `infected` | `error`

Note: The migration includes an additional `scanning` value not present in the TypeScript enum.

### 4.7 ConfirmationType
`guidance_read` | `edi_completed` | `data_sharing_consent`

### 4.8 AuditAction
Comprehensive enumeration of all auditable actions: user events, call events, application events, file events, assignment events, assessment events, export events, admin events, and Nostr identity events. See `/backend/src/types/index.ts` (lines 57-112).

---

## 5. Computed/Derived Domain Concepts

These types represent computed read models, not persisted entities.

### 5.1 ApplicationResult

Aggregated assessment results for a single application.

**Source:** `/backend/src/types/index.ts` (lines 443-456, `ApplicationResult` interface)

Contains: `assessor_scores[]`, `criterion_aggregates[]`, `total_average`, `weighted_average`, `total_variance`, `high_variance_flag`.

### 5.2 MasterResultsResponse

Complete results view for an entire funding call.

**Source:** `/backend/src/types/index.ts` (lines 458-469, `MasterResultsResponse` interface)

Contains: all `ApplicationResult` entries plus summary statistics.

### 5.3 CallProgress

Progress tracking for coordinator dashboard.

**Source:** `/backend/src/types/index.ts` (lines 612-622, `CallProgress` interface)

Contains: `total_applications`, `total_assignments`, `completed_assessments`, `outstanding_assessments`, `completion_percentage`, `assessor_progress[]`.

---

## 6. Gaps Between PRD and Implementation

| PRD Concept | Implementation Status | Gap |
|-------------|----------------------|-----|
| Assessor as standalone entity | Merged into User entity with role=assessor in the model layer; migration 001 has a separate `assessors` table | Schema has standalone `assessors` table but model layer uses `users` table with role filtering -- divergence |
| Assessor pool (call-specific) | Model uses `assessor_pool` table; migration uses `call_assessor_pool` table | Table naming divergence between model SQL and migration |
| Column naming (users) | Model expects `user_id`, `first_name`, `last_name`; migration uses `id`, `name` | Structural divergence requiring either migration update or column aliasing |
| File `is_primary` and `category` | Migration supports these columns; TypeScript types do not include them | Missing type properties for file categorisation |
| `receipt_sent_at`, `receipt_email_id` | Migration includes on `applications`; TypeScript `Application` type omits them | Email tracking columns not surfaced to application layer |
| `notification_logs` table | Migration defines it; no model or type exists | No application-layer support for notification tracking |
| `sessions` table | Migration defines it; no SessionModel exists | Session management uses JWT tokens rather than database sessions |
| `file_hash` column | Migration includes SHA-256 hash; not populated by FileService | File integrity verification not implemented |
| Virus scanning | `FileService.scanFile()` is a stub returning `CLEAN` | Actual ClamAV/cloud scanning integration not implemented |
| Domain events | PRD specifies 6 domain events; none exist as explicit event objects | Events are implicit in controller audit logging rather than first-class domain events |
| Weighted scoring | `ScoringService` computes weighted averages | Fully implemented |
| Variance flagging | `ScoringService` and `resultsController` implement it | Fully implemented |
