# User Stories: FUND-001

All user stories from PRD Section 5, mapped to implementation status and acceptance criteria verification.

---

## Applicant Stories

### US-A01: View Open Funding Calls

**As an applicant, I want to view open funding calls so that I can find relevant opportunities.**

| Criterion | Status | Implementation |
|---|---|---|
| List of open calls displayed with name, description, deadline | **Pass** | `GET /api/v1/calls/open` returns filtered list. Frontend: `CallsList.tsx` renders cards with name, description, close_at. |
| Only calls with status "Open" shown | **Pass** | Route handler filters by `status = 'open'`. Database index `idx_funding_calls_open` optimizes this query. |
| Deadline displayed in local timezone | **Pass** | Frontend receives UTC ISO 8601 timestamps and converts to local display. Email templates explicitly label "(UK Time)". |

**Route**: `GET /api/v1/calls/open` (public, no auth)
**Frontend**: `/calls` -> `frontend/src/pages/Applicant/CallsList.tsx`

---

### US-A02: Start Application

**As an applicant, I want to start an application for a selected call so that I can begin my submission.**

| Criterion | Status | Implementation |
|---|---|---|
| "Start Application" button visible for open calls | **Pass** | `CallsList.tsx` renders CTA for open calls. |
| Click creates draft application | **Pass** | `POST /api/v1/applications/` creates application with status 'draft'. `generate_application_reference()` trigger assigns reference number. |
| User navigated to submission form | **Pass** | Frontend navigates to `/dashboard/applications/:id` which renders `ApplicationForm.tsx`. |

**Route**: `POST /api/v1/applications/` (authenticated)
**Frontend**: `/dashboard/applications/:id` -> `frontend/src/pages/Applicant/ApplicationForm.tsx`

---

### US-A03: Upload Documents

**As an applicant, I want to upload my application form and supporting documents so that I can provide required information.**

| Criterion | Status | Implementation |
|---|---|---|
| Drag-and-drop or browse upload | **Pass** | `frontend/src/components/ui/FileUpload.tsx` and `frontend/src/components/Forms/FileUpload.tsx` provide both drag-and-drop zone and browse button. |
| File type validation (configurable per call) | **Pass** | Global: `FILE_UPLOAD_CONFIG.allowedMimeTypes`. Per-call: `funding_calls.requirements.allowedFileTypes`. Server-side validation in middleware. |
| File size validation (configurable per call) | **Pass** | Global: 50MB max. Per-call: `funding_calls.requirements.maxFileSize`. Database constraint: `application_files_size_check`. |
| Virus scan on upload | **Partial** | `FileService.scanFile()` exists but returns stub CLEAN. **GAP**: ClamAV integration not implemented. |
| Progress indicator for uploads | **Pass** | `ProgressBar` component shows upload progress. |
| Multiple files supported | **Pass** | `uploadMultiple` middleware handles multi-file uploads. `application_files` table supports unlimited files per application. |

**Route**: `POST /api/v1/applications/:id/files` (multipart, authenticated)

---

### US-A04: Complete Confirmations

**As an applicant, I want to complete required confirmations so that I acknowledge terms and conditions.**

| Criterion | Status | Implementation |
|---|---|---|
| Checkboxes for: guidance read, EDI form completed, data sharing consent | **Pass** | `confirmation_type` enum: `guidance_read`, `edi_completed`, `data_sharing_consent`. Frontend: `ConfirmationCheckbox.tsx`. |
| All required checkboxes must be ticked before submission | **Pass** | Submit endpoint checks all required confirmations exist. Per-call configuration in `requirements.requiredConfirmations`. |
| Clear labelling of required vs optional | **Pass** | Frontend labels include "(Required)" indicator. |

**Route**: `POST /api/v1/applications/:id/confirmations` (authenticated)

---

### US-A05: Deadline Enforcement

**As an applicant, I want the system to prevent submission after the deadline so that fairness is maintained.**

| Criterion | Status | Implementation |
|---|---|---|
| Submit button disabled after deadline | **Pass** | Frontend disables button when `close_at` is past. |
| Clear message showing deadline passed | **Pass** | `DeadlinePassedError` returns code `DEADLINE_PASSED` with deadline timestamp. |
| Deadline enforced server-side (Europe/London timezone) | **Pass** | Server compares UTC timestamps. `funding_calls.close_at` is TIMESTAMPTZ. Config timezone: `Europe/London`. |

**Route**: `POST /api/v1/applications/:id/submit` (authenticated, deadline-checked)

---

### US-A06: Submission Confirmation

**As an applicant, I want to receive confirmation of my submission so that I have proof it was received.**

| Criterion | Status | Implementation |
|---|---|---|
| Confirmation screen displayed on successful submission | **Pass** | Frontend navigates to `/dashboard/confirmation/:id` rendering `SubmissionConfirmation.tsx`. |
| Email receipt sent to applicant | **Pass** | `EmailService.sendSubmissionReceipt()` sends HTML+text email. |
| Receipt includes timestamp, application reference, call name | **Pass** | `SubmissionReceiptData` interface includes `applicant_name`, `application_reference`, `call_name`, `submitted_at`. Email formatted with UK time. |

