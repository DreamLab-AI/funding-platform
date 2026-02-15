# Domain and Application Services

**Funding Application Submission & Assessment Platform**

This document defines the domain services and application services, their responsibilities, and their mapping to actual source files in the codebase.

---

## Service Categories

| Category | Description | Examples |
|----------|-------------|---------|
| **Domain Service** | Encapsulates business logic that does not naturally belong to a single entity | ScoringService |
| **Application Service** | Orchestrates use cases by coordinating entities, domain services, and infrastructure | Controllers |
| **Infrastructure Service** | Handles technical concerns (storage, email, export) | FileService, EmailService, ExportService |

---

## 1. Scoring Service (Domain Service)

**File:** `/backend/src/services/scoring.service.ts`
**Type:** Domain Service -- contains core business logic for score aggregation and variance analysis.

### Responsibilities

1. **Score aggregation** -- calculate averages, weighted averages, and totals across assessors for each application
2. **Variance analysis** -- detect high variance between assessor scores based on configurable threshold
3. **Score validation** -- verify scores are within valid ranges and all required criteria are scored
4. **Progress tracking** -- compute assessment completion statistics per call and per assessor
5. **Ranking** -- order applications by total or weighted average score

### Methods

| Method | Lines | Description |
|--------|-------|-------------|
| `calculateApplicationResult(application, call)` | 30-129 | Computes aggregated result for a single application: per-criterion averages, weighted averages, variance, and high-variance flags |
| `getMasterResults(call_id)` | 134-179 | Retrieves all submitted applications for a call and computes results plus summary statistics |
| `getCallProgress(call_id)` | 184-271 | Queries assignment and assessment completion rates; computes per-assessor progress |
| `calculateAssessorTotal(scores, criteria)` | 277-301 | Computes total and weighted total for a single assessor's scores |
| `validateScores(scores, criteria)` | 307-341 | Validates scores against criteria ranges and comment requirements |
| `getAssessorsWithOutstanding(call_id)` | 346-349 | Filters assessor progress to those with outstanding work |
| `rankResults(results, sortBy)` | 354-370 | Sorts application results by total or weighted average descending |

### Algorithms

**Average Score Calculation:**
```typescript
calculateAverage(scores: number[]): number
// Arithmetic mean of assessor overall_score values
```

**Weighted Average Calculation:**
```typescript
calculateWeightedAverage(values: number[], weights: number[]): number
// Sum(value * weight) / Sum(weight)
// Applied per-assessor, then averaged across assessors
```

**Variance Calculation:**
```typescript
calculateVariance(scores: number[]): number
// Statistical variance: Avg((score - mean)^2)
```

**High Variance Detection:**
```typescript
high_variance = scores.length >= 2 &&
  (variance / Math.pow(criterion.max_points, 2)) * 100 > highVarianceThreshold
// Normalised variance as percentage of max possible variance
// Threshold is per-call configurable (default 20%)
```

### Dependencies

- `FundingCallModel` -- reads call configuration and criteria
- `ApplicationModel` -- reads application data
- `AssessmentModel` -- reads submitted assessments with assessor info
- `query()` -- direct database access for progress queries
- Helper functions from `/backend/src/utils/helpers.ts`: `calculateAverage`, `calculateVariance`, `calculateWeightedAverage`, `calculateStdDev`

### Export

Both a static class (`ScoringService`) and a proxy object (`scoringService`) are exported. The proxy provides aliases (`calculateTotal`, `calculateBreakdown`) for backward compatibility.

---

## 2. File Service (Infrastructure Service)

**File:** `/backend/src/services/file.service.ts`
**Type:** Infrastructure Service -- abstracts file storage behind a unified interface.

### Responsibilities

1. **File upload** -- store files to AWS S3 or local filesystem
2. **File retrieval** -- read files from S3 or local storage
3. **Signed URLs** -- generate time-limited download URLs for S3
4. **File deletion** -- remove files from storage
5. **ZIP archival** -- create ZIP archives of multiple files
6. **Virus scanning** -- scan files for malware (currently stubbed)
7. **Metadata** -- retrieve file size, type, and modification date

### Methods

| Method | Lines | Description |
|--------|-------|-------------|
| `uploadFile(file, subPath)` | 40-95 | Uploads to S3 or local storage; generates unique filename |
| `getFile(filePath)` | 100-135 | Retrieves file buffer from S3 or local |
| `getSignedDownloadUrl(filePath, expiresIn)` | 140-162 | S3 presigned URL (1 hour default) or local API path |
| `deleteFile(filePath)` | 167-191 | Removes file from S3 or local |
| `fileExists(filePath)` | 196-213 | Existence check via HeadObject or fs.existsSync |
| `createZipArchive(files)` | 218-247 | Creates in-memory ZIP using archiver library |
| `createApplicationZip(applicationRef, files)` | 252-262 | ZIP of all files in an application |
| `scanFile(filePath)` | 268-278 | **Stub** -- returns `CLEAN` after 100ms delay |
| `getFileMetadata(filePath)` | 283-317 | Returns size, contentType, lastModified |

