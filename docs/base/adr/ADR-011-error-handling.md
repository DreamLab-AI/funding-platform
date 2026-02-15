# ADR-011: Error Handling Strategy

## Status
Accepted

## Context
The platform must provide clear, consistent error responses across all API endpoints while preventing information leakage in production. Errors can originate from validation, authentication, authorization, business logic, external services, or unexpected system failures.

## Decision
We implement a **hierarchical error class system** with a global error handler middleware that maps errors to structured API responses.

### Error Class Hierarchy

Defined in `backend/src/utils/errors.ts`:

| Error Class | HTTP Status | Error Code | Use Case |
|---|---|---|---|
| `AppError` (base) | 500 | `INTERNAL_ERROR` | Base class for all operational errors |
| `ValidationError` | 400 | `VALIDATION_ERROR` | Invalid input data, missing required fields |
| `AuthenticationError` | 401 | `AUTHENTICATION_ERROR` | Missing or invalid authentication credentials |
| `AuthorizationError` | 403 | `AUTHORIZATION_ERROR` | Insufficient permissions for the requested action |
| `NotFoundError` | 404 | `NOT_FOUND` | Resource not found (includes resource type and ID) |
| `ConflictError` | 409 | `CONFLICT` | Duplicate resource or state conflict |
| `DeadlinePassedError` | 400 | `DEADLINE_PASSED` | Submission attempted after call close date |
| `FileTooLargeError` | 400 | `FILE_TOO_LARGE` | File exceeds maximum size limit |
| `InvalidFileTypeError` | 400 | `INVALID_FILE_TYPE` | File type not in allowed list |
| `RateLimitError` | 429 | `RATE_LIMIT_EXCEEDED` | Too many requests (includes retryAfter) |
| `DatabaseError` | 500 | `DATABASE_ERROR` | Database operation failure |
| `ExternalServiceError` | 502 | `EXTERNAL_SERVICE_ERROR` | S3, email, or virus scanning failure |

Key design properties:
- `isOperational`: Distinguishes expected business errors (true) from unexpected system errors (false). Operational errors are logged at WARN level, system errors at ERROR level.
- `details`: Optional additional context (e.g., validation errors array, retryAfter seconds).
- `code`: Machine-readable error code for frontend handling.

### Global Error Handler

Defined in `backend/src/middleware/error.middleware.ts`:

1. **Classification**: Determines if the error is an `AppError` (operational) or unexpected.
2. **Logging**: Operational errors logged with code, message, status, path, method. Unexpected errors logged with full stack trace.
3. **Response construction**: Maps to the standard `ApiResponse<null>` envelope with error code, message, and optional details.
4. **Production safety**: In production, unexpected errors return generic message and no details. Only `AppError` instances expose their message.
5. **Special cases**: JSON parse errors (`SyntaxError` with `body` property) mapped to 400 `INVALID_JSON`. Multer errors mapped to 400 `UPLOAD_ERROR`.

### Async Error Handling

`asyncHandler()` wrapper (in `error.middleware.ts`) catches rejected promises from async route handlers and passes them to Express error middleware, preventing unhandled promise rejections.

### Request Timeout

`timeoutHandler()` middleware returns 408 `REQUEST_TIMEOUT` if response exceeds configurable timeout (default 30 seconds).

### Utility Functions

- `isAppError()`: Type guard for checking if an unknown error is an AppError.
- `handleError()`: Wraps any unknown error value into an AppError for consistent handling.

## Consequences

### Positive
- Every error type in the domain has a dedicated class with appropriate HTTP status and machine-readable code.
- Frontend can switch on `error.code` for localized error messages.
- Production environments never leak stack traces or internal details.
- The `DeadlinePassedError` and file-related errors directly model PRD business rules.

### Negative
- The error hierarchy may grow as new business rules are added. Consider grouping related errors.
- Custom error classes are not serialized back to their original type across process boundaries (relevant if the system becomes distributed).

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **HTTP status codes only** | Insufficient granularity. Multiple different errors map to 400, and the frontend needs machine-readable codes to distinguish them. |
| **Problem Details (RFC 7807)** | A standard JSON error format. Good practice, but the custom envelope format was already in use and provides the same information. Could be adopted in v2. |
| **Error middleware per route** | Would lead to duplicated error handling logic. A centralized handler is more maintainable. |
