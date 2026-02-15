# Gap Analysis: PRD vs Implementation

**Document Version:** 1.0
**Analysis Date:** 15 February 2026
**PRD Version:** 1.0 (29 January 2026)
**Codebase Branch:** main (commit 77c27e8)

---

## Table of Contents

1. [Functional Requirements Gap Analysis](#1-functional-requirements-gap-analysis)
2. [User Stories Coverage](#2-user-stories-coverage)
3. [Non-Functional Requirements](#3-non-functional-requirements)
4. [Acceptance Criteria](#4-acceptance-criteria)
5. [Critical Gaps (Prioritised)](#5-critical-gaps-prioritised)
6. [Recommendations](#6-recommendations)

---

## 1. Functional Requirements Gap Analysis

### 1.1 Funding Call Management (FR-001 to FR-006)

| ID | Requirement | Status | Evidence | Gap Description |
|----|-------------|--------|----------|-----------------|
| FR-001 | Create funding call | IMPLEMENTED | `backend/src/controllers/calls.controller.ts` (createCall, lines 28-49); `backend/src/routes/calls.routes.ts` (POST /); `frontend/src/pages/Coordinator/CallSetup.tsx` (4-step wizard: Basic Info, Requirements, Criteria, Review) | Full CRUD with name, description, open/close date-times, status. Database schema supports all required fields. Frontend wizard covers all call creation fields. |
| FR-002 | Configure submission requirements | IMPLEMENTED | `frontend/src/pages/Coordinator/CallSetup.tsx` (Step 2 - Requirements: file types, max size, max files, guidance text, EDI URL, confirmations); `database/migrations/001_initial_schema.sql` (funding_calls.requirements JSONB column) | Configurable file types, max file size, max files, guidance text, EDI link, and required confirmations stored as JSONB. |
| FR-003 | Configure assessment rubric | IMPLEMENTED | `frontend/src/pages/Coordinator/CallSetup.tsx` (Step 3 - Criteria: name, description, max points, weight, comments required via useFieldArray); `database/migrations/001_initial_schema.sql` (funding_calls.criteria_config JSONB) | Criteria with max points, optional weights, and comments-required flag. Number of assessors per application is configurable in call setup. |
| FR-004 | Manage assessor pool | IMPLEMENTED | `backend/src/controllers/calls.controller.ts` (addAssessorToPool, removeAssessorFromPool, inviteAssessor); `backend/src/routes/calls.routes.ts` (assessor pool endpoints); `backend/src/models/fundingCall.model.ts` (assessor pool methods) | Add/remove assessors by user ID, invite by email (creates user if needed), expertise tags supported. No dedicated frontend assessor pool management page, but backend API is complete. |
| FR-005 | Call status transitions | IMPLEMENTED | `backend/src/models/fundingCall.model.ts` (isValidStatusTransition method); `backend/src/controllers/calls.controller.ts` (updateCallStatus with transition validation); `database/migrations/001_initial_schema.sql` (call_status enum: draft, open, closed, in_assessment, completed, archived) | Enforces valid transitions: Draft->Open->Closed->In Assessment->Completed->Archived. Invalid transitions return validation errors. |
| FR-006 | Clone funding call | IMPLEMENTED | `backend/src/controllers/calls.controller.ts` (cloneCall, lines 299-325); `backend/src/models/fundingCall.model.ts` (clone method); `backend/src/routes/calls.routes.ts` (POST /:callId/clone) | Clone creates new call with same configuration but new name and Draft status. Audit logged. |

### 1.2 Applicant Submission (FR-010 to FR-016)

| ID | Requirement | Status | Evidence | Gap Description |
|----|-------------|--------|----------|-----------------|
| FR-010 | Select funding call | IMPLEMENTED | `frontend/src/pages/Applicant/CallsList.tsx` (card grid of open calls with name, description, deadline, "Start Application" button); `backend/src/controllers/calls.controller.ts` (listOpenCalls endpoint) | Applicants view open calls and can start application. Deadline displayed with Europe/London timezone formatting and urgency badges. |
| FR-011 | Upload application form | PARTIAL | `frontend/src/pages/Applicant/ApplicationForm.tsx` (Step 1 - Upload Documents with drag-and-drop); `backend/src/controllers/applications.controller.ts` (uploadFiles); `backend/src/middleware/validateFile.middleware.ts` (file type/size validation); `backend/src/services/file.service.ts` (scanFile - STUB) | File upload with type/size validation works. **Virus scanning is a stub** -- `FileService.scanFile()` returns CLEAN after 100ms simulated delay (lines 268-278). The `validateFile.middleware.ts` has a mock scanner that only detects EICAR test patterns and regex-based script patterns, not actual virus scanning via ClamAV. |
| FR-012 | Required confirmations | IMPLEMENTED | `frontend/src/pages/Applicant/ApplicationForm.tsx` (Step 2 - Confirmations: guidance_read, edi_completed, data_sharing_consent checkboxes); `backend/src/controllers/applications.controller.ts` (addConfirmation, getConfirmations); `database/migrations/001_initial_schema.sql` (confirmations table with type enum) | Three confirmation types implemented with checkbox UI and database storage. All must be checked before submit button enables. |
| FR-013 | Deadline enforcement | PARTIAL | `frontend/src/pages/Applicant/ApplicationForm.tsx` (client-side isDeadlinePassed check disables submit button); `backend/src/controllers/applications.controller.ts` (submit method, lines 190-220) | **Client-side deadline enforcement exists** (submit button disabled, warning message). **Server-side deadline check is missing** -- the submit controller does NOT check `close_at` before accepting the submission. The query on lines 196-201 fetches requirements but does not compare `close_at` against current time. |
| FR-014 | Submission receipt | PARTIAL | `frontend/src/pages/Applicant/SubmissionConfirmation.tsx` (on-screen confirmation with reference number, timestamp, call name, file list, print button); `backend/src/services/email.service.ts` (submissionReceipt template defined); `backend/src/controllers/applications.controller.ts` (submit, lines 190-220) | **On-screen confirmation is implemented.** **Email receipt is NOT sent** -- the submit controller does not call `emailService.sendSubmissionReceipt()` after successful submission. The email template exists in `email.service.ts` but is never invoked during submission. |
| FR-015 | Draft persistence | IMPLEMENTED | `frontend/src/pages/Applicant/ApplicationForm.tsx` (auto-creates draft application, files saved on upload); `backend/src/controllers/applications.controller.ts` (create sets status='draft', update works on draft status) | Drafts created on application start, files saved as uploaded. Application remains in draft until explicit submit. |
| FR-016 | Application withdrawal | IMPLEMENTED | `backend/src/controllers/applications.controller.ts` (withdraw method, lines 93-114); `backend/src/routes/applications.routes.ts` (DELETE /:id) | Withdrawal changes status to 'withdrawn' for applications in 'draft' or 'submitted' status. Note: PRD says "before deadline" but controller does not enforce deadline check on withdrawal. |

### 1.3 Coordinator Post-Deadline Operations (FR-020 to FR-027)

| ID | Requirement | Status | Evidence | Gap Description |
|----|-------------|--------|----------|-----------------|
| FR-020 | Applications table view | IMPLEMENTED | `frontend/src/pages/Coordinator/ApplicationsView.tsx` (spreadsheet-style table with columns: reference, applicant, submission date, status, files, assignment info; sortable, filterable, paginated); `backend/src/controllers/applications.controller.ts` (list, listByCall endpoints) | Full spreadsheet-style view with sorting, filtering by status, search, and pagination. Does NOT verify call is past deadline before showing -- all submitted applications visible regardless of call status. |
| FR-021 | Export metadata | PARTIAL | `backend/src/services/export.service.ts` (applicationsMetadataExport with ExcelJS for XLSX and CSV); `backend/src/controllers/applications.controller.ts` (exportMetadata, lines ~298+); `frontend/src/pages/Coordinator/ApplicationsView.tsx` (export modal with CSV/XLSX options) | **Export service supports both CSV and XLSX formats** via ExcelJS. However, the `exportMetadata` controller method returns JSON (not file download) -- it does not call `exportService` methods. The frontend shows an export modal but the actual file generation endpoint may not produce downloadable files. |
| FR-022 | Download application files | IMPLEMENTED | `backend/src/controllers/applications.controller.ts` (downloadAllFiles creates ZIP archive); `backend/src/services/file.service.ts` (createZipArchive with archiver library); `backend/src/routes/applications.routes.ts` (GET /download/:callId) | Individual file download and bulk ZIP download implemented. ZIP archive created with archiver library. |
| FR-023 | Assign applications | IMPLEMENTED | `backend/src/controllers/assignments.controller.ts` (assignApplication, bulkAssign with round-robin, balanced, random strategies); `frontend/src/pages/Coordinator/AssignmentTool.tsx` (dual-panel with applications and assessors selection, round-robin or manual assignment); `backend/src/routes/assignments.routes.ts` (POST / and POST /bulk) | Individual and bulk assignment supported. Round-robin, balanced, and random strategies implemented. Frontend provides dual-panel selection UI with confirmation modal. COI check in controller references `coi_declarations` table that does not exist in schema. |
| FR-024 | Progress dashboard | IMPLEMENTED | `frontend/src/pages/Coordinator/Dashboard.tsx` (stats cards: total calls, open, in assessment, completed, total applications; active calls with progress indicators); `backend/src/controllers/assignments.controller.ts` (getProgress, getAssessorProgress with completion percentages and overdue detection) | Dashboard shows call-level progress. Assignment controller provides per-assessor and per-application completion tracking with overdue detection. |
| FR-025 | Send reminders | IMPLEMENTED | `backend/src/controllers/assignments.controller.ts` (sendReminder, sendBulkReminders); `backend/src/services/email.service.ts` (assessorReminder template, sendBulkReminders method); `backend/src/routes/assignments.routes.ts` (POST /:id/remind, POST /remind/bulk) | Individual and bulk reminder sending implemented with email templates. Reminders logged. |
| FR-026 | Reopen application | IMPLEMENTED | `backend/src/controllers/applications.controller.ts` (reopen method changes 'submitted' back to 'draft'); `backend/src/routes/applications.routes.ts` (POST /:id/reopen with coordinator role) | Coordinator can reopen submitted applications. Changes status from 'submitted' to 'draft'. |
| FR-027 | Return assessment | IMPLEMENTED | `backend/src/controllers/assessments.controller.ts` (returnForRevision method); `backend/src/routes/assessments.routes.ts` (POST /:id/return with coordinator role) | Coordinator can return assessment to assessor for revision. |

### 1.4 Assessor Scoring (FR-030 to FR-035)

| ID | Requirement | Status | Evidence | Gap Description |
|----|-------------|--------|----------|-----------------|
| FR-030 | Restricted access | PARTIAL | `backend/src/routes/applications.routes.ts` (GET /assigned with requireRoles ASSESSOR); `backend/src/controllers/applications.controller.ts` (getAssignedApplications joins assignments table); `backend/src/routes/assessments.routes.ts` (assessor routes require authenticate) | **Backend enforces restricted access** -- assessors can only query their assigned applications via the assignments table join. **No frontend assessor UI exists** -- there is no `/pages/Assessor/` directory. Assessors have no way to access their assignments through the UI. |
| FR-031 | View application materials | PARTIAL | `backend/src/routes/applications.routes.ts` (GET /:id/materials with ASSESSOR role); `backend/src/controllers/applications.controller.ts` (getMaterials endpoint) | **Backend endpoint exists** for viewing materials. **No frontend** for assessors to view/download application files through a UI. |
| FR-032 | Score by criterion | PARTIAL | `backend/src/controllers/assessments.controller.ts` (submitAssessment saves scores JSON, calculates total); `backend/src/routes/assessments.routes.ts` (POST /:assignmentId/submit); `backend/src/services/scoring.service.ts` (validateScores checks ranges and required comments) | **Backend scoring API is complete** -- scores per criterion with comments, validation of ranges, total score calculation. **No frontend scoring form** for assessors. |
| FR-033 | COI declaration | PARTIAL | `database/migrations/001_initial_schema.sql` (assessments.coi_confirmed BOOLEAN NOT NULL, CHECK constraint requires coi_confirmed=TRUE for submission); `backend/src/controllers/assessments.controller.ts` (finalSubmit includes COI check) | **Database enforces COI confirmation** at schema level (CHECK constraint). **Backend handles COI in assessment submission.** **No frontend COI declaration UI** for assessors. Also, the assignment controller COI check references a `coi_declarations` table that does not exist in the migration schema. |
| FR-034 | Submit and lock | PARTIAL | `backend/src/controllers/assessments.controller.ts` (finalSubmit changes status to 'submitted', updates assignment to 'completed'); `database/migrations/001_initial_schema.sql` (assessment_status enum includes 'submitted') | **Backend implements submit-and-lock** -- assessment status changed to 'submitted', assignment marked 'completed'. **No frontend submit UI** for assessors. |
| FR-035 | Draft assessment | PARTIAL | `backend/src/controllers/assessments.controller.ts` (submitAssessment creates draft, updateDraft updates existing draft); `backend/src/routes/assessments.routes.ts` (PUT /:assessmentId/draft) | **Backend supports draft save and update.** **No frontend** for assessors to save drafts. |

### 1.5 Master Results (FR-040 to FR-044)

| ID | Requirement | Status | Evidence | Gap Description |
|----|-------------|--------|----------|-----------------|
| FR-040 | Aggregate scoring | IMPLEMENTED | `backend/src/controllers/results.controller.ts` (getMasterResults with AVG, STDDEV, MIN, MAX aggregation); `backend/src/services/scoring.service.ts` (calculateApplicationResult with weighted averages, variance calculation); `frontend/src/pages/Coordinator/MasterResults.tsx` (displays average score, total score, variance per application) | Full aggregation with weighted averages, standard deviation, min/max. Both SQL-level and service-level aggregation implemented. |
| FR-041 | Variance flagging | IMPLEMENTED | `backend/src/controllers/results.controller.ts` (getVarianceFlags with configurable stddev threshold); `frontend/src/pages/Coordinator/MasterResults.tsx` (yellow highlight for high variance rows); `backend/src/services/scoring.service.ts` (highVariance flag in calculateApplicationResult) | Variance flagging at both backend (configurable threshold) and frontend (visual highlight). Average variance displayed in summary stats. |
| FR-042 | Master results view | IMPLEMENTED | `frontend/src/pages/Coordinator/MasterResults.tsx` (summary stats, sortable table with expandable rows showing per-assessor breakdown with scores and comments); `backend/src/controllers/results.controller.ts` (getMasterResults returns per-assessor assessments via jsonb_agg) | One row per application with per-assessor scores, aggregates, and comments visible in expandable detail rows. Coordinator-only access via dashboard route. |
| FR-043 | Export results | IMPLEMENTED | `backend/src/services/export.service.ts` (masterResultsExport with ExcelJS -- Summary, Results, Assessor Details worksheets with conditional formatting); `backend/src/controllers/results.controller.ts` (exportResults, exportDetailedResults); `frontend/src/pages/Coordinator/MasterResults.tsx` (export button) | XLSX export via ExcelJS with multi-sheet workbook. CSV export also supported. Export service includes conditional formatting for high variance. |
| FR-044 | Ranking/sorting | IMPLEMENTED | `backend/src/controllers/results.controller.ts` (getRanking with RANK() window function); `backend/src/services/scoring.service.ts` (rankResults sorts by total or weighted average); `frontend/src/pages/Coordinator/MasterResults.tsx` (sortable columns: avg score, total score, variance) | SQL-level ranking with RANK() window function. Frontend columns are sortable. Service-level ranking also available. |

---

## 2. User Stories Coverage

### 2.1 Applicant Stories

| ID | User Story | Frontend | Backend | Database | Overall Status | Gaps |
|----|------------|----------|---------|----------|----------------|------|
| US-A01 | View open funding calls | YES - CallsList.tsx with card grid, deadline badges, timezone formatting | YES - listOpenCalls endpoint with demo fallback | YES - funding_calls table with status filtering | IMPLEMENTED | None |
| US-A02 | Start application for selected call | YES - "Start Application" CTA links to /apply/:id; ApplicationForm.tsx auto-creates draft | YES - create endpoint sets status='draft' | YES - applications table with draft status | IMPLEMENTED | None |
| US-A03 | Upload application form and documents | YES - ApplicationForm.tsx Step 1 with drag-and-drop file upload | YES - uploadFiles controller; validateFile middleware checks type/size | YES - application_files table with scan_status | PARTIAL | **Virus scanning is a stub.** FileService.scanFile() returns CLEAN after simulated delay. validateFile middleware has mock scanner with EICAR/regex detection only, not actual ClamAV integration. |
| US-A04 | Complete required confirmations | YES - ApplicationForm.tsx Step 2 with guidance_read, edi_completed, data_sharing_consent checkboxes | YES - addConfirmation/getConfirmations controllers | YES - confirmations table with confirmation_type enum | IMPLEMENTED | None |
| US-A05 | System prevents submission after deadline | PARTIAL - Client-side isDeadlinePassed disables submit button | MISSING - submit controller does NOT check close_at server-side | YES - funding_calls.close_at stored as TIMESTAMPTZ | PARTIAL | **Server-side deadline enforcement missing.** Only client-side check exists. A direct API call could bypass the deadline. |
| US-A06 | Receive submission confirmation | PARTIAL - SubmissionConfirmation.tsx shows on-screen receipt with reference, timestamp, files, print button | PARTIAL - Email template exists in email.service.ts but submit controller never calls it | YES - applications.submitted_at timestamp recorded | PARTIAL | **Email receipt not sent.** On-screen confirmation works. Email template (`submissionReceipt`) exists but is never invoked by the submit controller. |
| US-A07 | Save draft application | YES - Auto-save on upload; draft state maintained | YES - create/update endpoints work on draft status | YES - applications table with 'draft' status | IMPLEMENTED | None |

### 2.2 Coordinator Stories

| ID | User Story | Frontend | Backend | Database | Overall Status | Gaps |
|----|------------|----------|---------|----------|----------------|------|
| US-C01 | Create funding call | YES - CallSetup.tsx 4-step wizard | YES - createCall controller with audit logging | YES - funding_calls table with all fields | IMPLEMENTED | None |
| US-C02 | Configure submission requirements | YES - CallSetup.tsx Step 2 (file types, max size, guidance, EDI, confirmations) | YES - requirements stored as JSONB on call update | YES - funding_calls.requirements JSONB | IMPLEMENTED | None |
| US-C03 | Define assessment criteria | YES - CallSetup.tsx Step 3 (criteria with useFieldArray: name, description, max points, weight, comments required) | YES - criteria_config stored as JSONB | YES - funding_calls.criteria_config JSONB | IMPLEMENTED | Number of assessors per application is configurable but enforcement of this count during assignment is not strictly validated. |
| US-C04 | Manage assessor pool | MISSING - No dedicated frontend page for assessor pool management | YES - Full API: add/remove/invite assessors with expertise tags | YES - call_assessor_pool table, users table with assessor role | PARTIAL | **No frontend UI** for managing the assessor pool. Backend API is complete including email invitation. |
| US-C05 | View applications in spreadsheet table | YES - ApplicationsView.tsx with sortable, filterable, paginated table | YES - list, listByCall endpoints with pagination | YES - applications table with indexes | IMPLEMENTED | Table does not enforce "available only after deadline" -- all applications visible regardless of call status. |
| US-C06 | Export application metadata | PARTIAL - ApplicationsView.tsx has export modal with CSV/XLSX options | PARTIAL - exportMetadata controller returns JSON; export service has XLSX/CSV methods but controller does not call them | YES - data available | PARTIAL | **Export controller returns JSON instead of calling export service.** The ExcelJS-based export service exists but is not wired to the controller endpoint. Frontend export modal may not produce actual file downloads. |
| US-C07 | Download application files | YES - ApplicationsView.tsx "Download All Files" button | YES - downloadAllFiles creates ZIP via archiver | YES - application_files table | IMPLEMENTED | None |
| US-C08 | Assign applications to assessors | YES - AssignmentTool.tsx with dual-panel selection, round-robin or manual | YES - assignApplication, bulkAssign (round-robin, balanced, random) | YES - assignments table | IMPLEMENTED | COI prevention check references non-existent `coi_declarations` table. |
| US-C09 | View assessment progress | YES - Dashboard.tsx with stats cards, progress indicators per call | YES - getProgress, getAssessorProgress with completion % and overdue detection | YES - assignments and assessments tables | IMPLEMENTED | None |
| US-C10 | Send reminder emails | MISSING - No dedicated frontend reminder UI | YES - sendReminder, sendBulkReminders controllers with email templates | YES - notification_logs table | PARTIAL | **No frontend UI** for selecting assessors and sending reminders. Backend API and email templates are complete. |
| US-C11 | View master results | YES - MasterResults.tsx with summary stats, sortable table, expandable per-assessor breakdown, variance flags | YES - getMasterResults with aggregation, variance, ranking | YES - assessments data aggregated via SQL | IMPLEMENTED | None |
| US-C12 | Export master results | YES - MasterResults.tsx export button | YES - exportResults/exportDetailedResults endpoints; export service with multi-sheet XLSX | YES - data available | IMPLEMENTED | Export service fully implemented with Summary, Results, and Assessor Details worksheets. |

### 2.3 Assessor Stories

| ID | User Story | Frontend | Backend | Database | Overall Status | Gaps |
|----|------------|----------|---------|----------|----------------|------|
| US-S01 | See only assigned applications | MISSING - No assessor pages exist (no /pages/Assessor/ directory) | YES - getAssignedApplications joins assignments table to filter | YES - assignments table links assessor to application | PARTIAL | **Entire assessor frontend is missing.** Backend correctly restricts via assignment joins. No UI for assessors to see their assigned applications. |
| US-S02 | View application materials | MISSING - No assessor UI | YES - getMaterials endpoint with ASSESSOR role | YES - application_files table | PARTIAL | **No frontend.** Backend endpoint exists. |
| US-S03 | Score applications against criteria | MISSING - No assessor scoring form | YES - submitAssessment, validateScores in scoring.service.ts | YES - assessments table with scores JSONB | PARTIAL | **No frontend scoring form.** Backend API complete with validation. |
| US-S04 | Declare conflicts of interest | MISSING - No assessor COI UI | PARTIAL - COI confirmed on assessment submission; assignment COI check references missing table | YES - assessments.coi_confirmed with CHECK constraint | PARTIAL | **No frontend.** Database enforces COI at schema level. Assignment controller references non-existent `coi_declarations` table. |
| US-S05 | Submit assessment | MISSING - No assessor submit UI | YES - finalSubmit changes status to 'submitted', locks assessment | YES - assessment_status enum with 'submitted' | PARTIAL | **No frontend.** Backend submit-and-lock is implemented. |
| US-S06 | Cannot see other assessors' scores | N/A - No assessor frontend | YES - Assessor queries filter by assessor_id; no endpoint exposes other assessors' work to assessor role | YES - RBAC at database query level | PARTIAL | **Cannot verify end-to-end** without assessor frontend. Backend correctly restricts via SQL WHERE clauses. |
| US-S07 | Save in-progress assessment | MISSING - No assessor UI | YES - submitAssessment creates draft, updateDraft updates | YES - assessment_status includes 'draft' | PARTIAL | **No frontend.** Backend draft save/update API exists. |

---

## 3. Non-Functional Requirements

### 3.1 Performance (NFR-001 to NFR-005)

| ID | Requirement | Status | Evidence | Gap Description |
|----|-------------|--------|----------|-----------------|
| NFR-001 | Page load < 3 seconds | PARTIAL | React SPA with code splitting via React Router; QueryClient with 5-minute stale time; design-tokens.css, animations.css loaded | No performance testing or monitoring in place. No Lighthouse benchmarks recorded. Implementation uses standard React patterns that should meet target but unverified. |
| NFR-002 | 100+ concurrent users | PARTIAL | `backend/src/middleware/rateLimit.middleware.ts` exists; Express with async handlers; PostgreSQL connection pool | No load testing configured. Rate limiting exists but no verification of concurrent user support. |
| NFR-003 | Support thousands of applications | IMPLEMENTED | `database/migrations/002_indexes.sql` (comprehensive indexing including composite, partial, GIN indexes); pagination in all list endpoints | Database properly indexed for scale. Pagination implemented across all list endpoints. |
| NFR-004 | File upload up to 50MB with progress | PARTIAL | `backend/src/middleware/upload.middleware.ts` exists; frontend ApplicationForm.tsx has drag-and-drop with progress | File size limit is configurable per call. Need to verify default max size is >= 50MB. Frontend shows upload progress. |
| NFR-005 | Export 1000 applications < 60 seconds | PARTIAL | `backend/src/services/export.service.ts` uses ExcelJS with streaming-capable API | No performance benchmarks. Export service exists but large-scale performance unverified. |

### 3.2 Availability and Reliability (NFR-010 to NFR-013)

| ID | Requirement | Status | Evidence | Gap Description |
|----|-------------|--------|----------|-----------------|
| NFR-010 | 99.5% availability | MISSING | No deployment infrastructure, monitoring, or availability configuration found | No infrastructure-as-code, health endpoints (beyond demo routes), uptime monitoring, or alerting configured. |
| NFR-011 | Scheduled maintenance windows | MISSING | No maintenance mode implementation | No mechanism for maintenance windows, user notifications, or graceful degradation. |
| NFR-012 | Daily backups | MISSING | No backup configuration or scripts | No database backup scripts, S3 backup policies, or restore procedures documented. |
| NFR-013 | Data retention policy (7-year default) | PARTIAL | `database/migrations/001_initial_schema.sql` (funding_calls has retention-related fields in JSONB config) | Database schema supports retention configuration per call. No automated retention enforcement, deletion jobs, or archival processes implemented. |

### 3.3 Usability and Accessibility (NFR-020 to NFR-023)

| ID | Requirement | Status | Evidence | Gap Description |
|----|-------------|--------|----------|-----------------|
| NFR-020 | Browser support (Chrome, Edge, Safari, Firefox) | PARTIAL | React with TypeScript, standard CSS, no browser-specific code observed | No cross-browser testing configuration (e.g., BrowserStack). Standard React should work across modern browsers but unverified. |
| NFR-021 | WCAG 2.1 AA | MISSING | No accessibility attributes (aria-*, role), no axe-core testing, no keyboard navigation handlers observed in frontend components | No evidence of accessibility implementation. Frontend pages use standard HTML elements but lack ARIA attributes, skip navigation, focus management, or screen reader support. |
| NFR-022 | Responsive design (tablet/mobile for applicant flow) | PARTIAL | CSS includes responsive patterns; `frontend/src/styles/design-tokens.css` and `components.css` exist | Basic responsive CSS exists. No dedicated mobile testing or responsive breakpoint verification. |
| NFR-023 | English (UK) as primary language; i18n-ready | PARTIAL | Content is in English (UK). No i18n framework (e.g., react-i18next) integrated | All strings hardcoded in English. No i18n framework configured for future language support. |

### 3.4 Technical Standards (NFR-030 to NFR-033)

| ID | Requirement | Status | Evidence | Gap Description |
|----|-------------|--------|----------|-----------------|
| NFR-030 | Timezone handling (UTC storage, Europe/London display) | IMPLEMENTED | `database/migrations/001_initial_schema.sql` (TIMESTAMPTZ columns); `frontend/src/pages/Applicant/CallsList.tsx` (toLocaleString with 'Europe/London' timezone) | Timestamps stored as TIMESTAMPTZ (UTC). Frontend formats to Europe/London. |
| NFR-031 | RESTful API with OpenAPI spec | PARTIAL | RESTful route design with standard HTTP methods; `backend/src/routes/` follow REST patterns | REST API implemented. **No OpenAPI/Swagger specification file** found. No auto-generated API documentation. |
| NFR-032 | 80% test coverage for business logic | PARTIAL | Test suite exists (commit message references 1,672 tests) | Tests exist but coverage percentage not verified. No coverage configuration or reports found in the codebase. |
| NFR-033 | API and user documentation | MISSING | No generated API docs; no user guides | No OpenAPI spec, no Swagger UI, no user documentation beyond README. |

---

## 4. Acceptance Criteria

| ID | Criterion | Status | Evidence | Gap Description |
|----|-----------|--------|----------|-----------------|
| AC-01 | Cannot submit without required upload(s) and confirmations | PARTIAL | Frontend: ApplicationForm.tsx enables submit only when files uploaded and all confirmations checked. Backend: submit controller queries confirmations but does NOT validate them -- just fetches requirements. | **Server-side confirmation validation is incomplete.** Frontend enforces it client-side. Backend queries confirmations but does not verify all required confirmations are present before changing status to 'submitted'. |
| AC-02 | Cannot submit after call close date-time | PARTIAL | Frontend: isDeadlinePassed check disables submit button. Backend: submit controller does NOT check close_at. | **Server-side deadline enforcement missing.** Only client-side protection. API can be called directly to bypass deadline. |
| AC-03 | Coordinator can view applications table and export metadata | PARTIAL | ApplicationsView.tsx with full table, filtering, sorting. Export modal exists but backend exportMetadata returns JSON not file. | **Export endpoint does not produce downloadable files.** Table view works correctly. |
| AC-04 | Coordinator can assign each application to multiple assessors | IMPLEMENTED | AssignmentTool.tsx with multi-select; bulkAssign supports round-robin, balanced, random strategies. | Fully functional. |
| AC-05 | Assessors only see their assigned applications | PARTIAL | Backend: getAssignedApplications filters via assignments table join. No assessor frontend to verify end-to-end. | **Cannot verify without assessor UI.** Backend enforcement correct. |
| AC-06 | Assessors can submit scores and comments per criterion | PARTIAL | Backend: submitAssessment accepts scores JSON with per-criterion scores and comments. No assessor frontend scoring form. | **No frontend scoring form.** Backend API complete. |
| AC-07 | Assessors cannot see other assessors' scores or master results | PARTIAL | Backend: assessor queries filter by assessor_id. Results routes require coordinator/admin role. | **Enforced server-side.** No assessor frontend to verify complete isolation. |
| AC-08 | Master results aggregates from multiple assessors | IMPLEMENTED | results.controller.ts uses AVG, STDDEV, MIN, MAX with GROUP BY; scoring.service.ts calculates weighted averages; MasterResults.tsx displays aggregates. | Fully functional with SQL aggregation and service-level calculation. |
| AC-09 | Master results visible/exportable only to coordinator role | IMPLEMENTED | results.routes.ts: all routes (except demo) require authenticate + requireRoles(COORDINATOR, ADMIN); export.service.ts produces XLSX. | Access control enforced via middleware. Export produces multi-sheet XLSX. |
| AC-10 | Progress dashboard accurately shows completion | IMPLEMENTED | Dashboard.tsx with stats cards and progress indicators; assignments.controller.ts tracks per-assessor and per-application completion with overdue detection. | Fully functional. |
| AC-11 | All actions logged in audit log | PARTIAL | `backend/src/middleware/audit.middleware.ts` exists; calls controller logs CALL_CREATED, CALL_STATUS_CHANGED, CALL_UPDATED, CONFIG_CHANGED; `database/migrations/001_initial_schema.sql` creates immutable audit_logs table with UPDATE/DELETE prevention rules. | **Audit logging exists for call operations** and configuration changes. **Not all actions are logged** -- application submission, file downloads, assessment submissions, and login/logout events do not appear to generate audit entries in their respective controllers. |
| AC-12 | Files scanned for viruses before storage | STUB | `backend/src/services/file.service.ts` (scanFile returns CLEAN after 100ms delay, lines 268-278); `backend/src/middleware/validateFile.middleware.ts` (mock scanner with EICAR/regex detection only, lines 263-289) | **Virus scanning is a stub.** No actual ClamAV or cloud scanning integration. FileService.scanFile() always returns CLEAN. validateFile middleware has basic pattern matching but not real antivirus. |

---

## 5. Critical Gaps (Prioritised)

### Priority 1 -- Blockers (P0 requirements not met)

1. **No Assessor Frontend UI** (FR-030 to FR-035, US-S01 to US-S07)
   - Impact: The entire assessor user journey is missing from the frontend
   - Affected: 6 functional requirements, 7 user stories, 3 acceptance criteria
   - Backend APIs exist and are functional; only the React pages/components are absent
   - Location needed: `/frontend/src/pages/Assessor/` (directory does not exist)
   - Screens needed per PRD Section 11.1: Assigned Applications List, Assessment Form

2. **Server-Side Deadline Enforcement Missing** (FR-013, US-A05, AC-02)
   - Impact: Deadline can be bypassed via direct API call
   - Location: `/backend/src/controllers/applications.controller.ts` submit method (lines 190-220)
   - Fix: Add server-side check comparing `funding_calls.close_at` against `NOW()` in Europe/London timezone before accepting submission

3. **Virus Scanning Is a Stub** (FR-011, US-A03, AC-12)
   - Impact: Files are not actually scanned for malware
   - Locations: `/backend/src/services/file.service.ts` (scanFile, lines 268-278), `/backend/src/middleware/validateFile.middleware.ts` (scanForViruses, lines 265-289)
   - Fix: Integrate ClamAV daemon or cloud scanning API

4. **Email Submission Receipt Not Sent** (FR-014, US-A06)
   - Impact: Applicants do not receive email proof of submission
   - Location: `/backend/src/controllers/applications.controller.ts` submit method does not invoke `emailService.sendSubmissionReceipt()`
   - Fix: Call email service after successful submission status change

### Priority 2 -- Significant Gaps (P0 requirements partially met)

5. **Login and Register Pages Are Placeholders** (Auth system)
   - Impact: Users cannot authenticate through the frontend
   - Location: `/frontend/src/App.tsx` lines 80-81 (placeholder divs)
   - Backend auth API exists: register, login, logout, refresh, profile, change-password
   - Fix: Implement actual Login and Register React components

6. **Export Metadata Controller Does Not Produce Files** (FR-021, US-C06, AC-03)
   - Impact: Coordinator cannot download CSV/XLSX exports of application metadata
   - Location: `/backend/src/controllers/applications.controller.ts` exportMetadata method
   - Export service with ExcelJS exists at `/backend/src/services/export.service.ts` but is not called
   - Fix: Wire exportMetadata controller to call exportService methods

7. **No Assessor Pool Management Frontend** (FR-004, US-C04)
   - Impact: Coordinators cannot manage assessor pool through the UI
   - Backend API complete at `/backend/src/controllers/calls.controller.ts`
   - Fix: Add assessor pool management UI to coordinator call setup or dedicated page

8. **No Reminder Sending Frontend** (FR-025, US-C10)
   - Impact: Coordinators cannot send reminders through the UI
   - Backend API complete at `/backend/src/controllers/assignments.controller.ts`
   - Fix: Add reminder UI to coordinator progress/dashboard view

9. **Incomplete Audit Logging** (AC-11)
   - Impact: Not all significant actions are immutably logged
   - Missing audit entries: application submissions, file downloads, assessment submissions, login/logout events
   - Fix: Add createAuditLog calls in applications.controller.ts submit, assessments controller, and auth controller

### Priority 3 -- Minor Gaps (P1/P2 requirements or NFRs)

10. **No OpenAPI/Swagger Specification** (NFR-031, NFR-033)
    - Impact: No auto-generated API documentation
    - Fix: Add swagger-jsdoc/swagger-ui-express or generate OpenAPI spec

11. **No WCAG 2.1 AA Compliance** (NFR-021)
    - Impact: Public applicant pages may not meet accessibility requirements
    - Fix: Add ARIA attributes, keyboard navigation, focus management, screen reader support

12. **No Backup or Recovery Procedures** (NFR-012)
    - Impact: Data could be lost without backup infrastructure
    - Fix: Configure database backup schedule and test restore procedure

13. **No Maintenance Mode** (NFR-011)
    - Impact: No way to gracefully take system offline for maintenance
    - Fix: Implement maintenance mode flag with user-facing notification

14. **COI Declarations Table Missing** (FR-033)
    - Impact: Assignment controller COI check queries non-existent `coi_declarations` table
    - Location: `/backend/src/controllers/assignments.controller.ts`
    - Fix: Either add migration for coi_declarations table or use assessments.coi_confirmed

15. **Server-Side Confirmation Validation Incomplete** (AC-01)
    - Impact: Submit endpoint queries confirmations but does not validate all required ones are present
    - Location: `/backend/src/controllers/applications.controller.ts` submit method
    - Fix: Add validation logic comparing required confirmations against actual confirmed entries

16. **Scheme Owner Role UI Missing** (PRD Section 4.1)
    - Impact: No read-only overview for senior stakeholders
    - Note: Marked as "Optional" in PRD; database has `scheme_owner` in user_role enum

---

## 6. Recommendations

### Immediate Actions (Before Go-Live)

1. **Build Assessor Frontend** -- Create `/frontend/src/pages/Assessor/` with:
   - `AssignedApplicationsList.tsx` -- Dashboard showing calls with assignments, application cards with status badges
   - `AssessmentForm.tsx` -- File viewer, scoring rubric per criterion, comment fields, COI checkbox, submit button
   - Add assessor routes to `App.tsx`

2. **Implement Server-Side Deadline Enforcement** -- Add `close_at` check in the submit controller:
   ```sql
   SELECT close_at FROM funding_calls WHERE id = (SELECT call_id FROM applications WHERE id = $1)
   ```
   Compare against `NOW() AT TIME ZONE 'Europe/London'` and reject if past deadline.

3. **Wire Email Submission Receipt** -- Call `emailService.sendSubmissionReceipt()` after successful submission in `applications.controller.ts`.

4. **Implement Login/Register Pages** -- Replace placeholder divs in App.tsx with functional React components using the existing auth API.

5. **Integrate Virus Scanning** -- Replace stub with ClamAV daemon connection or cloud scanning API (e.g., VirusTotal API, AWS GuardDuty).

6. **Wire Export Controller** -- Connect `exportMetadata` in applications.controller.ts to `exportService.applicationsMetadataExport()`.

### Short-Term Actions (Pre-Production Hardening)

7. **Complete Audit Logging** -- Add audit entries for: application submit, file download, assessment submit/draft, login, logout, password change.

8. **Add Server-Side Confirmation Validation** -- Verify all required confirmations exist and are confirmed before accepting submission.

9. **Build Assessor Pool Management UI** -- Add coordinator page for managing assessor pool per call.

10. **Build Reminder Sending UI** -- Add button/modal in coordinator dashboard to send reminders to assessors with outstanding assessments.

11. **Fix COI Declarations** -- Either add `coi_declarations` table migration or update assignment controller to use a different COI check mechanism.

12. **Generate OpenAPI Specification** -- Add swagger-jsdoc annotations and swagger-ui-express endpoint.

### Medium-Term Actions (Post-Launch Improvement)

13. **WCAG 2.1 AA Compliance** -- Audit all public-facing pages with axe-core; add ARIA attributes, keyboard navigation, focus management.

14. **Infrastructure Hardening** -- Configure database backups, monitoring, alerting, and maintenance mode.

15. **i18n Framework** -- Integrate react-i18next for future multi-language support.

16. **Performance Testing** -- Implement load testing with k6 or Artillery; verify NFR-001 through NFR-005.

17. **Test Coverage Reporting** -- Configure coverage reports to verify NFR-032 (80% coverage target).

---

## Summary Statistics

| Category | Total | Implemented | Partial | Stub | Missing |
|----------|-------|-------------|---------|------|---------|
| Functional Requirements (FR) | 24 | 14 | 9 | 1 | 0 |
| User Stories (US) | 26 | 10 | 16 | 0 | 0 |
| Non-Functional Requirements (NFR) | 16 | 2 | 9 | 0 | 5 |
| Acceptance Criteria (AC) | 12 | 5 | 6 | 1 | 0 |
| **Totals** | **78** | **31 (40%)** | **40 (51%)** | **2 (3%)** | **5 (6%)** |

The platform has strong backend API coverage (most endpoints exist and function correctly) and solid database schema design. The primary gap is the **complete absence of the assessor frontend**, which affects 7 user stories and 6 functional requirements. Secondary gaps involve **server-side enforcement** (deadline, confirmations) and **integration stubs** (virus scanning, email receipt). Addressing the Priority 1 blockers would bring the platform to approximately 75% full implementation coverage.