### Storage Abstraction

```
FileService
  |
  +-- S3 Mode (when AWS credentials configured)
  |     Uses: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner
  |
  +-- Local Mode (fallback)
        Uses: fs module, process.cwd()/uploads directory
```

### Gap: Virus Scanning

The `scanFile()` method at line 268 is a placeholder:
```typescript
static async scanFile(filePath: string): Promise<FileScanStatus> {
  // TODO: Implement actual virus scanning
  logger.info('Virus scan requested (simulated)', { path: filePath });
  await new Promise((resolve) => setTimeout(resolve, 100));
  return FileScanStatus.CLEAN;
}
```

This is a P0 requirement (AC-12: "Files are scanned for viruses before storage"). The PRD specifies ClamAV or a cloud scanning service.

---

## 3. Email Service (Infrastructure Service)

**File:** `/backend/src/services/email.service.ts`
**Type:** Infrastructure Service -- sends transactional emails.

### Responsibilities

1. **Submission receipts** -- confirm application receipt to applicants
2. **Assessor assignment notifications** -- inform assessors of new assignments
3. **Assessment reminders** -- remind assessors of outstanding work
4. **Bulk reminders** -- send reminders to multiple assessors with rate limiting

### Methods

| Method | Lines | Description |
|--------|-------|-------------|
| `sendSubmissionReceipt(email, data)` | 85-153 | HTML + plaintext receipt with reference number and timestamp |
| `sendAssessorAssignment(email, data)` | 158-235 | HTML + plaintext assignment notification with login URL |
| `sendReminder(email, data)` | 240-317 | HTML + plaintext reminder with outstanding count and due date |
| `sendBulkReminders(reminders)` | 323-342 | Iterates reminders with 100ms delay for rate limiting |
| `verifyConfiguration()` | 347-365 | Tests SendGrid key or SMTP connection |

### Email Providers

```
EmailService
  |
  +-- SendGrid (primary, when SENDGRID_API_KEY configured)
  |     Uses: @sendgrid/mail
  |
  +-- SMTP (fallback)
  |     Uses: nodemailer
  |
  +-- None (logs warning, returns false)
```

### Email Templates

All templates are inline HTML with embedded CSS. Templates include:
- Branded header with appropriate colour (blue for receipts, green for assignments, red for reminders)
- Structured content with reference numbers and dates
- Plaintext fallback for email clients that do not render HTML
- Footer with year-appropriate copyright

### Data Types

```typescript
interface SubmissionReceiptData {
  applicant_name: string;
  application_reference: string;
  call_name: string;
  submitted_at: Date;
}

interface AssessorAssignmentData {
  assessor_name: string;
  call_name: string;
  application_count: number;
  due_at?: Date;
  login_url: string;
}

interface ReminderData {
  assessor_name: string;
  call_name: string;
  outstanding_count: number;
  due_at?: Date;
  login_url: string;
}
```

**Source:** `/backend/src/types/index.ts` (lines 575-596)

### Gaps

1. **Submission receipt not wired** -- `sendSubmissionReceipt()` is never called from the application submission flow
2. **No delivery tracking** -- `notification_logs` table is defined in the migration but not used
3. **No template externalisation** -- templates are inline; no admin-configurable templates
4. **Bulk assignment notifications missing** -- bulk round-robin assignment does not send emails

---

## 4. Export Service (Infrastructure Service)

**File:** `/backend/src/services/export.service.ts`
**Type:** Infrastructure Service -- generates downloadable exports in CSV and XLSX formats.

### Responsibilities

1. **Application metadata export** -- CSV or XLSX of application data for a call
2. **Master results export** -- Multi-sheet XLSX with summary, results, and assessor detail sheets
3. **Generic CSV generation** -- utility functions for arbitrary data

### Methods

| Method | Lines | Description |
|--------|-------|-------------|
| `exportApplicationsToXlsx(applications, callName)` | 15-83 | XLSX with styled headers, auto-filter, and formatted dates |
| `exportApplicationsToCsv(applications, callName)` | 88-127 | RFC 4180 compliant CSV with proper quoting |
| `exportMasterResultsToXlsx(results)` | 132-309 | 3-sheet workbook: Summary, Results (with dynamic criterion columns), Assessor Details |
| `exportApplications(applications, callName, options)` | 315-324 | Router: delegates to CSV or XLSX based on format option |

### XLSX Features

- **ExcelJS** library for workbook generation
- Styled header rows (blue background, white bold text)
- Auto-filter on all columns
- Conditional formatting for high-variance cells (red background)
- Dynamic column generation based on call criteria
- Date formatting using `formatDate()` helper

### Export Types

```typescript
interface ExportOptions {
  format: 'csv' | 'xlsx';
  columns?: string[];       // Column selection (not yet implemented)
  include_scores?: boolean;  // Score inclusion (not yet implemented)
  include_comments?: boolean; // Comment inclusion (not yet implemented)
}

interface ExportResult {
  filename: string;      // e.g., "Innovation_Fund_applications_20260215.xlsx"
  content_type: string;  // MIME type
  buffer: Buffer;        // File content
}
```

