# Requirements Traceability: FUND-001

This document maps every functional requirement from the PRD to its implementation status in the codebase.

---

## FR-001 to FR-006: Funding Call Management

| ID | Requirement | Status | Implementation | Notes |
|---|---|---|---|---|
| FR-001 | Create funding call with name, description, open/close datetimes, status | **Implemented** | `POST /api/v1/calls/` in `backend/src/routes/calls.routes.ts`; `callsController.create`; Zod schema validates name (3-200 chars), description, datetimes. `funding_calls` table with `call_status` enum (draft/open/closed/in_assessment/completed/archived). | Status defaults to 'draft' per PRD. |
| FR-002 | Configure submission requirements (file types, size, confirmations) | **Implemented** | `funding_calls.requirements` JSONB column stores `allowedFileTypes`, `maxFileSize`, `maxFiles`, `requiredConfirmations`, `guidanceUrl`, `ediFormUrl`. Coordinator updates via `PUT /api/v1/calls/:id`. | Per-call configuration overlays global defaults from `FILE_UPLOAD_CONFIG`. |
| FR-003 | Configure assessment rubric (criteria, max points, weights, assessors per application) | **Implemented** | `funding_calls.criteria_config` JSONB stores criteria array with name, description, maxPoints, weight, commentsRequired. `PUT /api/v1/calls/:id/criteria` endpoint. `Criterion` interface defined in `backend/src/types/index.ts`. | Variance threshold configurable per call. |
| FR-004 | Manage assessor pool | **Implemented** | `GET/POST/DELETE /api/v1/calls/:id/assessors`. `call_assessor_pool` junction table. `assessors` table stores name, email, organisation, expertise_tags (JSONB). | Assessors can exist without a user account. |
| FR-005 | Call status transitions: Draft -> Open -> Closed -> In Assessment -> Completed -> Archived | **Partially Implemented** | `POST /api/v1/calls/:id/open` and `POST /api/v1/calls/:id/close` exist. Status enum covers all values. | **GAP**: No server-side enforcement of valid transition sequences (e.g., preventing Open -> Completed skip). Transition validation should be added to the controller. |
| FR-006 | Clone funding call | **Implemented** | `POST /api/v1/calls/:id/clone`. | Clones configuration including requirements and criteria. |

---

## FR-010 to FR-016: Applicant Submission

| ID | Requirement | Status | Implementation | Notes |
|---|---|---|---|---|
| FR-010 | Select funding call / view open calls | **Implemented** | `GET /api/v1/calls/open` (public, no auth). Frontend: `frontend/src/pages/Applicant/CallsList.tsx`. Route: `/calls`. | Lists calls with name, description, deadline. |
| FR-011 | Upload application form with file type, size validation, virus scan | **Partially Implemented** | `POST /api/v1/applications/:id/files` with Multer middleware. Type/size validation via `FILE_UPLOAD_CONFIG`. | **GAP**: Virus scanning is stub (always returns CLEAN). See ADR-008. |
| FR-012 | Required confirmations (guidance, EDI, data sharing) | **Implemented** | `POST /api/v1/applications/:id/confirmations`. `confirmations` table with `confirmation_type` enum. UNIQUE constraint on (application_id, type). Frontend: `frontend/src/components/Forms/ConfirmationCheckbox.tsx`. | IP address and user agent recorded per confirmation. |
| FR-013 | Deadline enforcement (Europe/London, server-side) | **Implemented** | `DeadlinePassedError` class in `backend/src/utils/errors.ts`. Server compares UTC timestamps. Config: `timezone: 'Europe/London'`. Database: `funding_calls.close_at` TIMESTAMPTZ. | See ADR-012 for timezone handling details. |
| FR-014 | Submission receipt (timestamp, lock, email) | **Implemented** | `POST /api/v1/applications/:id/submit` endpoint. `EmailService.sendSubmissionReceipt()` sends HTML+text email with reference, call name, UK-formatted timestamp. `applications.submitted_at` set, status -> 'submitted'. Frontend: `frontend/src/pages/Applicant/SubmissionConfirmation.tsx`. | Receipt includes reference number. |
| FR-015 | Draft persistence | **Implemented** | Applications created with status 'draft'. Files and confirmations saved independently of submission. `applications.updated_at` tracked. | Auto-save on file upload. |
| FR-016 | Application withdrawal | **Implemented** | `DELETE /api/v1/applications/:id` triggers withdrawal. `applications.withdrawn_at` timestamp set. `application_status` enum includes 'withdrawn'. | Logged action (AuditAction.APPLICATION_WITHDRAWN). Priority P2. |

