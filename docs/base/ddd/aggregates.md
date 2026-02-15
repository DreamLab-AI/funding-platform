# Aggregates

**Funding Application Submission & Assessment Platform**

This document defines the aggregate root boundaries, enclosed entities, invariants enforced at each boundary, and the consistency guarantees provided.

---

## 1. FundingCall Aggregate

### Aggregate Root

**FundingCall** -- the central configuration entity for an application window.

### Enclosed Entities and Value Objects

```
FundingCall (root)
  +--- Criterion[] (value objects, embedded JSON)
  +--- SubmissionRequirements (value object, embedded JSON)
  +--- AssessorPoolMember[] (entities, separate table)
```

### Consistency Boundary

All operations within the FundingCall aggregate are transactionally consistent:
- Creating a call with criteria uses a database transaction (`/backend/src/models/fundingCall.model.ts` line 23, `transaction()`)
- Cloning a call copies criteria atomically (line 277, `transaction()`)
- Criteria IDs are generated server-side during creation, never accepted from client input

### Invariants

| # | Invariant | Enforcement Location |
|---|-----------|---------------------|
| 1 | `close_at > open_at` | DB constraint `funding_calls_dates_check` |
| 2 | `retention_years` between 1 and 100 | DB constraint `funding_calls_retention_check` |
| 3 | Status transitions follow `Draft -> Open -> Closed -> In Assessment -> Completed -> Archived` | `FundingCallModel.isValidStatusTransition()` lines 393-404 |
| 4 | Only draft calls can be deleted | `calls.controller.ts` `deleteCall()` lines 337-343 |
| 5 | Criteria must have unique IDs within a call | UUIDs generated per criterion on creation (line 27) |
| 6 | Assessor pool members are unique per call | DB constraint `ON CONFLICT (call_id, user_id)` (line 339) |

### Access Patterns

| Operation | Method | Transactional |
|-----------|--------|---------------|
| Create with criteria | `FundingCallModel.create()` | Yes |
| Update fields | `FundingCallModel.update()` | No (single UPDATE) |
| Change status | `FundingCallModel.updateStatus()` | No (single UPDATE) |
| Clone | `FundingCallModel.clone()` | Yes |
| Add assessor to pool | `FundingCallModel.addAssessorToPool()` | No (UPSERT) |
| Remove assessor from pool | `FundingCallModel.removeAssessorFromPool()` | No (soft delete) |
| List with counts | `FundingCallModel.list()` | No (read-only) |

### Code References

- Aggregate root type: `/backend/src/types/index.ts` lines 202-217
- Model: `/backend/src/models/fundingCall.model.ts`
- Controller: `/backend/src/controllers/calls.controller.ts`
- DB table: `/database/migrations/001_initial_schema.sql` lines 94-122

---

## 2. Application Aggregate

### Aggregate Root

**Application** -- an applicant's submission for a specific funding call.

### Enclosed Entities and Value Objects

```
Application (root)
  +--- ApplicationFile[] (entities, separate table)
  +--- Confirmation[] (entities, separate table)
```

### Consistency Boundary

The Application aggregate ensures:
- Creating an application with reference number generation uses a transaction (`/backend/src/models/application.model.ts` line 26, `transaction()`)
- Deleting an application cascades to files and confirmations within a transaction (line 450, `transaction()`)
- Loading an application hydrates files and confirmations eagerly (`findById()` lines 73-86)

### Invariants

| # | Invariant | Enforcement Location |
|---|-----------|---------------------|
| 1 | Reference numbers are unique | DB constraint `UNIQUE` on `reference_number` |
| 2 | Cannot submit without required confirmations | `ApplicationModel.hasAllConfirmations()` lines 420-433 |
| 3 | Cannot submit after call deadline | Controller-level check (Europe/London timezone) |
| 4 | `submitted_at` must be non-null when status is `submitted` | DB constraint `applications_submitted_check` |
| 5 | Email must be valid format | DB constraint `applications_email_check` |
| 6 | Files cannot exceed 50MB | DB constraint `application_files_size_check` |
| 7 | Confirmation types are unique per application | DB constraint `confirmations_unique (application_id, type)` |
| 8 | Applicant can only modify their own applications | `ApplicationModel.belongsToUser()` lines 438-444 |

### Access Patterns

