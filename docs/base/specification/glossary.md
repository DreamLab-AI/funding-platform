# Glossary: Funding Application Submission & Assessment Platform

This glossary defines domain terms used throughout the platform, the PRD, and the codebase. Terms are sourced from PRD Section 16 and extended with implementation-specific terminology.

---

## Domain Terms

### Application
An applicant's submission for a specific funding call. Comprises uploaded files (application form and supporting documents), completed confirmations (guidance read, EDI, data sharing consent), and metadata (applicant name, email, organisation). Each application has a system-generated reference number (e.g., `FUND-2026-0001`). Represented in the database as the `applications` table and in code as the `Application` interface (`backend/src/types/index.ts`).

### Applicant
A user who creates and submits applications for funding calls. Role value: `applicant`. Can view open calls, upload documents, complete confirmations, submit before deadline, and receive a submission receipt. Cannot see other applications, assessor activity, or master results. Represented by the `UserRole.APPLICANT` enum value.

### Assessment
An assessor's evaluation of a specific application, containing per-criterion scores (numeric within configured ranges), optional comments, an overall score, and a conflict-of-interest declaration. Assessments progress through states: `draft` -> `submitted` (or `returned` by coordinator). Stored in the `assessments` table with scores in JSONB format (`scores_json`).

### Assessor
A reviewer who scores assigned applications against defined criteria. Role value: `assessor`. Can only see applications assigned to them. Cannot see other assessors' scores, master results, or unassigned applications. May or may not have a platform account (the `assessors` table can exist independently of `users`). Represented by the `UserRole.ASSESSOR` enum value.

### Assessor Pool
The set of assessors available for a specific funding call. Managed by the coordinator. Stored in the `call_assessor_pool` junction table linking `funding_calls` to `assessors`. Assessors must be in the pool before they can be assigned applications for that call.

### Assignment
A link between an application and an assessor, indicating that the assessor should review that application. Created by coordinators, either individually or via bulk round-robin allocation. Progresses through states: `assigned` -> `in_progress` -> `completed` (or `returned`). Stored in the `assignments` table with a UNIQUE constraint on `(application_id, assessor_id)`.

### COI (Conflict of Interest)
A situation where an assessor has a personal or professional interest that could bias their assessment. Assessors must confirm COI status before submitting an assessment (PRD FR-033). The `assessments` table stores `coi_confirmed` (boolean, required for submission) and `coi_details` (optional free text). Database constraint enforces `coi_confirmed = TRUE` for submitted assessments.

### Confirmation
An acknowledgement made by an applicant as part of the submission process. Three types defined in the `confirmation_type` enum:
- `guidance_read`: Applicant has read the call guidance and terms
- `edi_completed`: Applicant has completed the external EDI form
- `data_sharing_consent`: Applicant consents to data sharing
All required confirmations must be completed before submission. Stored in the `confirmations` table with `UNIQUE(application_id, type)`.

### EDI Form
Equality, Diversity and Inclusion monitoring form. Hosted on an external platform (linked via `funding_calls.edi_form_url`). The platform stores only an acknowledgement that the applicant has completed it (`edi_completed` confirmation type), not the EDI data itself. This separation is intentional for data minimisation.

### Funding Call
A single application window with its own deadline, submission requirements, assessment criteria, and assessor pool. Progresses through states: `draft` -> `open` -> `closed` -> `in_assessment` -> `completed` -> `archived`. Core entity stored in the `funding_calls` table. Configuration for submission requirements and assessment criteria stored in JSONB columns.

### Master Results
An aggregated view of all assessments for a call, showing per-assessor scores, calculated totals/averages, comments, and variance flags. Visible exclusively to coordinators (and scheme owners for read-only overview). Computed on-demand by the `ScoringService` rather than pre-computed. Exportable to XLSX format.

### Project Coordinator
The call administrator who manages funding calls, assigns assessors, monitors progress, and accesses master results. Role value: `coordinator`. Has the broadest operational permissions including call CRUD, application access, assessor pool management, results access, and audit log access. Cannot act as an assessor unless explicitly granted. Represented by `UserRole.COORDINATOR`.

