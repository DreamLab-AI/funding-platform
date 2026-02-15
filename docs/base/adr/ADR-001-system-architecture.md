# ADR-001: System Architecture

## Status
Accepted

## Context
The Funding Application Submission & Assessment Platform requires a system architecture that supports multiple user roles (Applicant, Assessor, Coordinator, Scheme Owner), concurrent funding calls, file uploads, structured scoring, and aggregated results. The team is small, the timeline is constrained, and the expected load is moderate (hundreds to low thousands of applications per call, ~100 concurrent users at peak).

A decision was needed on whether to adopt a monolithic architecture, a modular monolith, or a microservices architecture.

## Decision
We adopt a **modular monolith** architecture using a single deployable unit with logically separated modules following Domain-Driven Design bounded contexts.

The system is structured as three tiers:
- **Client Layer**: React SPA served via Vite, communicating over REST.
- **API Layer**: Node.js + Express application with route-level separation into modules (calls, applications, assessments, assignments, results, auth, ai, nostr).
- **Data Layer**: PostgreSQL 15 as the primary data store, S3-compatible object storage for files, optional Redis for sessions.

Code path evidence:
- Entry point: `backend/src/app.ts` registers all route modules under `/api/v1/`.
- Route modules: `backend/src/routes/calls.routes.ts`, `applications.routes.ts`, `assessments.routes.ts`, `assignments.routes.ts`, `results.routes.ts`.
- Model layer: `backend/src/models/` contains separate model files per aggregate (user, fundingCall, application, assessment, auditLog).
- Service layer: `backend/src/services/` contains scoring, file, email, and export services.
- Security layer: `backend/src/security/` contains jwt, rbac, audit, password, sanitize, and csrf services.

## Consequences

### Positive
- **Simplicity**: Single deployment unit reduces operational complexity, infrastructure cost, and debugging overhead.
- **Fast iteration**: All modules share a process, enabling synchronous service calls and avoiding distributed transaction problems.
- **Clear boundaries**: Route, controller, service, and model layers enforce separation of concerns within the monolith.
- **Team fit**: A small team can own the entire codebase without inter-team coordination overhead.

### Negative
- **Scaling granularity**: Cannot independently scale heavy workloads (e.g., file scanning, export generation) without extracting them into separate processes in the future.
- **Deployment coupling**: A change to any module requires redeploying the entire application.
- **Risk of entanglement**: Without discipline, domain boundaries can erode over time, increasing coupling.

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **Microservices** | Over-engineered for the expected load and team size. Introduces distributed systems complexity (service discovery, eventual consistency, network latency) that is not justified for v1. |
| **Serverless (Lambda/Functions)** | Cold start latency conflicts with NFR-001 (<3s page loads). File upload and ZIP generation workflows exceed typical function execution limits. PostgreSQL connection pooling is more complex in serverless. |
| **Modular monolith with event bus** | Considered but deferred to v2. The current codebase uses direct service calls, which is sufficient for v1 throughput requirements. Domain events are documented in the PRD (Appendix B.5) for future adoption. |