---

## 5. AI Service (Application Service)

**File:** `/backend/src/ai/ai.service.ts` (referenced from services index)
**Type:** Application Service -- provides AI-powered features.

### Exported Features (from `/backend/src/services/index.ts`)

| Function | Description |
|----------|-------------|
| `summarizeApplication` | AI-generated application summary |
| `generateBriefSummary` | Short summary generation |
| `extractThemes` | Theme extraction from applications |
| `comparativeAnalysis` | Cross-application comparison |
| `generateScoringSuggestions` | AI scoring suggestions |
| `suggestCriterionScore` | Per-criterion score suggestion |
| `analyzeScoreConsistency` | Score consistency analysis |
| `suggestFeedback` | Feedback generation |
| `detectScoringAnomalies` | Anomaly detection in scores |
| `detectApplicationAnomalies` | Anomaly detection in applications |
| `findSimilarApplications` | Similarity search |
| `indexApplication` | Application indexing for search |
| `removeFromIndex` | Remove from search index |
| `batchIndexApplications` | Bulk indexing |
| `getIndexStats` | Index statistics |
| `clearIndex` | Clear search index |

These features are exported from `/backend/src/ai/features.ts` and represent an optional enhancement layer on top of the core domain.

---

## 6. Application Services (Controllers)

Controllers serve as application services, orchestrating domain operations with infrastructure concerns.

### Auth Controller

**File:** `/backend/src/controllers/auth.controller.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `register` | POST | User registration with validation, duplicate check, audit logging, token generation |
| `login` | POST | Authentication with password verification, account status check, login tracking |
| `logout` | POST | Session termination with audit logging |
| `getProfile` | GET | Current user profile retrieval |
| `updateProfile` | PATCH | Profile update with field whitelisting |
| `changePassword` | POST | Password change with current password verification |
| `refreshAccessToken` | POST | JWT token refresh |

### Calls Controller

**File:** `/backend/src/controllers/calls.controller.ts`

Orchestrates: `FundingCallModel`, validation schemas, audit middleware, `UserModel` (for assessor verification).

### Applications Controller

**File:** `/backend/src/controllers/applications.controller.ts`

Orchestrates: direct pool queries, `fileService` (uploads, downloads, archives), audit logging.

### Assessments Controller

**File:** `/backend/src/controllers/assessments.controller.ts`

Orchestrates: direct pool queries, `scoringService` (score breakdown), audit logging.

### Assignments Controller

**File:** `/backend/src/controllers/assignments.controller.ts`

Orchestrates: direct pool queries, `emailService` (notifications, reminders), audit logging.

### Results Controller

**File:** `/backend/src/controllers/results.controller.ts`

Orchestrates: direct pool queries, `scoringService` (breakdown), `exportService` (CSV/XLSX).

---

## 7. Service Dependency Graph

```
Controllers (Application Services)
  |
  +-- FundingCallModel ----+
  +-- ApplicationModel     |
  +-- AssessmentModel      +-- query() / pool ---> PostgreSQL
  +-- AssignmentModel      |
  +-- UserModel            |
  +-- AuditLogModel -------+
  |
  +-- ScoringService (Domain Service)
  |     +-- FundingCallModel
  |     +-- ApplicationModel
  |     +-- AssessmentModel
  |     +-- query()
  |     +-- calculateAverage, calculateVariance, etc. (helpers)
  |
  +-- FileService (Infrastructure)
  |     +-- @aws-sdk/client-s3 or fs (storage)
  |     +-- archiver (ZIP)
  |
  +-- EmailService (Infrastructure)
  |     +-- @sendgrid/mail or nodemailer
  |
  +-- ExportService (Infrastructure)
  |     +-- exceljs
  |
  +-- AIService (Optional Application Service)
        +-- External AI provider
```

---

## 8. Service Gaps and Recommendations

| Gap | Current State | Recommendation |
|-----|--------------|----------------|
| Submission receipt email | `EmailService.sendSubmissionReceipt()` exists but is not called | Wire into submission flow in `ApplicationModel.submit()` or controller |
| Bulk assignment notifications | `EmailService.sendAssessorAssignment()` exists but bulk assign does not call it | Add notification loop after bulk assignment |
| Virus scanning | Stub returning `CLEAN` | Integrate ClamAV daemon or cloud scanning API |
| Notification tracking | `notification_logs` table defined but unused | Create `NotificationLogModel` and record all email sends |
| Duplicate computation paths | `ScoringService` and `resultsController` both compute results independently | Consolidate all results computation into `ScoringService` |
| File integrity | `file_hash` column exists but is never populated | Compute SHA-256 hash on upload in `FileService` |
| Session management | `sessions` table exists but JWT-only auth is used | Either use sessions table for token tracking or remove from schema |
| Event bus | No domain events; all side effects are inline | Introduce in-process event emitter for decoupled side effects |