---

### US-A07: Save Draft

**As an applicant, I want to save my draft application so that I can return and complete it later.**

| Criterion | Status | Implementation |
|---|---|---|
| Auto-save on file upload and confirmation changes | **Pass** | Files and confirmations are saved via separate endpoints independently of submission. |
| "Save Draft" button | **Pass** | `PUT /api/v1/applications/:id` updates draft. |
| Draft accessible until deadline | **Pass** | `GET /api/v1/applications/my` returns user's applications including drafts. |

---

## Coordinator Stories

### US-C01: Create Funding Call

**As a coordinator, I want to create a funding call so that I can open a new application window.**

| Criterion | Status | Implementation |
|---|---|---|
| Form with: name, description, open date-time, close date-time | **Pass** | `POST /api/v1/calls/` with Zod validation. Frontend: `CallSetup.tsx` multi-step wizard. |
| Status defaults to "Draft" | **Pass** | `call_status` default in schema: `'draft'`. |
| Call saved to database | **Pass** | `funding_calls` table with UUID PK. |

**Frontend**: `/dashboard/coordinator/calls/new` -> `frontend/src/pages/Coordinator/CallSetup.tsx`

---

### US-C02: Configure Submission Requirements

| Criterion | Status | Implementation |
|---|---|---|
| Configure allowed file types | **Pass** | `requirements.allowedFileTypes` in JSONB. |
| Configure maximum file size | **Pass** | `requirements.maxFileSize` in JSONB. |
| Configure required confirmations | **Pass** | `requirements.requiredConfirmations` in JSONB. |
| Add guidance text/links | **Pass** | `requirements.guidanceUrl` and `edi_form_url`. |

---

### US-C03: Define Assessment Criteria

| Criterion | Status | Implementation |
|---|---|---|
| Add/edit/remove criteria | **Pass** | `PUT /api/v1/calls/:id/criteria`. Array of criterion objects. |
| Set max points per criterion | **Pass** | `Criterion.max_points` (1-100 validated by Zod). |
| Set optional weighting | **Pass** | `Criterion.weight` (0-10, optional). |
| Set required assessors per application | **Pass** | `criteria_config.assessors_per_application`. |

---

### US-C04: Manage Assessor Pool

| Criterion | Status | Implementation |
|---|---|---|
| Add assessors (name, email, organisation) | **Pass** | `POST /api/v1/calls/:id/assessors`. |
| Remove assessors | **Pass** | `DELETE /api/v1/calls/:id/assessors/:assessorId`. |
| Tag assessors with expertise areas | **Pass** | `assessors.expertise_tags` JSONB with GIN index. |
| Invite assessors by email | **Partial** | `EmailService.sendAssessorAssignment()` sends notification. **GAP**: No dedicated invitation flow (invite -> accept -> account creation). Current flow assumes assessor accounts exist. |

---

### US-C05: View Applications Table

| Criterion | Status | Implementation |
|---|---|---|
| Table with sortable columns | **Pass** | `ApplicationsView.tsx` with `DataTable` component. |
| Filterable by status | **Pass** | `FilterParams.status` supported in API. |
| Available only after deadline | **Partial** | **GAP**: No explicit guard preventing coordinator from viewing applications before deadline. The PRD states "post-deadline" but the API allows access regardless of call status. |

---

### US-C06: Export Metadata (CSV/XLSX)

| Criterion | Status | Implementation |
|---|---|---|
| Export to CSV | **Pass** | `ExportService.exportApplicationsToCsv()`. |
| Export to XLSX | **Pass** | `ExportService.exportApplicationsToXlsx()` with styled headers and auto-filter. |
| Configurable columns | **Partial** | `ExportOptions.columns` defined in types but not yet implemented in the export logic. |

---

### US-C07: Download Application Files

| Criterion | Status | Implementation |
|---|---|---|
| Download individual application pack (ZIP) | **Pass** | `FileService.createApplicationZip()`. |
| Download all applications (bulk ZIP) | **Pass** | `GET /api/v1/applications/download/:callId`. |
| Secure, logged download | **Pass** | Coordinator role required. Audit logged. |

---

### US-C08: Assign Applications to Assessors

| Criterion | Status | Implementation |
|---|---|---|
| Select application(s) and assign to assessor(s) | **Pass** | `POST /api/v1/assignments/` for individual. |
| Bulk round-robin assignment | **Pass** | `POST /api/v1/assignments/bulk` with `strategy: 'round-robin'`. |
| Manual individual assignment | **Pass** | Individual endpoint with applicationId + assessorId. |
| Prevent self-assessment conflicts | **Partial** | **GAP**: No explicit check preventing a coordinator from assigning themselves. UNIQUE constraint prevents duplicate assignments but not self-assignment. |

---

### US-C09: View Assessment Progress

| Criterion | Status | Implementation |
|---|---|---|
| Dashboard showing assessor progress | **Pass** | `ScoringService.getCallProgress()` returns `AssessorProgress[]`. |
| Application view showing assessor completion | **Pass** | `ApplicationListItem.completed_assessments` and `assignment_count`. |
| Visual progress indicators | **Pass** | `ProgressRadial` and `ProgressBar` components. |

