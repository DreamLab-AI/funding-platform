# ADR-005: File Storage Strategy

## Status
Accepted

## Context
Applicants upload application forms and supporting documents (PDF, DOCX, images, videos) up to 50MB per file (NFR-004). Coordinators must be able to download individual application packs as ZIP files and optionally bulk-download all files for a call (FR-022). Files must be scanned for viruses before storage (FR-011). Files must be encrypted at rest (PRD 12.2).

## Decision
We use a **dual-mode file storage strategy**: AWS S3 for production deployments with automatic fallback to local filesystem storage for development and testing.

Implementation: `backend/src/services/file.service.ts`

**S3 mode** (when AWS credentials are configured):
- Files uploaded via `PutObjectCommand` with original filename stored in S3 metadata.
- Downloads use `GetObjectCommand` with streaming response.
- Pre-signed URLs generated via `@aws-sdk/s3-request-presigner` for secure time-limited downloads (default 1 hour expiry).
- Region configured to `eu-west-2` (London) by default, supporting UK/EU hosting requirement (PRD 15.3).

**Local mode** (fallback when no S3 credentials):
- Files stored under `{project_root}/uploads/` directory, created automatically.
- Organized into subdirectories by upload context.
- API-based download URLs returned instead of pre-signed URLs.

**Common features across both modes:**
- Unique filenames generated via `generateUniqueFilename()` utility to prevent collisions.
- ZIP archive generation using `archiver` library with zlib level 9 compression.
- Application-specific ZIP creation via `createApplicationZip()`.
- File existence checking and metadata retrieval.
- Graceful deletion (non-throwing when file already absent).

**File metadata tracked in database** (`application_files` table):
- `filename`: System-generated unique name
- `original_filename`: User-provided name for display/download
- `file_path`: Storage location (S3 key or local path)
- `file_size`: Bytes (constrained to 0-50MB at database level)
- `mime_type`: Validated MIME type
- `file_hash`: SHA-256 for integrity verification
- `scan_status`: Virus scan state (pending/scanning/clean/infected/error)
- `is_primary`: Distinguishes main application form from supporting documents
- `category`: Document type classification

## Consequences

### Positive
- S3 provides automatic encryption at rest (AES-256), versioning, and lifecycle management without custom implementation.
- Dual-mode approach enables local development without AWS credentials.
- Pre-signed URLs offload file download bandwidth from the application server.
- ZIP generation is handled in-memory with streaming, avoiding disk space issues.

### Negative
- Local storage mode lacks encryption at rest. Development environments should not contain real applicant data.
- The dual-mode abstraction means some S3-specific features (versioning, lifecycle policies) are not available in local mode.
- Large bulk ZIP operations (hundreds of files) may consume significant memory. A streaming approach with temporary files would be needed for very large calls.

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **Azure Blob Storage** | Equally viable, but S3 has broader tooling support and the team has existing AWS experience. The abstraction layer could be extended to support Azure. |
| **MinIO (self-hosted S3-compatible)** | Good for on-premise deployments, but adds operational overhead. Could be used as a drop-in S3 replacement if needed. |
| **Database BLOB storage** | Poor performance for large files, increases backup size, and complicates database maintenance. |
