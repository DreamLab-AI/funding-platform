# ADR-003: Backend Framework Selection

## Status
Accepted

## Context
The backend must serve a REST API for the React frontend, handle file uploads up to 50MB, enforce server-side deadline logic, manage role-based access control across four user roles, send transactional emails, interface with virus scanning, generate CSV/XLSX exports, and maintain an immutable audit log. The PRD specifies Node.js/Express or Python/FastAPI as technology recommendations (Section 8.2).

## Decision
We use **Node.js** with **Express 4** and **TypeScript** for the backend application.

Supporting libraries:
- **Zod**: Runtime request validation schemas (see `backend/src/routes/calls.routes.ts`, `assessments.routes.ts`, `assignments.routes.ts`).
- **Multer**: Multipart file upload handling (see `backend/src/middleware/upload.middleware.ts`).
- **Helmet**: Security headers (see `backend/src/app.ts` lines 24-34).
- **express-rate-limit**: Rate limiting at 100 requests per 15 minutes for general API, with stricter limits for auth endpoints (see `backend/src/config/security.ts` RATE_LIMIT_CONFIG).
- **morgan**: HTTP request logging.
- **compression**: Response compression.
- **cors**: Cross-origin resource sharing with configurable origins.

Architecture layers (all under `backend/src/`):
1. **Routes**: HTTP endpoint definitions with Zod validation and RBAC middleware.
2. **Controllers**: Request/response handling, delegation to services.
3. **Services**: Business logic (ScoringService, FileService, EmailService, ExportService).
4. **Security**: Cross-cutting concerns (JWTService, RBACService, AuditService, PasswordService, SanitizeService, CSRFService).
5. **Models**: Database access layer with typed query interfaces.
6. **Middleware**: auth, rbac, audit, validation, upload, error handling, rate limiting, CORS, helmet.
7. **Config**: Environment-driven configuration with typed interfaces (`backend/src/config/index.ts`).

## Consequences

### Positive
- Shared language (TypeScript) between frontend and backend reduces context-switching and enables shared type definitions.
- Express is the most mature Node.js framework with the largest middleware ecosystem.
- Non-blocking I/O handles concurrent file uploads and database queries efficiently for the expected load (NFR-002: 100+ concurrent users).
- Strong typing via TypeScript catches API contract mismatches at compile time.

### Negative
- Single-threaded event loop requires careful handling of CPU-intensive operations (ZIP generation, XLSX export). Mitigation: async operations with streaming where possible.
- Error handling in Express requires explicit middleware chaining (see `backend/src/middleware/error.middleware.ts` for the global error handler pattern).
- No built-in dependency injection container. Services are currently exported as singletons with proxy objects for method aliasing.

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **Python/FastAPI** | Excellent performance and auto-generated OpenAPI docs, but introduces a second language in the stack. TypeScript sharing between frontend and backend was prioritized. |
| **NestJS** | Provides dependency injection, decorators, and opinionated structure, but adds abstraction overhead and learning curve for the team. Express is sufficient for v1 complexity. |
| **Fastify** | Better raw performance than Express, but smaller middleware ecosystem and less community documentation for security patterns. |
| **Hono** | Lightweight and fast, but too new for production use in a government-adjacent platform where stability and community support matter. |