**Frontend**: `/dashboard/coordinator` -> `frontend/src/pages/Coordinator/Dashboard.tsx`

---

### US-C10: Send Reminders

| Criterion | Status | Implementation |
|---|---|---|
| Select assessors with outstanding assessments | **Pass** | `ScoringService.getAssessorsWithOutstanding()`. |
| Send reminder email with customisation | **Partial** | Template is fixed. **GAP**: No coordinator customisation of reminder message text. |
| Log reminder sent | **Pass** | `AuditAction.REMINDER_SENT`. `notification_logs` table available. |

---

### US-C11: View Master Results

| Criterion | Status | Implementation |
|---|---|---|
| One row per application | **Pass** | `MasterResultsResponse.results` array with one `ApplicationResult` per application. |
| Per-assessor scores visible | **Pass** | `ApplicationResult.assessor_scores` contains per-assessor breakdown. |
| Calculated totals/averages | **Pass** | `total_average`, `weighted_average` computed. |
| Assessor comments visible | **Pass** | `AssessorScore.overall_comment` and per-criterion comments. |
| Variance flagging | **Pass** | `high_variance_flag` on application, `high_variance` on criterion aggregates. |

**Frontend**: `/dashboard/coordinator/results` -> `frontend/src/pages/Coordinator/MasterResults.tsx`

---

### US-C12: Export Master Results

| Criterion | Status | Implementation |
|---|---|---|
| Export to XLSX | **Pass** | 3-sheet workbook: Summary, Results, Assessor Details. |
| Include all scores, aggregates, comments | **Pass** | Per-criterion scores, averages, variance, per-assessor details. |
| Access restricted to coordinator role | **Pass** | `requireRoles(UserRole.COORDINATOR, UserRole.ADMIN)` on all results routes. |

---

## Assessor Stories

### US-S01: View Assigned Applications

| Criterion | Status | Implementation |
|---|---|---|
| Dashboard shows only calls where I have assignments | **Pass** | `GET /api/v1/applications/assigned` filtered by assessor identity. |
| Only assigned applications visible | **Pass** | `RBACService.canAccessApplication()` checks assignment. |
| No access to unassigned applications | **Pass** | Server-side enforcement returns 403 for unassigned access attempts. |

---

### US-S02: View Application Materials

| Criterion | Status | Implementation |
|---|---|---|
| View/download application form | **Pass** | `GET /api/v1/applications/:id/materials` and file download endpoints. |
| View/download supporting documents | **Pass** | All files accessible via download endpoint. |
| Clear file listing | **Pass** | `ApplicationFile` interface includes original_filename, file_size, mime_type. |

---

### US-S03: Score Applications

| Criterion | Status | Implementation |
|---|---|---|
| Form showing each criterion with description | **Pass** | Criteria loaded from call config. Frontend renders form per criterion. |
| Score input with valid range | **Pass** | Zod: `score: z.number().min(0)`. `ScoringService.validateScores()` checks max_points. Frontend: `ScoreInput.tsx`. |
| Comments field per criterion | **Pass** | `CriterionScore.comment` optional string. `comments_required` configurable per criterion. |

---

### US-S04: COI Declaration

| Criterion | Status | Implementation |
|---|---|---|
| COI declaration checkbox | **Pass** | `coiConfirmed: z.boolean()` in Zod schema. |
| Must confirm before submitting | **Pass** | Database constraint: `coi_confirmed = TRUE` for status 'submitted'. |
| Flag to coordinator if COI declared | **Partial** | `coi_details` stored. **GAP**: No automatic notification to coordinator when COI is declared with details. Coordinator must check in master results. |

---

### US-S05: Submit Assessment

| Criterion | Status | Implementation |
|---|---|---|
| Submit active when all required fields complete | **Pass** | Frontend validates completeness. Server validates via Zod and `validateScores()`. |
| Confirmation prompt before submission | **Pass** | Frontend dialog confirmation before final submit. |
| Timestamped and locked on submission | **Pass** | `assessments.submitted_at` set. Status -> 'submitted'. |

---

### US-S06: Cannot See Others' Scores

| Criterion | Status | Implementation |
|---|---|---|
| No visibility of other assessors' assessments | **Pass** | `RBACService.canAccessAssessment()` returns 403 for non-owned assessments. |
| No visibility of master results | **Pass** | `canAccessMasterResults()` rejects ASSESSOR role. |
| Enforced server-side | **Pass** | RBAC middleware + service-level checks. Routes use `requireRoles()`. |

---

### US-S07: Save In-Progress Assessment

| Criterion | Status | Implementation |
|---|---|---|
| Auto-save on field change | **Partial** | **GAP**: No automatic save on field change in frontend. Explicit save via PUT endpoint available. |
| "Save Draft" button | **Pass** | `PUT /api/v1/assessments/assignment/:assignmentId` saves draft. |
| Draft accessible until submission or deadline | **Pass** | Draft status persists. Accessible via `GET /api/v1/assessments/assignment/:assignmentId`. |
