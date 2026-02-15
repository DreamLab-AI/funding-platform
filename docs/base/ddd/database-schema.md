# Database Schema

**Funding Application Submission & Assessment Platform**

This document describes the physical data model as defined by the database migrations. All migrations are located in `/database/migrations/`.

---

## Migrations

| File | Description | Created |
|------|-------------|---------|
| `001_initial_schema.sql` | Core tables, enums, triggers, rules | 2026-01-29 |
| `002_indexes.sql` | Performance indexes and partial indexes | 2026-01-29 |
| `003_user_identities.sql` | Nostr DID integration tables | 2026-01-29 |

---

## PostgreSQL Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- Cryptographic functions
```

---

## Enumerations (Custom Types)

| Enum | Values |
|------|--------|
| `call_status` | `draft`, `open`, `closed`, `in_assessment`, `completed`, `archived` |
| `application_status` | `draft`, `submitted`, `withdrawn`, `reopened` |
| `assignment_status` | `assigned`, `in_progress`, `completed`, `returned` |
| `assessment_status` | `draft`, `submitted`, `returned` |
| `file_scan_status` | `pending`, `scanning`, `clean`, `infected`, `error` |
| `user_role` | `applicant`, `assessor`, `coordinator`, `scheme_owner`, `admin` |
| `confirmation_type` | `guidance_read`, `edi_completed`, `data_sharing_consent` |

---

## Tables

### users

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE, CHECK (email regex) | Login email |
| `password_hash` | VARCHAR(255) | NOT NULL | bcrypt or argon2 hash |
| `name` | VARCHAR(255) | NOT NULL | Display name |
| `role` | `user_role` | NOT NULL, DEFAULT `'applicant'` | Platform role |
| `email_verified` | BOOLEAN | NOT NULL, DEFAULT FALSE | Email verification status |
| `email_verified_at` | TIMESTAMPTZ | | When email was verified |
| `last_login_at` | TIMESTAMPTZ | | Most recent login |
| `failed_login_attempts` | INTEGER | NOT NULL, DEFAULT 0 | Failed login counter |
| `locked_until` | TIMESTAMPTZ | | Account lockout expiry |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification |
| `deleted_at` | TIMESTAMPTZ | | Soft deletion timestamp |

**Triggers:** `update_users_updated_at` (auto-update `updated_at`)

### funding_calls

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `name` | VARCHAR(255) | NOT NULL | Call name |
| `description` | TEXT | | Description |
| `open_at` | TIMESTAMPTZ | NOT NULL | When submissions open |
| `close_at` | TIMESTAMPTZ | NOT NULL, CHECK (`close_at > open_at`) | Submission deadline |
| `status` | `call_status` | NOT NULL, DEFAULT `'draft'` | Lifecycle state |
| `requirements` | JSONB | NOT NULL, DEFAULT `'{}'` | Submission requirements |
| `criteria_config` | JSONB | NOT NULL, DEFAULT `'{}'` | Assessment criteria |
| `retention_policy` | INTEGER | NOT NULL, DEFAULT 7, CHECK (1-100) | Data retention years |
| `edi_form_url` | VARCHAR(500) | | External EDI form link |
| `created_by` | UUID | FK -> `users(id)` | Creator coordinator |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification |

**Triggers:** `update_funding_calls_updated_at`

**JSON Schema - `requirements`:**
```json
{
  "allowed_file_types": ["pdf", "docx"],
  "max_file_size_mb": 50,
  "required_confirmations": ["guidance_read", "edi_completed", "data_sharing_consent"],
  "guidance_text": "...",
  "guidance_url": "..."
}
```

**JSON Schema - `criteria_config`:**
```json
{
  "criteria": [
    {
      "id": "uuid",
      "name": "...",
      "description": "...",
      "max_points": 10,
      "weight": 1.0,
      "comments_required": false
    }
  ],
  "assessors_per_application": 2,
  "variance_threshold": 3.0
}
```

### applications

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `call_id` | UUID | NOT NULL, FK -> `funding_calls(id)` ON DELETE RESTRICT | Parent call |
| `applicant_id` | UUID | FK -> `users(id)` | Submitting user |
| `applicant_name` | VARCHAR(255) | NOT NULL | Applicant display name |
| `applicant_email` | VARCHAR(255) | NOT NULL, CHECK (email regex) | Contact email |
| `applicant_organisation` | VARCHAR(255) | | Organisation |
| `reference_number` | VARCHAR(50) | UNIQUE | Auto-generated reference |
| `status` | `application_status` | NOT NULL, DEFAULT `'draft'` | Lifecycle state |
| `submitted_at` | TIMESTAMPTZ | | Submission timestamp |
| `withdrawn_at` | TIMESTAMPTZ | | Withdrawal timestamp |
| `receipt_sent_at` | TIMESTAMPTZ | | When receipt email was sent |
| `receipt_email_id` | VARCHAR(255) | | External email service message ID |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification |

**Constraints:**
- `applications_submitted_check`: When status = `'submitted'`, `submitted_at` must not be NULL

**Triggers:**
- `trigger_generate_application_reference`: Auto-generates reference number on INSERT when NULL
- `update_applications_updated_at`

**Reference number format:** `{CALL_PREFIX}-{YYYY}-{NNNN}` where `CALL_PREFIX` is the first 4 alphanumeric characters of the call name.

### application_files

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `application_id` | UUID | NOT NULL, FK -> `applications(id)` ON DELETE CASCADE | Parent application |
| `filename` | VARCHAR(255) | NOT NULL | Storage filename |
| `original_filename` | VARCHAR(255) | NOT NULL | User-provided name |
| `file_path` | VARCHAR(500) | NOT NULL | S3/local storage path |
| `file_size` | BIGINT | NOT NULL, CHECK (> 0 AND <= 52428800) | Size in bytes (max 50MB) |
| `mime_type` | VARCHAR(100) | NOT NULL | Content type |
| `file_hash` | VARCHAR(64) | | SHA-256 integrity hash |
| `scan_status` | `file_scan_status` | NOT NULL, DEFAULT `'pending'` | Virus scan result |
| `scanned_at` | TIMESTAMPTZ | | When scan completed |
| `scan_result` | TEXT | | Detailed scan output |
| `is_primary` | BOOLEAN | NOT NULL, DEFAULT FALSE | Main application form flag |
| `category` | VARCHAR(50) | | File category tag |
| `uploaded_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Upload timestamp |
| `uploaded_by_ip` | INET | | Uploader IP address |