---

## FR-020 to FR-027: Coordinator Post-Deadline Operations

| ID | Requirement | Status | Implementation | Notes |
|---|---|---|---|---|
| FR-020 | Applications table view (spreadsheet-style) | **Implemented** | `GET /api/v1/applications/call/:callId` returns `ApplicationListItem[]` with reference, applicant, submission date, file_count, assignment_count, completed_assessments. Frontend: `frontend/src/pages/Coordinator/ApplicationsView.tsx`, `frontend/src/components/Tables/ApplicationsTable.tsx`. | Sortable and filterable via `DataTable` component. |
| FR-021 | Export metadata (CSV/XLSX) | **Implemented** | `GET /api/v1/applications/export/:callId`. `ExportService.exportApplicationsToXlsx()` and `exportApplicationsToCsv()` in `backend/src/services/export.service.ts`. XLSX includes styled headers, auto-filter. | Configurable format via query parameter. |
| FR-022 | Download application files (ZIP) | **Implemented** | `GET /api/v1/applications/download/:callId` for bulk. `GET /api/v1/applications/:id/files/:fileId/download` for individual. `FileService.createApplicationZip()` generates ZIP archives. | Logged download in audit trail. |
| FR-023 | Assign applications to assessors | **Implemented** | `POST /api/v1/assignments/` (single), `POST /api/v1/assignments/bulk` (bulk with round-robin/random/balanced strategies). Frontend: `frontend/src/pages/Coordinator/AssignmentTool.tsx`. Zod validation on assignment input. | UNIQUE constraint prevents duplicate assignments. |
| FR-024 | Progress dashboard | **Implemented** | `GET /api/v1/assignments/progress/:callId` returns `CallProgress` with total_applications, total_assignments, completed/outstanding assessments, completion_percentage, per-assessor progress. Frontend: `frontend/src/pages/Coordinator/Dashboard.tsx`. | Visualization components: `ProgressRadial`, `SubmissionTimeline`. |
| FR-025 | Send reminder emails | **Implemented** | `POST /api/v1/assignments/remind/:id` (individual) and `POST /api/v1/assignments/remind-bulk` (bulk). `EmailService.sendReminder()` and `sendBulkReminders()`. | Red-themed HTML email with outstanding count. 100ms delay between bulk sends. |
| FR-026 | Reopen application | **Implemented** | `POST /api/v1/applications/:id/reopen`. Status -> 'reopened'. | Logged action. Priority P2. |
| FR-027 | Return assessment to assessor | **Implemented** | `POST /api/v1/assessments/:id/return`. `assessments.returned_at`, `returned_by`, `return_reason` columns. Status -> 'returned'. | Logged action. Priority P2. |

---

## FR-030 to FR-035: Assessor Scoring

| ID | Requirement | Status | Implementation | Notes |
|---|---|---|---|---|
| FR-030 | Restricted access (assigned only) | **Implemented** | `RBACService.canAccessApplication()` checks `assignedAssessorIds`. `GET /api/v1/applications/assigned` returns only assigned applications. All application routes for assessors filtered by assignment. | Server-side enforcement via RBAC middleware + service-level checks. |
| FR-031 | View application materials | **Implemented** | `GET /api/v1/applications/:id/materials`. Downloads individual files via `GET /api/v1/applications/:id/files/:fileId/download`. | Assessors and coordinators can access. |
| FR-032 | Score by criterion | **Implemented** | `POST /api/v1/assessments/assignment/:assignmentId` with Zod-validated `scoreSchema`: scores array (criterionId, score >= 0, optional comment), overallComment, coiConfirmed. `ScoringService.validateScores()` checks ranges and required comments. Frontend: `frontend/src/components/Forms/ScoreInput.tsx`. | Scores stored in `assessments.scores_json` JSONB. |
| FR-033 | COI declaration | **Implemented** | `assessments.coi_confirmed` (boolean) and `coi_details` (text). Database constraint: `coi_confirmed = TRUE` required for submitted status. Zod schema requires `coiConfirmed` boolean. | Cannot submit without COI confirmation. |
| FR-034 | Submit and lock | **Implemented** | `POST /api/v1/assessments/assignment/:assignmentId/submit`. Sets `submitted_at`, status -> 'submitted'. Database constraint enforces submitted_at presence for submitted status. | Locked unless coordinator returns (FR-027). |
| FR-035 | Draft assessment | **Implemented** | `PUT /api/v1/assessments/assignment/:assignmentId` saves draft. Status remains 'draft'. | Auto-save pattern available via PUT. Priority P1. |

