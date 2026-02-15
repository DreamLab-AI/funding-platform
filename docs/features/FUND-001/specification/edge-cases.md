# Edge Cases: FUND-001

Documented edge cases for deadline enforcement, concurrent submissions, file validation, scoring, and data integrity.

---

## 1. Deadline Enforcement Edge Cases

### 1.1 Submission at Exact Deadline Time

**Scenario**: Applicant clicks submit at exactly `close_at` timestamp (e.g., 17:00:00.000Z).

**Expected Behavior**: The server compares `NOW()` against `close_at`. If `NOW() > close_at`, submission is rejected with `DEADLINE_PASSED`. A submission at the exact millisecond of the deadline is a race condition; the comparison is `>` (strictly after), so a submission at exactly `close_at` should be accepted.

**Implementation**: `DeadlinePassedError` thrown when current time exceeds `close_at`. The comparison uses UTC timestamps from PostgreSQL (`TIMESTAMPTZ`), avoiding timezone ambiguity.

**Risk**: Network latency between client action and server receipt could cause a submission initiated before deadline to arrive after. No grace period is currently implemented.

**Recommendation**: Consider a configurable grace period (e.g., 30 seconds) for submissions received immediately after the deadline. Alternatively, document that the server timestamp is authoritative.

### 1.2 BST/GMT Transition During Open Call

**Scenario**: A call's close_at is set to 2026-10-25T01:30:00 Europe/London. The clocks go back at 2:00 AM, meaning 1:30 AM occurs twice.

**Expected Behavior**: Since all timestamps are stored in UTC (TIMESTAMPTZ), the `close_at` value is unambiguous. The conversion from Europe/London to UTC happens when the coordinator creates the call. If the coordinator enters "1:30 AM" on the transition date, the frontend must disambiguate (BST or GMT). Once stored in UTC, the server comparison is correct.

**Implementation**: The `funding_calls_dates_check` constraint ensures `close_at > open_at` in UTC. See ADR-012.

**Risk**: Frontend date picker may not clearly communicate which "1:30 AM" is intended during DST transitions. Most coordinators will avoid setting deadlines during the transition hour.

### 1.3 Server Clock Skew

**Scenario**: Application server clock drifts from the database server clock.

**Expected Behavior**: Deadline enforcement should use the database server's clock (via `NOW()` in SQL) rather than the application server's `Date.now()`.

**Current Implementation**: The codebase uses application-level time comparison. If the deadline check is done in the application layer (`new Date() > close_at`), clock skew between app server and DB server could cause inconsistency.

**Recommendation**: Move deadline enforcement into the database query (WHERE clause) or ensure NTP synchronization.

### 1.4 Call Closed While Applicant is Mid-Submission

**Scenario**: An applicant starts filling in the form while the call is open. By the time they click submit, the call has closed.

**Expected Behavior**: Submission rejected with `DEADLINE_PASSED`. Files already uploaded remain in draft status. The applicant receives a clear error message.

**Implementation**: The submit endpoint checks the deadline at the moment of submission, not at form load time. Files uploaded before the deadline are associated with the draft application and remain accessible (but the application cannot be submitted).

**Risk**: UX frustration if the applicant was unaware the deadline was approaching. Frontend should show a countdown timer and warn when the deadline is imminent.

---

## 2. Concurrent Submission Edge Cases

### 2.1 Two Submissions from Same Application

**Scenario**: Applicant double-clicks the submit button, sending two concurrent submit requests.

**Expected Behavior**: Only one submission succeeds. The second request should fail because the application status is no longer 'draft'.

**Implementation**: The submit endpoint checks `application.status === 'draft'` before proceeding. The database updates status to 'submitted' atomically. If two concurrent requests reach the server, one will succeed and update the status; the other will find the status is no longer 'draft' and fail.

**Risk**: Without explicit row-level locking (`SELECT FOR UPDATE`), there is a tiny window for both requests to read 'draft' status and both attempt to update. PostgreSQL's MVCC and the `applications_submitted_check` constraint provide some protection, but explicit locking is recommended.

**Recommendation**: Add `SELECT FOR UPDATE` or optimistic locking (version column) on the applications table for the submit operation.

### 2.2 Application Reference Number Race Condition

**Scenario**: Multiple applications created simultaneously for the same call, potentially generating duplicate reference numbers.

