# ADR-010: API Design Standards

## Status
Accepted

## Context
The platform exposes a REST API consumed by the React SPA frontend. PRD Section 13.2 specifies REST with OpenAPI 3.0, versioned endpoints, standard HTTP methods, JSON request/response bodies, consistent error format, rate limiting, and API keys for service-to-service communication.

## Decision
We implement a **versioned REST API** under the `/api/v1/` prefix with consistent request/response patterns, Zod-based validation, and structured error responses.

### URL Structure

Base: `/api/v1/`

**Calls**: `/api/v1/calls`
- `GET /open` - Public: list open calls
- `GET /:id/public` - Public: call details
- `GET /demo` - Development: list all calls without auth
- `POST /` - Coordinator: create call
- `GET /` - Coordinator: list all calls
- `GET /:id` - Coordinator/Assessor: get call by ID
- `PUT /:id` - Coordinator: update call
- `DELETE /:id` - Coordinator: delete call
- `POST /:id/open` - Coordinator: transition to open status
- `POST /:id/close` - Coordinator: transition to closed status
- `POST /:id/clone` - Coordinator: clone call configuration
- `GET /:id/assessors` - Coordinator: list assessor pool
- `POST /:id/assessors` - Coordinator: add assessor to pool
- `DELETE /:id/assessors/:assessorId` - Coordinator: remove assessor
- `GET /:id/criteria` - Coordinator/Assessor: get criteria
- `PUT /:id/criteria` - Coordinator: update criteria

**Applications**: `/api/v1/applications`
- `POST /` - Applicant: create application
- `GET /my` - Applicant: list own applications
- `GET /:id` - Applicant: get own application
- `PUT /:id` - Applicant: update draft
- `DELETE /:id` - Applicant: withdraw
- `POST /:id/files` - Applicant: upload files (multipart)
- `DELETE /:id/files/:fileId` - Applicant: remove file
- `GET /:id/files/:fileId/download` - Download file
- `POST /:id/confirmations` - Applicant: add confirmation
- `GET /:id/confirmations` - Get confirmations
- `POST /:id/submit` - Applicant: submit application
- `GET /` - Coordinator: list all applications
- `GET /call/:callId` - Coordinator: list by call
- `GET /export/:callId` - Coordinator: export metadata
- `GET /download/:callId` - Coordinator: download all files ZIP
- `POST /:id/reopen` - Coordinator: reopen submitted application
- `GET /assigned` - Assessor: list assigned applications
- `GET /:id/materials` - Assessor/Coordinator: view application materials

**Assessments**: `/api/v1/assessments`
- `GET /my` - Assessor: list own assessments
- `GET /assignment/:assignmentId` - Assessor: get assessment by assignment
- `POST /assignment/:assignmentId` - Assessor: create/save assessment
- `PUT /assignment/:assignmentId` - Assessor: update draft
- `POST /assignment/:assignmentId/submit` - Assessor: final submit
- `GET /` - Coordinator: list all assessments
- `GET /call/:callId` - Coordinator: list by call
- `GET /application/:applicationId` - Coordinator: list by application
- `POST /:id/return` - Coordinator: return for revision

**Assignments**: `/api/v1/assignments`
- `POST /` - Coordinator: assign single
- `POST /bulk` - Coordinator: bulk assign (round-robin/random/balanced)
- `GET /call/:callId` - Coordinator: list by call
- `GET /application/:applicationId` - Coordinator: list by application
- `GET /assessor/:assessorId` - Coordinator: list by assessor
- `DELETE /:id` - Coordinator: unassign
- `GET /progress/:callId` - Coordinator: overall progress
- `GET /progress/:callId/assessors` - Coordinator: progress by assessor
- `POST /remind/:id` - Coordinator: send individual reminder
- `POST /remind-bulk` - Coordinator: send bulk reminders

**Results**: `/api/v1/results`
- `GET /call/:callId` - Coordinator: master results
- `GET /call/:callId/summary` - Coordinator: summary statistics
- `GET /call/:callId/variance` - Coordinator: variance flags
- `GET /call/:callId/ranking` - Coordinator: ranked results
- `GET /call/:callId/export` - Coordinator: export XLSX
- `GET /call/:callId/export/detailed` - Coordinator: detailed export
- `GET /application/:applicationId` - Coordinator: individual results
- `GET /application/:applicationId/breakdown` - Coordinator: score breakdown
- `GET /call/:callId/analytics` - Coordinator: analytics
- `GET /call/:callId/distribution` - Coordinator: score distribution

**Auth**: `/api/v1/auth` (standard), `/api/v1/auth/nostr` (Nostr DID)
**AI**: `/api/v1/ai` (AI-assisted features)

### Response Format

Standard `ApiResponse<T>` envelope (defined in `backend/src/types/index.ts`):
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message",
    "details": { ... }
  }
}
```

### Validation

Zod schemas applied via `validate()` middleware on mutation endpoints. Examples in route files:
- `createCallSchema`: name (3-200 chars), description, datetime strings, requirements object, criteria array.
- `scoreSchema`: scores array (criterionId UUID, score >= 0, comment), overallComment, coiConfirmed boolean.
- `assignSchema`: applicationId UUID, assessorId UUID, optional dueAt.
- `bulkAssignSchema`: applicationIds array, assessorIds array, strategy enum, assessorsPerApplication.

## Consequences

### Positive
- Consistent URL structure grouped by domain entity makes the API discoverable.
- Zod validation provides both runtime checks and TypeScript type inference.
- Standard envelope format simplifies frontend error handling.
- Version prefix enables future API evolution without breaking existing clients.

### Negative
- **GAP: OpenAPI 3.0 specification document is not yet generated.** The route definitions exist but no Swagger/OpenAPI auto-generation is configured.
- Some endpoints use GET for operations that could arguably be POST (e.g., `/export/` endpoints that generate files).
- The demo routes (`/demo`) should be removed or gated before production.

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **GraphQL** | The platform has well-defined data shapes that map naturally to REST resources. GraphQL's query flexibility is not needed and would complicate RBAC enforcement. |
| **gRPC** | Binary protocol is not suitable for browser-based SPA consumption without a gateway. REST with JSON is more debuggable. |
| **JSON:API specification** | More opinionated than needed. The simple envelope format is sufficient for this application's complexity. |