### RBAC (Role-Based Access Control)
Access control model where permissions are assigned to roles (applicant, assessor, coordinator, scheme_owner) rather than individual users. Enforced server-side on all API endpoints via the `RBACService` (`backend/src/security/rbac.service.ts`) and `requireRoles()` middleware. 30+ granular permissions defined in the `Permission` enum (`backend/src/types/security.types.ts`).

### Round-Robin Assignment
Automatic distribution of applications to assessors in rotation to balance workload. Implemented in the bulk assignment endpoint (`POST /api/v1/assignments/bulk`) with strategy options: `round-robin`, `random`, `balanced`. Ensures each assessor receives approximately the same number of applications.

### Scheme Owner
An optional role providing read-only overview access across calls for reporting and audit purposes. Role value: `scheme_owner`. Can view calls, applications, assessments, master results, and audit logs. Cannot edit calls, assign assessors, or access applicant PII beyond configured scope. Represented by `UserRole.SCHEME_OWNER`.

### Variance Flagging
The platform's mechanism for detecting high divergence between assessor scores for the same application. When the normalised variance of scores for a criterion exceeds a configurable threshold, it is flagged as "high variance" in the master results. This helps coordinators identify applications that may need moderation or a third assessor. Threshold stored in `funding_calls.criteria_config.variance_threshold`.

---

## Technical Terms

### DID (Decentralized Identifier)
A W3C standard for self-sovereign identity. The platform supports `did:nostr:<pubkey>` identifiers, where the public key is a 64-character hex secp256k1 key from the Nostr protocol. Stored in the `user_identities` table.

### JWT (JSON Web Token)
The authentication token format used for API access. Access tokens contain user identity and permissions, signed with HS256. Refresh tokens enable session extension without re-authentication. Managed by `JWTService` (`backend/src/security/jwt.service.ts`).

### NIP (Nostr Implementation Possibility)
Protocol specifications for the Nostr network. The platform implements:
- NIP-01: Basic event signing
- NIP-05: DNS-based identity verification
- NIP-07: Browser extension integration
- NIP-19: Bech32 encoding (npub, nsec)
- NIP-98: HTTP Auth headers

### Nostr
An open protocol for decentralized social networking based on cryptographic key pairs. Used in this platform as an alternative authentication mechanism alongside email/password. User identity linked via the `user_identities` table.

### TIMESTAMPTZ
PostgreSQL timestamp data type that stores values in UTC with timezone awareness. Used for all date/time columns in the schema to ensure correct deadline enforcement across BST/GMT transitions.

---

## Status Values

### Call Status (`call_status` enum)
| Value | Description |
|---|---|
| `draft` | Call created but not yet visible to applicants |
| `open` | Accepting applications from applicants |
| `closed` | Deadline passed, no new submissions |
| `in_assessment` | Assessors are scoring applications |
| `completed` | All assessments done, results finalised |
| `archived` | Call archived for long-term retention |

### Application Status (`application_status` enum)
| Value | Description |
|---|---|
| `draft` | Application started but not submitted |
| `submitted` | Application submitted before deadline |
| `withdrawn` | Applicant withdrew the application |
| `reopened` | Coordinator reopened for applicant editing |

### Assignment Status (`assignment_status` enum)
| Value | Description |
|---|---|
| `assigned` | Assessor assigned but has not started |
| `in_progress` | Assessor has viewed the application |
| `completed` | Assessment submitted |
| `returned` | Coordinator returned for revision |

### Assessment Status (`assessment_status` enum)
| Value | Description |
|---|---|
| `draft` | Assessment started, scores saved but not submitted |
| `submitted` | Assessment submitted and locked |
| `returned` | Coordinator returned for assessor revision |

### File Scan Status (`file_scan_status` enum)
| Value | Description |
|---|---|
| `pending` | File uploaded, awaiting scan |
| `scanning` | Scan in progress |
| `clean` | No threats detected |
| `infected` | Malware or virus detected |
| `error` | Scan failed (timeout or service error) |