### confirmations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `application_id` | UUID | NOT NULL, FK -> `applications(id)` ON DELETE CASCADE | Parent application |
| `type` | `confirmation_type` | NOT NULL | What was confirmed |
| `confirmed_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When confirmed |
| `ip_address` | INET | | Client IP |
| `user_agent` | TEXT | | Client user agent |

**Constraints:** UNIQUE on `(application_id, type)`

### assessors

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `user_id` | UUID | FK -> `users(id)` | Optional platform account link |
| `name` | VARCHAR(255) | NOT NULL | Assessor name |
| `email` | VARCHAR(255) | NOT NULL, CHECK (email regex) | Contact email |
| `organisation` | VARCHAR(255) | | Organisation |
| `expertise_tags` | JSONB | DEFAULT `'[]'` | Expertise areas |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Active status |
| `invited_at` | TIMESTAMPTZ | | When invited |
| `invitation_accepted_at` | TIMESTAMPTZ | | When accepted |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification |

**Triggers:** `update_assessors_updated_at`

### call_assessor_pool

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `call_id` | UUID | NOT NULL, FK -> `funding_calls(id)` ON DELETE CASCADE | Funding call |
| `assessor_id` | UUID | NOT NULL, FK -> `assessors(id)` ON DELETE CASCADE | Assessor |
| `added_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When added to pool |
| `added_by` | UUID | FK -> `users(id)` | Who added them |

**Constraints:** UNIQUE on `(call_id, assessor_id)`

