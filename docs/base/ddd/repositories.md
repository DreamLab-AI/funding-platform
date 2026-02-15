# Repositories

**Funding Application Submission & Assessment Platform**

This document defines the data access patterns (repositories) for each aggregate, the query patterns used, and their mapping to actual database queries in the codebase.

---

## Architecture Note

The codebase uses a **static model class** pattern rather than classic repository interfaces. Each aggregate has a model class with static methods that serve as the repository. Database access is through raw SQL queries using the `pg` (node-postgres) driver with a connection pool.

**Database abstraction:** `/backend/src/config/database.ts` exports:
- `query<T>(sql, params)` -- single query execution
- `transaction<T>(callback)` -- transactional execution with rollback on error
- `DatabaseClient` -- individual client from pool (for transactions)

---

## 1. FundingCallRepository

**Implementation:** `FundingCallModel` class in `/backend/src/models/fundingCall.model.ts`

### Command Methods

| Method | SQL Pattern | Transaction | Description |
|--------|------------|-------------|-------------|
| `create(input, createdBy)` | `INSERT INTO funding_calls (...) VALUES (...) RETURNING *` | Yes | Creates call with embedded criteria JSON |
| `update(call_id, input)` | Dynamic `UPDATE funding_calls SET ... WHERE call_id = $N RETURNING *` | No | Partial update with dynamic field construction |
| `updateStatus(call_id, status)` | `UPDATE funding_calls SET status = $1, updated_at = NOW() WHERE call_id = $2` | No | Status-only update |
| `clone(sourceCallId, newName, createdBy)` | SELECT source + `INSERT INTO funding_calls (...) RETURNING *` | Yes | Deep copy with new criterion IDs |
| `delete(call_id)` | `DELETE FROM funding_calls WHERE call_id = $1` | No | Hard delete (only for drafts) |

### Query Methods

| Method | SQL Pattern | Description |
|--------|------------|-------------|
| `findById(call_id)` | `SELECT * FROM funding_calls WHERE call_id = $1` | Single call lookup with JSON parsing |
| `list(options)` | `SELECT fc.*, COALESCE(app_count.count, 0) ... FROM funding_calls fc LEFT JOIN (subquery) ... ORDER BY fc.created_at DESC LIMIT $N OFFSET $M` | Paginated list with application and assessor counts via subquery joins |
| `listOpen()` | `SELECT ... FROM funding_calls fc WHERE fc.status = 'open' AND fc.close_at > NOW() ORDER BY fc.close_at ASC` | Open calls for applicant view |

### Assessor Pool Methods

| Method | SQL Pattern | Description |
|--------|------------|-------------|
| `addAssessorToPool(call_id, user_id, tags)` | `INSERT INTO assessor_pool (...) ON CONFLICT (call_id, user_id) DO UPDATE SET is_active = true RETURNING *` | Upsert assessor into pool |
| `removeAssessorFromPool(call_id, user_id)` | `UPDATE assessor_pool SET is_active = false WHERE call_id = $1 AND user_id = $2` | Soft remove from pool |
| `getAssessorPool(call_id)` | `SELECT ap.*, u.email, u.first_name, u.last_name, u.organisation FROM assessor_pool ap JOIN users u ON ap.user_id = u.user_id WHERE ap.call_id = $1 AND ap.is_active = true ORDER BY u.last_name, u.first_name` | Pool with user details |
| `isInAssessorPool(call_id, user_id)` | `SELECT COUNT(*) FROM assessor_pool WHERE call_id = $1 AND user_id = $2 AND is_active = true` | Membership check |

### Domain Logic Methods

| Method | Pattern | Description |
|--------|---------|-------------|
| `getCriterion(call, criterion_id)` | In-memory array search | Finds criterion within embedded JSON |
| `isValidStatusTransition(current, new)` | In-memory map lookup | Validates state machine transitions |

---

## 2. ApplicationRepository

**Implementation:** `ApplicationModel` class in `/backend/src/models/application.model.ts`

### Command Methods