---

## FR-040 to FR-044: Master Results

| ID | Requirement | Status | Implementation | Notes |
|---|---|---|---|---|
| FR-040 | Aggregate scoring (totals/averages, weighted) | **Implemented** | `ScoringService.calculateApplicationResult()` computes per-criterion averages, overall total_average, weighted_average (when weights defined). `ScoringService.getMasterResults()` aggregates for all submitted applications. | See ADR-014 for algorithm details. |
| FR-041 | Variance flagging | **Implemented** | Normalised variance threshold: `(variance / max_points^2) * 100 > threshold`. Default threshold from `funding_calls.criteria_config.variance_threshold`. Per-criterion and application-level flagging. | Requires 2+ assessor scores to trigger. |
| FR-042 | Master results view | **Implemented** | `GET /api/v1/results/call/:callId` returns `MasterResultsResponse` with per-application results (assessor scores, criterion aggregates, totals, variance flags) and summary statistics. Frontend: `frontend/src/pages/Coordinator/MasterResults.tsx`. | Coordinator and scheme_owner access only. |
| FR-043 | Export results to XLSX | **Implemented** | `GET /api/v1/results/call/:callId/export`. `ExportService.exportMasterResultsToXlsx()` generates 3-sheet workbook: Summary, Results (with dynamic criterion columns), Assessor Details. Conditional formatting for high variance. | Coordinator role required. |
| FR-044 | Ranking/sorting | **Implemented** | `GET /api/v1/results/call/:callId/ranking`. `ScoringService.rankResults()` sorts by total_average or weighted_average (descending). | Frontend enables column sorting. Priority P1. |

---

## Non-Functional Requirements Status

| ID | Requirement | Target | Status | Notes |
|---|---|---|---|---|
| NFR-001 | Page load time | <3s | **Untested** | Vite production build with tree-shaking, compression middleware enabled. Performance testing needed. |
| NFR-002 | Concurrent users | 100+ | **Untested** | Node.js async I/O suitable. Load testing needed. |
| NFR-003 | Application scale | Hundreds to thousands | **Implemented** | Database indexes optimized for coordinator view queries. Pagination supported via `PaginationParams`. |
| NFR-004 | File upload | 50MB with progress | **Implemented** | `FILE_UPLOAD_CONFIG.maxFileSize = 50MB`. Database constraint matches. Frontend has `FileUpload` component with progress. |
| NFR-005 | Export generation | 1000 apps in <60s | **Untested** | ExcelJS streaming used. Performance testing needed. |
| NFR-010 | Availability | 99.5% | **Not Configured** | Deployment and monitoring not yet in scope. |
| NFR-020 | Browser support | Chrome, Edge, Safari, Firefox | **Implemented** | React + Vite builds target modern browsers. |
| NFR-021 | Accessibility | WCAG 2.1 AA | **Partially Implemented** | Design tokens meet contrast requirements. Focus states defined. `prefers-reduced-motion` and `prefers-contrast: high` supported. Full audit needed. |
| NFR-022 | Responsive design | Mobile for applicant flow | **Implemented** | Responsive breakpoints defined. Applicant pages tested for mobile. |
| NFR-030 | Timezone handling | UTC storage, Europe/London display | **Implemented** | TIMESTAMPTZ columns, Europe/London config. See ADR-012. |
| NFR-031 | API design | REST with OpenAPI | **Partially Implemented** | REST API implemented. **GAP**: OpenAPI spec document not generated. |
| NFR-032 | Test coverage | 80% business logic | **Partially Implemented** | Test suite exists (1,672 tests per git log). Coverage percentage unverified. |
| NFR-033 | Documentation | API docs, user guides | **GAP** | API docs not auto-generated. User guides not created. |