**Expected Behavior**: Each application gets a unique reference number.

**Implementation**: The `generate_application_reference()` trigger calculates the sequence number by querying `MAX(seq) + 1` from existing applications for the same call. The `reference_number` column has a `UNIQUE` constraint, so duplicates are rejected at the database level even if the sequence calculation has a race condition.

**Risk**: The `MAX + 1` pattern is not strictly serialized. Two concurrent inserts could compute the same sequence number, causing one to fail with a unique violation. The trigger runs `BEFORE INSERT`, so the failed insert would need retry logic.

**Recommendation**: Use a PostgreSQL SEQUENCE per call for reference numbers, or handle the unique violation with application-level retry.

### 2.3 Concurrent Assessor Submissions for Same Assignment

**Scenario**: An assessor opens the assessment form in two browser tabs and submits from both.

**Expected Behavior**: Only one submission succeeds. The second should fail because the assessment status has changed from 'draft' to 'submitted'.

**Implementation**: The `assessments` table has a `UNIQUE` constraint on `assignment_id`, ensuring one assessment per assignment. The submit flow checks status before updating.

---

## 3. File Validation Edge Cases

### 3.1 File with Incorrect Extension but Valid MIME

**Scenario**: A file named `application.txt` is uploaded with MIME type `application/pdf` (browser reports the MIME based on content, not extension).

**Expected Behavior**: Current implementation validates MIME type from the request headers, not the file extension. If the MIME is in the allowed list, the upload succeeds regardless of extension.

**Risk**: MIME types can be spoofed by the client. A malicious file could be uploaded with a trusted MIME type.

**Recommendation**: Implement magic byte validation (check actual file bytes against expected format signatures) in addition to MIME type checking.

### 3.2 File with Valid Extension but Malicious Content

**Scenario**: A PDF file contains embedded JavaScript or a macro-enabled DOCX contains malicious macros.

**Expected Behavior**: The virus scanner should detect known malicious payloads.

**Current Implementation**: Virus scanning is stubbed (always returns CLEAN). See ADR-008.

**Recommendation**: ClamAV integration will catch known signatures. For advanced threats, consider sandboxed file analysis.

### 3.3 Zero-Byte File Upload

**Scenario**: An applicant uploads an empty file.

**Expected Behavior**: Rejected. The database constraint `application_files_size_check` requires `file_size > 0`.

**Implementation**: The constraint `file_size > 0 AND file_size <= 52428800` prevents zero-byte and oversized files at the database level.

### 3.4 File Upload After Application Submission

**Scenario**: An applicant attempts to upload a file to an application that has already been submitted.

**Expected Behavior**: Rejected. The application is locked after submission.

**Implementation**: The file upload endpoint should check that the application status is 'draft' or 'reopened' before accepting files.

**Risk**: If the status check is not implemented in the file upload handler, files could be added to submitted applications.

**Recommendation**: Verify application status in the upload handler before processing files.

### 3.5 Very Long Original Filename

**Scenario**: Applicant uploads a file with a 500-character filename.

**Expected Behavior**: The system generates a unique short filename for storage. The original filename is preserved in `original_filename` (VARCHAR 255, so it would be truncated).

**Implementation**: `generateUniqueFilename()` creates a short system name. The original name is stored for display but subject to the 255-character database column limit.

**Recommendation**: Truncate `original_filename` to 255 characters in the upload handler, preserving the file extension.

### 3.6 Duplicate File Upload

**Scenario**: Applicant uploads the same file twice.

**Expected Behavior**: Both uploads succeed as separate records. Each gets a unique system filename. No deduplication is performed.

**Implementation**: SHA-256 hash is stored per file (`file_hash`), which could be used for deduplication, but no dedup logic is currently implemented.

**Recommendation**: Optionally warn the applicant if a file with the same hash already exists on their application.

---

## 4. Scoring Edge Cases

### 4.1 Assessor Submits Score Exceeding Maximum

**Scenario**: An assessor submits a score of 15 for a criterion with max_points of 10.

**Expected Behavior**: Rejected. `ScoringService.validateScores()` checks `score > criterion.max_points`.

**Implementation**: The Zod schema validates `score: z.number().min(0)` but does not validate against the criterion's max_points (that requires call-specific context). The service-level `validateScores()` performs the max_points check.