| Method | SQL Pattern | Transaction | Description |
|--------|------------|-------------|-------------|
| `create(input, applicantId, ...)` | Count sequence + get call name + `INSERT INTO applications (...) RETURNING *` | Yes | Creates with generated reference number |
| `update(application_id, input)` | Dynamic `UPDATE applications SET ... WHERE application_id = $N` | No | Partial update |
| `submit(application_id)` | `UPDATE applications SET status = 'submitted', submitted_at = NOW() WHERE application_id = $1` | No | Status transition |
| `withdraw(application_id)` | `UPDATE applications SET status = 'withdrawn', withdrawn_at = NOW() WHERE application_id = $1` | No | Status transition |
| `reopen(application_id)` | `UPDATE applications SET status = 'reopened', submitted_at = NULL WHERE application_id = $1` | No | Status transition |
| `delete(application_id)` | CASCADE: DELETE confirmations, DELETE files, DELETE application | Yes | Full cleanup in transaction |

### Query Methods

| Method | SQL Pattern | Description |
|--------|------------|-------------|
| `findById(application_id)` | `SELECT * FROM applications WHERE application_id = $1` + `getFiles()` + `getConfirmations()` | Hydrates full aggregate |
| `findByReference(reference_number)` | `SELECT * FROM applications WHERE reference_number = $1` + hydration | Reference-based lookup |
| `listByCall(call_id, options)` | Complex LEFT JOIN query with subqueries for file_count, confirmation_count, assignment_count, completed_assessments | Coordinator spreadsheet view |
| `listByApplicant(applicant_id, options)` | `SELECT * FROM applications WHERE applicant_id = $1 ORDER BY created_at DESC` + hydration per row | Applicant's applications |
| `belongsToUser(application_id, user_id)` | `SELECT COUNT(*) FROM applications WHERE application_id = $1 AND applicant_id = $2` | Ownership check |

### File Sub-Repository

| Method | SQL Pattern | Description |
|--------|------------|-------------|
| `addFile(application_id, ...)` | `INSERT INTO application_files (...) RETURNING *` | File metadata record |
| `getFiles(application_id)` | `SELECT * FROM application_files WHERE application_id = $1 ORDER BY uploaded_at` | All files for application |
| `getFile(file_id)` | `SELECT * FROM application_files WHERE file_id = $1` | Single file lookup |
| `updateFileScanStatus(file_id, status)` | `UPDATE application_files SET scan_status = $1 WHERE file_id = $2` | Virus scan result |
| `deleteFile(file_id)` | `DELETE FROM application_files WHERE file_id = $1` | Remove file record |

### Confirmation Sub-Repository

| Method | SQL Pattern | Description |
|--------|------------|-------------|
| `addConfirmation(application_id, type, ip)` | `INSERT INTO confirmations (...) ON CONFLICT (application_id, type) DO UPDATE RETURNING *` | Upsert confirmation |
| `getConfirmations(application_id)` | `SELECT * FROM confirmations WHERE application_id = $1` | All confirmations |
| `removeConfirmation(application_id, type)` | `DELETE FROM confirmations WHERE application_id = $1 AND type = $2` | Remove confirmation |
| `hasAllConfirmations(application_id, required)` | `SELECT COUNT(DISTINCT type) FROM confirmations WHERE application_id = $1 AND type = ANY($2)` | Completeness check |

---

## 3. AssignmentRepository

**Implementation:** `AssignmentModel` class in `/backend/src/models/assessment.model.ts` (lines 15-255)

### Command Methods

| Method | SQL Pattern | Transaction | Description |
|--------|------------|-------------|-------------|
| `create(input, assignedBy)` | `INSERT INTO assignments (...) RETURNING *` | No | Single assignment |
| `createBulk(appIds, assessorIds, assignedBy, dueAt)` | Loop: `INSERT ... ON CONFLICT DO NOTHING RETURNING *` | Yes | Round-robin bulk assignment |
| `updateStatus(assignment_id, status)` | `UPDATE assignments SET status = $1 [, started_at/completed_at] WHERE assignment_id = $2` | No | Status with conditional timestamp |
| `delete(assignment_id)` | `DELETE FROM assignments WHERE assignment_id = $1` | No | Hard delete |

