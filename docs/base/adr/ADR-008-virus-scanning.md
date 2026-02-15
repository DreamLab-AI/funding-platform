# ADR-008: Virus Scanning Approach

## Status
Accepted (partial implementation)

## Context
All uploaded files must be scanned for viruses before storage (FR-011, AC-12). The PRD specifies ClamAV or a cloud scanning service as options (Section 8.2, 13.1). Files are uploaded by applicants who may be using compromised machines.

## Decision
We define a **virus scanning interface** in the file service with ClamAV as the intended production implementation, currently using a simulated scan for development.

Implementation: `backend/src/services/file.service.ts` method `scanFile()`.

**Current state (stub):**
- Returns `FileScanStatus.CLEAN` after a 100ms simulated delay.
- Logs "Virus scan requested (simulated)" to the logger.
- Marked with `// TODO: Implement actual virus scanning`.

**Intended production implementation:**
- ClamAV daemon (`clamd`) running alongside the application.
- Files scanned via `clamdscan` command or `clamscan` library.
- Scan timeout of 30 seconds (`FILE_UPLOAD_CONFIG.virusScan.timeout` in `backend/src/config/security.ts`).
- Infected files moved to quarantine path (`/tmp/quarantine`).
- Virus scanning enabled only in production (`FILE_UPLOAD_CONFIG.virusScan.enabled`).

**Database support:**
- `application_files.scan_status` enum: `pending`, `scanning`, `clean`, `infected`, `error`
- `application_files.scanned_at` timestamp
- `application_files.scan_result` text field for detailed results when infected
- Partial indexes on pending scans (`idx_files_pending_scan`) for efficient scanner queue processing

**File upload flow:**
1. File received by Multer middleware
2. File type and size validated
3. File stored with `scan_status = 'pending'`
4. Scan triggered (currently stub)
5. Status updated based on scan result
6. Infected files should be quarantined and the upload rejected

## Consequences

### Positive
- The database schema and file service interface are ready for ClamAV integration.
- The scan status tracking enables asynchronous scanning workflows.
- Quarantine path is configurable for different deployment environments.

### Negative
- **GAP: Virus scanning is not implemented.** The current stub always returns CLEAN. This must be addressed before production deployment.
- **GAP: Files with pending scan status are not blocked from being accessed.** A guard should prevent downloading files that have not been scanned clean.
- No cloud scanning alternative is implemented (e.g., VirusTotal API, AWS GuardDuty for S3).

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **Cloud-based scanning API (VirusTotal)** | Sends files to external servers, raising data sovereignty concerns for UK government data. ClamAV runs locally. |
| **AWS S3 Object Lambda with GuardDuty** | Viable for S3-hosted files, but ties scanning to AWS infrastructure and does not work in local storage mode. |
| **Block uploads entirely until scan completes** | Synchronous scanning would add 5-30 seconds to every upload, degrading UX. Asynchronous scanning with status tracking is preferred. |