| Operation | Method | Transactional |
|-----------|--------|---------------|
| Create with ref number | `ApplicationModel.create()` | Yes |
| Submit | `ApplicationModel.submit()` | No (single UPDATE) |
| Withdraw | `ApplicationModel.withdraw()` | No (single UPDATE) |
| Reopen | `ApplicationModel.reopen()` | No (single UPDATE) |
| Add file | `ApplicationModel.addFile()` | No (single INSERT) |
| Delete file | `ApplicationModel.deleteFile()` | No (single DELETE) |
| Add confirmation | `ApplicationModel.addConfirmation()` | No (UPSERT) |
| Delete with cascades | `ApplicationModel.delete()` | Yes |
| List by call | `ApplicationModel.listByCall()` | No (read-only) |
| List by applicant | `ApplicationModel.listByApplicant()` | No (read-only) |

### Code References

- Aggregate root type: `/backend/src/types/index.ts` lines 279-294
- Model: `/backend/src/models/application.model.ts`
- Controller: `/backend/src/controllers/applications.controller.ts`
- DB table: `/database/migrations/001_initial_schema.sql` lines 133-203

---

## 3. Assessment Aggregate

### Aggregate Root

**Assessment** -- an assessor's structured evaluation of an assigned application.

### Enclosed Entities and Value Objects

```
Assessment (root)
  +--- CriterionScore[] (value objects, embedded JSON)
  +--- COIDeclaration (implicit: coi_confirmed + coi_details fields)

Assignment (closely coupled entity)
  -- One assessment per assignment (1:1)
  -- Status synced on assessment submission
```

### Design Note

The Assessment and Assignment entities are tightly coupled. The PRD specifies Assessment as the aggregate root, but in the implementation, Assignment and Assessment are managed as a pair. The `AssessmentModel.submit()` method atomically updates both the assessment status and the parent assignment status (`AssignmentModel.updateStatus()` called at line 414).

### Consistency Boundary

- Assessment creation is idempotent via `createOrGet()` pattern (line 262)
- Assessment submission locks both the assessment and assignment atomically (lines 396-414)
- Score recalculation happens on every update (lines 354-358)

### Invariants

| # | Invariant | Enforcement Location |
|---|-----------|---------------------|
| 1 | One assessment per assignment | DB constraint `assignment_id UNIQUE` on assessments |
| 2 | One assignment per application-assessor pair | DB constraint `assignments_unique (application_id, assessor_id)` |
| 3 | COI must be confirmed before submission | DB constraint `assessments_submitted_check` |
| 4 | Scores must be within [0, max_points] per criterion | `ScoringService.validateScores()` in `/backend/src/services/scoring.service.ts` lines 307-341 |
| 5 | All criteria must have scores before submission | `ScoringService.validateScores()` checks for missing scores |
| 6 | Comments required for criteria where `comments_required = true` | `ScoringService.validateScores()` line 332 |
| 7 | Assessors can only access their own assignments | `AssignmentModel.belongsToAssessor()` lines 246-255 |
| 8 | Submitted assessments are locked | Status transition enforcement in controller |

### Access Patterns

| Operation | Method | Transactional |
|-----------|--------|---------------|
| Create or get assessment | `AssessmentModel.createOrGet()` | No (INSERT or SELECT) |
| Update scores/comments | `AssessmentModel.update()` | No (single UPDATE) |
| Submit assessment | `AssessmentModel.submit()` | No (two sequential UPDATEs) |
| Return for revision | `AssessmentModel.returnForRevision()` | No (two sequential UPDATEs) |
| Create assignment | `AssignmentModel.create()` | No (single INSERT) |
| Bulk assign (round-robin) | `AssignmentModel.createBulk()` | Yes |
| Delete assignment | `AssignmentModel.delete()` | No (single DELETE) |

### Gap: Non-Transactional Submission

The assessment submission flow in `AssessmentModel.submit()` performs two separate UPDATE statements (assessment status + assignment status) without wrapping them in a transaction. If the second UPDATE fails, the system could be left in an inconsistent state where the assessment is `submitted` but the assignment is not `completed`. This should be wrapped in a transaction.

### Code References

- Assessment type: `/backend/src/types/index.ts` lines 381-393
- Assignment type: `/backend/src/types/index.ts` lines 338-348
- Models: `/backend/src/models/assessment.model.ts`
- Controllers: `/backend/src/controllers/assessments.controller.ts` and `/backend/src/controllers/assignments.controller.ts`
- DB tables: `/database/migrations/001_initial_schema.sql` lines 312-373