### Query Methods

| Method | SQL Pattern | Description |
|--------|------------|-------------|
| `findById(assignment_id)` | `SELECT * FROM assignments WHERE assignment_id = $1` | Simple lookup |
| `findWithDetails(assignment_id)` | 4-table JOIN: assignments + applications + users + funding_calls | Full context for display |
| `listByAssessor(assessor_id, options)` | Same 4-table JOIN with assessor filter, pagination | Assessor's task list |
| `listByApplication(application_id)` | Same 4-table JOIN with application filter | All assessors for one application |
| `exists(application_id, assessor_id)` | `SELECT COUNT(*) FROM assignments WHERE ...` | Duplicate check |
| `belongsToAssessor(assignment_id, assessor_id)` | `SELECT COUNT(*) FROM assignments WHERE ...` | Access control check |

---

## 4. AssessmentRepository

**Implementation:** `AssessmentModel` class in `/backend/src/models/assessment.model.ts` (lines 258-488)

### Command Methods

| Method | SQL Pattern | Transaction | Description |
|--------|------------|-------------|-------------|
| `createOrGet(input)` | Check existing + `INSERT INTO assessments (...) RETURNING *` + update assignment status | No | Idempotent creation |
| `update(assessment_id, input)` | Dynamic `UPDATE assessments SET ... WHERE assessment_id = $N RETURNING *` | No | Partial update with score recalculation |
| `submit(assessment_id)` | `UPDATE assessments SET status = 'submitted' ... RETURNING *` + `AssignmentModel.updateStatus()` | No (gap) | Submission with assignment sync |
| `returnForRevision(assessment_id)` | `UPDATE assessments SET status = 'returned' ...` + `AssignmentModel.updateStatus()` | No (gap) | Coordinator return |
| `delete(assessment_id)` | `DELETE FROM assessments WHERE assessment_id = $1` | No | Hard delete |

### Query Methods

| Method | SQL Pattern | Description |
|--------|------------|-------------|
| `findById(assessment_id)` | `SELECT * FROM assessments WHERE assessment_id = $1` with JSON parsing | Single assessment |
| `findByAssignment(assignment_id)` | `SELECT * FROM assessments WHERE assignment_id = $1` with JSON parsing | Assessment for assignment |
| `listByApplication(application_id)` | `SELECT ass.* FROM assessments ass JOIN assignments asn ON ... WHERE asn.application_id = $1 AND ass.status = 'submitted'` | All submitted assessments for an application |
| `getWithAssessorInfo(application_id)` | Same as above + `JOIN users u ON asn.assessor_id = u.user_id` | With assessor names/IDs |

---

## 5. UserRepository

**Implementation:** `UserModel` class in `/backend/src/models/user.model.ts`

### Command Methods

| Method | SQL Pattern | Transaction | Description |
|--------|------------|-------------|-------------|
| `create(input)` | bcrypt hash + `INSERT INTO users (...) RETURNING *` | No | User registration |
| `update(user_id, input)` | Dynamic `UPDATE users SET ... WHERE user_id = $N RETURNING *` | No | Profile update |
| `updatePassword(user_id, password)` | bcrypt hash + `UPDATE users SET password_hash = $1 WHERE user_id = $2` | No | Password change |
| `updateLastLogin(user_id)` | `UPDATE users SET last_login_at = NOW() WHERE user_id = $1` | No | Login tracking |
| `verifyEmail(user_id)` | `UPDATE users SET email_verified = true WHERE user_id = $1` | No | Email confirmation |
| `delete(user_id)` | `UPDATE users SET is_active = false WHERE user_id = $1` | No | Soft delete |

### Query Methods