### assignments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `application_id` | UUID | NOT NULL, FK -> `applications(id)` ON DELETE CASCADE | Assigned application |
| `assessor_id` | UUID | NOT NULL, FK -> `assessors(id)` ON DELETE RESTRICT | Assigned assessor |
| `assigned_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | When assigned |
| `assigned_by` | UUID | FK -> `users(id)` | Coordinator who assigned |
| `due_at` | TIMESTAMPTZ | | Assessment deadline |
| `status` | `assignment_status` | NOT NULL, DEFAULT `'assigned'` | Lifecycle state |
| `first_viewed_at` | TIMESTAMPTZ | | First application view |
| `last_viewed_at` | TIMESTAMPTZ | | Most recent view |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification |

**Constraints:** UNIQUE on `(application_id, assessor_id)`
**Triggers:** `update_assignments_updated_at`

### assessments

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `assignment_id` | UUID | NOT NULL, UNIQUE, FK -> `assignments(id)` ON DELETE CASCADE | Parent assignment (1:1) |
| `scores_json` | JSONB | NOT NULL, DEFAULT `'{}'` | Criterion scores and comments |
| `overall_score` | DECIMAL(10,2) | | Calculated aggregate score |
| `comments` | TEXT | | General assessor comments |
| `coi_confirmed` | BOOLEAN | NOT NULL, DEFAULT FALSE | COI declaration status |
| `coi_details` | TEXT | | COI description if applicable |
| `status` | `assessment_status` | NOT NULL, DEFAULT `'draft'` | Lifecycle state |
| `submitted_at` | TIMESTAMPTZ | | Submission timestamp |
| `returned_at` | TIMESTAMPTZ | | When returned for revision |
| `returned_by` | UUID | FK -> `users(id)` | Who returned it |
| `return_reason` | TEXT | | Reason for return |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification |

**Constraints:**
- `assessments_submitted_check`: When status = `'submitted'`, both `submitted_at IS NOT NULL` and `coi_confirmed = TRUE`

**Triggers:** `update_assessments_updated_at`

**JSON Schema - `scores_json`:**
```json
{
  "criterion_id": {
    "score": 8,
    "comment": "Strong proposal with clear methodology"
  }
}
```

### audit_logs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `actor_id` | UUID | FK -> `users(id)` | User who performed action |
| `actor_role` | `user_role` | | Role at time of action |
| `actor_email` | VARCHAR(255) | | Preserved email |
| `action` | VARCHAR(100) | NOT NULL | Action type |
| `target_type` | VARCHAR(50) | NOT NULL | Entity type affected |
| `target_id` | UUID | | Entity instance |
| `details` | JSONB | DEFAULT `'{}'` | Additional context |
| `ip_address` | INET | | Client IP |
| `user_agent` | TEXT | | Client user agent |
| `request_id` | VARCHAR(100) | | Correlation ID |
| `timestamp` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Event time |

**Rules (append-only):**
- `audit_logs_no_update`: UPDATE does nothing
- `audit_logs_no_delete`: DELETE does nothing

### notification_logs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `recipient_email` | VARCHAR(255) | NOT NULL | Email recipient |
| `recipient_id` | UUID | FK -> `users(id)` | Recipient user |
| `notification_type` | VARCHAR(50) | NOT NULL | Type: submission_receipt, assignment, reminder |
| `subject` | VARCHAR(255) | | Email subject |
| `call_id` | UUID | FK -> `funding_calls(id)` | Related call |
| `application_id` | UUID | FK -> `applications(id)` | Related application |
| `assignment_id` | UUID | FK -> `assignments(id)` | Related assignment |
| `external_message_id` | VARCHAR(255) | | Email service tracking ID |
| `status` | VARCHAR(50) | NOT NULL, DEFAULT `'pending'` | Delivery status |
| `sent_at` | TIMESTAMPTZ | | When sent |
| `delivered_at` | TIMESTAMPTZ | | When delivered |
| `error_message` | TEXT | | Error details |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |

### sessions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `user_id` | UUID | NOT NULL, FK -> `users(id)` ON DELETE CASCADE | Session owner |
| `token_hash` | VARCHAR(64) | NOT NULL, UNIQUE | SHA-256 of session token |
| `ip_address` | INET | | Client IP |
| `user_agent` | TEXT | | Client user agent |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Session start |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Session expiry |
| `last_activity_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last interaction |
| `revoked_at` | TIMESTAMPTZ | | Manual revocation |

### user_identities (Migration 003)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `identity_id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `user_id` | UUID | NOT NULL, FK -> `users(id)` ON DELETE CASCADE, UNIQUE | One identity per user |
| `nostr_pubkey` | VARCHAR(64) | NOT NULL, UNIQUE, CHECK (hex format) | secp256k1 public key |
| `nip05_identifier` | VARCHAR(255) | CHECK (NIP-05 format) | DNS-based identity |
| `nip05_verified` | BOOLEAN | NOT NULL, DEFAULT FALSE | Verification status |
| `nip05_verified_at` | TIMESTAMPTZ | | When verified |
| `did` | VARCHAR(80) | NOT NULL, UNIQUE, CHECK (`did:nostr:` format) | W3C DID |
| `display_name` | VARCHAR(255) | | Nostr profile name |
| `profile_picture_url` | VARCHAR(500) | | Profile image |
| `banner_url` | VARCHAR(500) | | Banner image |
| `about` | TEXT | | Profile bio |
| `relays` | JSONB | DEFAULT `'[]'` | Preferred relay URLs |
| `first_auth_at` | TIMESTAMPTZ | | First authentication |
| `last_auth_at` | TIMESTAMPTZ | | Most recent auth |
| `auth_count` | INTEGER | NOT NULL, DEFAULT 0 | Auth usage counter |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Link creation |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Last modification |