---

## 4. User Aggregate

### Aggregate Root

**User** -- a platform identity with authentication credentials and role.

### Enclosed Entities

```
User (root)
  +--- UserIdentity/Nostr (entity, separate table, 1:1)
```

### Consistency Boundary

- User creation is a single INSERT (no transaction needed)
- Password hashing is performed synchronously before INSERT
- Nostr identity linking is managed through a separate table with 1:1 constraint

### Invariants

| # | Invariant | Enforcement Location |
|---|-----------|---------------------|
| 1 | Email must be unique | DB constraint `UNIQUE` on `email` |
| 2 | Email must be valid format | DB constraint `users_email_check` |
| 3 | Password must be bcrypt hashed | `UserModel.create()` line 20 (SALT_ROUNDS = 12) |
| 4 | User must have one role | DB `NOT NULL` constraint on `role` |
| 5 | Soft deletion via `is_active` flag | `UserModel.delete()` line 234 |
| 6 | One Nostr identity per user | DB constraint `user_identities_user_unique` |
| 7 | One user per Nostr pubkey | DB constraint `user_identities_pubkey_unique` |
| 8 | DID must match `did:nostr:<pubkey>` | DB trigger `validate_user_identity_did` |

### Access Patterns

| Operation | Method | Transactional |
|-----------|--------|---------------|
| Create | `UserModel.create()` | No (single INSERT) |
| Find by email | `UserModel.findByEmail()` | No (single SELECT) |
| Verify password | `UserModel.verifyPassword()` | No (bcrypt.compare) |
| Update profile | `UserModel.update()` | No (single UPDATE) |
| Change password | `UserModel.updatePassword()` | No (single UPDATE) |
| Soft delete | `UserModel.delete()` | No (single UPDATE) |
| List by role | `UserModel.findByRole()` | No (read-only) |

### Code References

- User type: `/backend/src/types/index.ts` lines 118-133
- Security types: `/backend/src/types/security.types.ts`
- Model: `/backend/src/models/user.model.ts`
- Controller: `/backend/src/controllers/auth.controller.ts`
- DB tables: `/database/migrations/001_initial_schema.sql` lines 68-84, `/database/migrations/003_user_identities.sql`

---

## 5. AuditLog Aggregate

### Aggregate Root

**AuditLog** -- an immutable event record.

### Design Note

AuditLog is unusual as an aggregate because it is append-only. There are no enclosed mutable entities. Each log entry is a self-contained fact.

### Invariants

| # | Invariant | Enforcement Location |
|---|-----------|---------------------|
| 1 | No updates allowed | DB rule `audit_logs_no_update` |
| 2 | No deletes allowed (except retention cleanup) | DB rule `audit_logs_no_delete`; `deleteOlderThan()` bypasses via raw SQL |
| 3 | Timestamp is server-generated | DB default `NOW()` |
| 4 | Actor information is denormalised | Fields `actor_email`, `actor_role` stored alongside `actor_id` |

### Code References

- Type: `/backend/src/types/index.ts` lines 475-487
- Model: `/backend/src/models/auditLog.model.ts`
- DB table: `/database/migrations/001_initial_schema.sql` lines 383-413

---

## Aggregate Interaction Diagram

```
                            reads criteria
  FundingCall Aggregate <--------------------- Assessment Aggregate
       |                                              |
       | references                                   | references
       | (call_id FK)                                 | (application_id via
       v                                              |  assignment FK)
  Application Aggregate                               |
       ^                                              |
       |                                              v
       +------------- Assignment links ---------> Assessment
                      (application_id,              (scores, COI,
                       assessor_id)                  overall_score)
                                                         |
                                                         | consumed by
                                                         v
                                                  ScoringService
                                                  (Results Context)
```

---

## Aggregate Size Considerations

| Aggregate | Expected Size | Concern |
|-----------|--------------|---------|
| FundingCall | Criteria: 5-20 items; Assessor pool: 5-50 members | Manageable |
| Application | Files: 1-10 per application; Confirmations: 3 per application | Small |
| Assessment | Scores: matches criteria count (5-20) | Small |
| User | Single entity + optional Nostr identity | Minimal |
| AuditLog | Grows unbounded; millions of entries over time | Requires partition/retention strategy |

The current design keeps aggregates small and focused. The largest potential concern is the AuditLog table, which should be partitioned by time range for production use.
