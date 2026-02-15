# ADR-013: File Upload Validation

## Status
Accepted

## Context
Applicants upload application forms and supporting documents as part of their submissions. PRD FR-011 requires file type validation, file size validation, and virus scanning. NFR-004 sets a maximum file size of 50MB. FR-002 allows coordinators to configure allowed file types per call.

## Decision
We implement **multi-layer file validation** spanning middleware, configuration, database constraints, and service-level checks.

### Middleware Layer

**Multer configuration** (`backend/src/middleware/upload.middleware.ts`):
- Handles multipart/form-data file uploads.
- `uploadMultiple` middleware applied to `POST /api/v1/applications/:id/files`.

**File validation middleware** (`backend/src/middleware/validateFile.middleware.ts`):
- Validates MIME type against allowed list.
- Validates file size against maximum limit.

### Configuration Layer

**Global defaults** (`backend/src/config/security.ts` - `FILE_UPLOAD_CONFIG`):
- `maxFileSize`: 50MB (52,428,800 bytes)
- `maxFiles`: 10 per request
- Allowed MIME types: application/pdf, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document (DOCX), application/vnd.ms-excel (XLS), application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (XLSX), application/vnd.ms-powerpoint (PPT), application/vnd.openxmlformats-officedocument.presentationml.presentation (PPTX), image/jpeg, image/png, image/gif, video/mp4, video/quicktime, application/zip
- Allowed extensions: .pdf, .doc, .docx, .xls, .xlsx, .ppt, .pptx, .jpg, .jpeg, .png, .gif, .mp4, .mov, .zip

**Per-call configuration** (`funding_calls.requirements` JSONB):
- Coordinators can restrict allowed file types per call via `allowedFileTypes` array.
- Per-call maximum file size via `maxFileSize`.
- The application validates against the more restrictive of global and per-call limits.

### Error Handling

Custom error classes for file validation failures:
- `FileTooLargeError` (400): "File exceeds maximum size limit of 50MB"
- `InvalidFileTypeError` (400): "Invalid file type. Allowed types: ..."

### Database Constraints

`application_files_size_check` constraint enforces `file_size > 0 AND file_size <= 52428800` at the database level as a final safety net.

### File Metadata Storage

Each uploaded file creates an `application_files` record with:
- `filename`: System-generated unique name (prevents path traversal and collisions)
- `original_filename`: Preserved for display and download
- `file_path`: Storage location
- `file_size`: Actual bytes
- `mime_type`: Validated MIME type
- `file_hash`: SHA-256 hash for integrity verification
- `scan_status`: Virus scan state
- `is_primary`: Boolean to distinguish main application form from supporting documents
- `category`: Semantic document type (e.g., 'application_form', 'pitch_deck', 'support_letter')

### Upload Flow

1. Client sends multipart/form-data with one or more files.
2. Multer middleware receives files into memory/temp storage.
3. Validation middleware checks MIME type and file size against global and call-specific limits.
4. FileService generates unique filename and stores file (S3 or local).
5. SHA-256 hash computed for integrity.
6. Database record created with `scan_status = 'pending'`.
7. Virus scan triggered (currently stub - see ADR-008).
8. Response includes file metadata.

## Consequences

### Positive
- Defense in depth: middleware validates before processing, database constrains after storage.
- Per-call configuration gives coordinators flexibility without code changes.
- Unique filename generation prevents path traversal and filename collision attacks.
- SHA-256 hashing enables integrity verification for compliance.

### Negative
- MIME type validation based on Content-Type header can be spoofed. Magic byte validation should be added for production (check actual file bytes against expected format).
- Files are stored before virus scanning completes. Infected files may exist briefly in storage. A quarantine workflow should be implemented.
- The 50MB limit applies per file, not per application. An applicant could upload 10 x 50MB = 500MB per application.

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **Client-side only validation** | Insufficient. File type and size must be validated server-side as the client cannot be trusted. Client-side validation is added for UX but is not a security boundary. |
| **Streaming upload to S3 with Lambda trigger** | More architecturally clean for virus scanning, but adds AWS Lambda dependency and does not work in local storage mode. |
| **Chunked upload with resumption** | Good for large files, but adds complexity. The 50MB limit is within browser upload capability without chunking. Could be added for v2 if video uploads become common. |