**Risk**: If the controller does not call `validateScores()` before saving, an invalid score could be stored. The database stores scores in JSONB without column-level constraints on individual score values.

**Recommendation**: Ensure `validateScores()` is always called before saving scores. Consider adding a database-level check constraint on the JSONB scores.

### 4.2 Missing Score for One Criterion

**Scenario**: Assessor submits scores for 4 out of 5 criteria.

**Expected Behavior**: `validateScores()` returns an error: "Missing score for criterion: [name]".

**Implementation**: The validation iterates all criteria and checks for matching scores. Missing scores produce explicit error messages.

### 4.3 Variance Calculation with Single Assessor

**Scenario**: Only one assessor has completed their assessment for an application.

**Expected Behavior**: Variance cannot be calculated meaningfully. The `high_variance` flag should not be triggered.

**Implementation**: The variance flagging condition includes `scores.length >= 2`, so single-assessor results are never flagged.

### 4.4 All Assessors Give Identical Scores

**Scenario**: Three assessors each give a score of 8 out of 10 for a criterion.

**Expected Behavior**: Variance is 0. No high variance flag.

**Implementation**: `calculateVariance([8, 8, 8])` returns 0. The normalised percentage is 0%, well below any threshold.

### 4.5 Weighted Average with Zero-Weight Criterion

**Scenario**: A criterion has `weight: 0`.

**Expected Behavior**: The criterion is excluded from the weighted average calculation.

**Implementation**: `calculateWeightedAverage()` divides by `Sum(weights)`. If a weight is 0, that criterion contributes nothing to the numerator but also nothing to the denominator. However, if all weights are 0, division by zero would occur.

**Recommendation**: Add a guard against division by zero in `calculateWeightedAverage()`. Return 0 or undefined when total weight is 0.

---

## 5. Data Integrity Edge Cases

### 5.1 Assessor Removed from Pool After Assignment

**Scenario**: A coordinator assigns applications to an assessor, then removes the assessor from the pool.

**Expected Behavior**: The `assessors` table uses `ON DELETE RESTRICT` for assignments, preventing deletion of an assessor who has active assignments.

**Implementation**: The `assignments` table has `REFERENCES assessors(id) ON DELETE RESTRICT`. Attempting to delete an assessor with assignments will fail with a foreign key violation.

**Recommendation**: The UI should warn the coordinator and offer to unassign the assessor's applications before removing them from the pool.

### 5.2 Call Deleted with Existing Applications

**Scenario**: A coordinator attempts to delete a funding call that has applications.

**Expected Behavior**: Deletion prevented. The `applications` table has `REFERENCES funding_calls(id) ON DELETE RESTRICT`.

**Implementation**: Database-level foreign key constraint prevents cascade deletion.

### 5.3 Concurrent Bulk Assignment and Manual Assignment

**Scenario**: A coordinator runs bulk round-robin assignment while another coordinator manually assigns the same application to the same assessor.

**Expected Behavior**: The UNIQUE constraint on `(application_id, assessor_id)` in the `assignments` table prevents duplicate assignments. One operation succeeds, the other fails.

**Implementation**: The constraint is enforced at the database level. The bulk assignment handler should handle unique violation errors gracefully and report which assignments were already in place.

### 5.4 User Account Deleted with Active Applications

**Scenario**: An applicant deletes their account (GDPR erasure) while they have submitted applications.

**Expected Behavior**: Per GDPR config, anonymization is preferred over hard delete (`GDPR_CONFIG.deletion.anonymizeInsteadOfDelete = true`). The application records should be anonymized (name replaced with "REDACTED") but retained for audit and assessment purposes. The `users` table supports soft delete (`deleted_at`).

**Implementation**: Soft delete via `users.deleted_at` timestamp. Application records reference `applicant_id` which is nullable (allowing the FK to survive user deletion).

### 5.5 Assessment Submitted After Call Status Changes

**Scenario**: A coordinator moves the call to "Completed" status while an assessor is still working on an assessment.

**Expected Behavior**: The assessment can still be submitted (there is no check against call status in the assessment submission flow).

**Risk**: Assessments submitted after the call is marked "Completed" may not be included in the final results export if the export was already generated.

**Recommendation**: Consider preventing assessment submission when the call is in "Completed" or "Archived" status, or at minimum flag late submissions in the master results.