| Method | SQL Pattern | Description |
|--------|------------|-------------|
| `findById(user_id)` | `SELECT * FROM users WHERE user_id = $1` | By primary key |
| `findByEmail(email)` | `SELECT * FROM users WHERE email = $1` (lowercased) | Authentication lookup |
| `findByRole(role, activeOnly)` | `SELECT ... FROM users WHERE role = $1 [AND is_active = true]` | Role-based listing |
| `findAssessorsByExpertise(tags)` | `SELECT ... FROM users WHERE role = 'assessor' AND expertise_tags && $2` | Expertise matching using array overlap operator |
| `list(options)` | `SELECT ... FROM users [WHERE ...] ORDER BY created_at DESC LIMIT $N OFFSET $M` | Paginated admin listing |
| `emailExists(email, excludeId)` | `SELECT COUNT(*) FROM users WHERE email = $1 [AND user_id != $2]` | Uniqueness check |

---

## 6. AuditLogRepository

**Implementation:** `AuditLogModel` class in `/backend/src/models/auditLog.model.ts`

### Command Methods

| Method | SQL Pattern | Transaction | Description |
|--------|------------|-------------|-------------|
| `create(input)` | `INSERT INTO audit_logs (...) RETURNING *` | No | Append log entry |
| `deleteOlderThan(date)` | `DELETE FROM audit_logs WHERE timestamp < $1` | No | Retention cleanup |

### Query Methods

| Method | SQL Pattern | Description |
|--------|------------|-------------|
| `findById(event_id)` | `SELECT * FROM audit_logs WHERE event_id = $1` | Single entry |
| `query(filters)` | Dynamic `SELECT * FROM audit_logs [WHERE ...] ORDER BY timestamp DESC LIMIT $N OFFSET $M` | Filtered, paginated |
| `getForTarget(target_type, target_id)` | `SELECT * FROM audit_logs WHERE target_type = $1 AND target_id = $2 ORDER BY timestamp DESC` | Entity-specific audit trail |
| `getForActor(actor_id)` | `SELECT * FROM audit_logs WHERE actor_id = $1 ORDER BY timestamp DESC` | User activity log |
| `getRecent(limit)` | `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT $1` | Dashboard view |
| `getLoginHistory(user_id)` | `SELECT * FROM audit_logs WHERE actor_id = $1 AND action IN ('user_login', 'user_logout')` | Security investigation |
| `getDownloadHistory(target_id)` | `SELECT * FROM audit_logs WHERE action = 'file_downloaded' [AND target_id = $2]` | File access audit |
| `countByAction(action, from, to)` | `SELECT COUNT(*) FROM audit_logs WHERE action = $1 [AND timestamp >= $2] [AND timestamp <= $3]` | Action frequency |

---

## 7. Direct Pool Queries (Controller-Level)

Several controllers bypass the model layer and query the database directly using `pool.query()`. These represent an architectural inconsistency where repository logic is embedded in controllers.

### applications.controller.ts

Direct pool queries for: `create`, `getMyApplications`, `getById`, `update`, `withdraw`, `submit`, `list`, `listByCall`, `exportMetadata`, `downloadAllFiles`, `reopen`, `getAssignedApplications`, `getMaterials`, `addConfirmation`, `getConfirmations`.

### assessments.controller.ts

Direct pool queries for: `getMyAssessments`, `getByAssignment`, `submitAssessment`, `updateDraft`, `finalSubmit`, `list`, `listByCall`, `listByApplication`, `returnForRevision`.

### assignments.controller.ts

Direct pool queries for: `assign`, `bulkAssign`, `listByCall`, `listByApplication`, `listByAssessor`, `unassign`, `getProgress`, `getProgressByAssessor`, `sendReminder`, `sendBulkReminders`.

### results.controller.ts

Direct pool queries for: `getMasterResults`, `getSummary`, `getVarianceFlags`, `getRanking`, `exportResults`, `exportDetailedResults`, `getApplicationResults`, `getScoreBreakdown`, `getAnalytics`, `getScoreDistribution`.

### Gap Analysis

The model layer (`/backend/src/models/`) provides a well-structured repository pattern, but the controller layer (`/backend/src/controllers/`) frequently bypasses it. This creates:
1. **Duplicated SQL** -- similar queries exist in both models and controllers
2. **Inconsistent data access** -- some paths use models (with JSON parsing, validation), others use raw pool queries
3. **Missing invariant enforcement** -- direct pool queries skip model-level business logic

The recommended approach is to route all data access through the model layer and treat controllers as thin coordination points.