**Triggers:**
- `update_user_identities_updated_at`
- `trigger_validate_user_identity_did`: Ensures DID matches pubkey format
- `trigger_update_identity_auth_tracking`: Auto-increments auth counter

### nostr_auth_challenges (Migration 003)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `challenge_id` | UUID | PK, DEFAULT `uuid_generate_v4()` | Primary key |
| `challenge` | VARCHAR(64) | NOT NULL, UNIQUE, CHECK (hex format) | Challenge string |
| `relay` | VARCHAR(500) | | NIP-42 relay URL |
| `expires_at` | TIMESTAMPTZ | NOT NULL | Challenge expiry (5 min) |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Creation timestamp |
| `used_at` | TIMESTAMPTZ | | When challenge was verified |
| `used_by_pubkey` | VARCHAR(64) | | Which pubkey used it |
| `created_ip` | INET | | Requesting IP |

**View:** `users_with_nostr` combines user data with Nostr identity information.

---

## Foreign Key Relationships

```
users
  <- funding_calls.created_by
  <- applications.applicant_id
  <- assessors.user_id
  <- call_assessor_pool.added_by
  <- assignments.assigned_by
  <- assessments.returned_by
  <- audit_logs.actor_id
  <- notification_logs.recipient_id
  <- sessions.user_id
  <- user_identities.user_id

funding_calls
  <- applications.call_id
  <- call_assessor_pool.call_id
  <- notification_logs.call_id

applications
  <- application_files.application_id
  <- confirmations.application_id
  <- assignments.application_id
  <- notification_logs.application_id

assessors
  <- call_assessor_pool.assessor_id
  <- assignments.assessor_id

assignments
  <- assessments.assignment_id
  <- notification_logs.assignment_id
```

---

## Key Indexes (from Migration 002)

### High-Impact Indexes

| Table | Index | Columns | Condition | Purpose |
|-------|-------|---------|-----------|---------|
| `applications` | `idx_applications_call_status` | `(call_id, status)` | | Coordinator view |
| `assignments` | `idx_assignments_assessor_status` | `(assessor_id, status)` | | Assessor task list |
| `assessments` | `idx_assessments_scores` | GIN on `scores_json` | | Criterion-specific queries |
| `audit_logs` | `idx_audit_logs_timestamp` | `timestamp DESC` | | Recent events |
| `funding_calls` | `idx_funding_calls_search` | GIN full-text on `name + description` | | Text search |
| `applications` | `idx_applications_applicant_search` | GIN full-text on `applicant_name + organisation` | | Applicant search |

### Partial Indexes (Performance Optimisation)

| Table | Index | Condition | Purpose |
|-------|-------|-----------|---------|
| `applications` | `idx_applications_draft` | `status = 'draft'` | Cleanup/reminder |
| `application_files` | `idx_files_pending_scan` | `scan_status = 'pending'` | Scanner queue |
| `assessors` | `idx_assessors_active_list` | `is_active = TRUE` | Assignment UI |
| `assignments` | `idx_assignments_outstanding` | `status IN ('assigned', 'in_progress')` | Reminder emails |
| `sessions` | `idx_sessions_expires` | `revoked_at IS NULL` | Cleanup |

---

## Schema Divergences

The TypeScript model layer and the database migrations have several structural divergences:

| Aspect | Migration Schema | TypeScript Model | Impact |
|--------|-----------------|-----------------|--------|
| User PK | `users.id` | `user_id` | Model queries use different column names |
| User name | `users.name` (single field) | `first_name`, `last_name` | Model expects split name fields |
| Assessor entity | Standalone `assessors` table | Assessors are Users with `role = 'assessor'` | Different entity modelling approach |
| Assessor pool table | `call_assessor_pool` | Model references `assessor_pool` | Different table names |
| Assignment default status | `'assigned'` | `AssignmentStatus.PENDING = 'pending'` | Enum value mismatch |
| File scan status | Includes `'scanning'` | Does not include `'scanning'` | Missing enum value in TypeScript |
| Assessment scores column | `scores_json` | Model uses `scores` | Column name divergence |
| Assessment comments column | `comments` | Model uses `overall_comment` | Column name divergence |

These divergences indicate the model layer may be operating against an evolved version of the schema that differs from the checked-in migrations, or there are additional migrations not yet captured.
