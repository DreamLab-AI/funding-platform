# ADR-006: Authentication and Authorisation

## Status
Accepted

## Context
The platform requires robust authentication for four user roles (Applicant, Assessor, Coordinator, Scheme Owner) with strict access control boundaries. Key requirements from PRD 12.1: email/password authentication with strong password policy, RBAC enforced server-side on all API endpoints, 30-minute session timeout, and optional MFA for coordinator and assessor roles. Additionally, the platform implements Nostr-based decentralized identity (DID) as a supplementary authentication mechanism.

## Decision
We implement a **multi-layer authentication and authorization system** combining JWT tokens with refresh token rotation, server-side RBAC with fine-grained permissions, and Nostr DID integration.

### Authentication Layer

**JWT Service** (`backend/src/security/jwt.service.ts`):
- Access tokens: HS256-signed, 15 minutes expiry in production (1 hour in development), containing user ID, email, role, and permissions array.
- Refresh tokens: Separate secret, 7-day expiry, with token family tracking for rotation detection.
- Token rotation: Each refresh generates a new token pair in the same family. Family limited to 5 rotations before forced re-authentication (theft detection).
- Token revocation: In-memory revocation set (production should use Redis).
- Timing-safe signature comparison to prevent timing attacks.
- Claims include iss, aud, jti, and sessionId for comprehensive validation.

**Password Policy** (`backend/src/config/security.ts`):
- Minimum 12 characters, maximum 128
- Requires uppercase, lowercase, numbers, and special characters
- Prevents reuse of last 5 passwords
- 90-day maximum age
- Bcrypt hashing with 12 salt rounds in production

**Account Security:**
- Account lockout after 5 failed attempts, 15-minute lockout duration (`LOCKOUT_CONFIG`)
- Failed attempts reset after 1 hour of no failures
- Login/logout events logged to audit trail

### Authorization Layer

**RBAC Service** (`backend/src/security/rbac.service.ts`):
- 30+ granular permissions mapped to 4 roles
- Applicant: CRUD own applications, submit, withdraw, GDPR export/delete
- Assessor: Create/read/update/submit own assessments, read assigned applications only
- Coordinator: Full application access, call management, assessor pool management, master results access, user management, audit read
- Scheme Owner: Read-only overview (calls, applications, assessments, master results, audit)
- Resource ownership checks: `canAccessApplication()`, `canAccessAssessment()`, `canAccessMasterResults()` enforce PRD isolation requirements
- Permission scope creation for query filtering (`createPermissionScope()`)

**Nostr DID Integration** (`database/migrations/003_user_identities.sql`, `backend/src/auth/`):
- NIP-01: Basic event signing for authentication
- NIP-05: DNS-based identity verification
- NIP-07: Browser extension integration (e.g., nos2x, Alby)
- NIP-19: Bech32 encoding for public display (npub)
- NIP-98: HTTP Auth header support
- DID format: `did:nostr:<64-char-hex-pubkey>`
- Challenge-response authentication with 5-minute expiry
- Auth tracking: first_auth_at, last_auth_at, auth_count per identity

### Route-Level Enforcement

All protected routes apply middleware chain: `authenticate` -> `requireRoles(...)` -> handler.

Evidence from route files:
- `calls.routes.ts`: Public `/open` endpoint, coordinator-only for CRUD, assessor read access to criteria
- `applications.routes.ts`: Applicant creates/submits own, coordinator lists/exports all, assessor views assigned only
- `assessments.routes.ts`: Assessor submits scores for own assignments, coordinator lists and returns
- `assignments.routes.ts`: Coordinator-only for all assignment operations
- `results.routes.ts`: Coordinator-only for master results, with demo route for development

## Consequences

### Positive
- Defense in depth: authentication at middleware level, authorization at route level, resource ownership at service level, constraints at database level.
- Token rotation with family tracking provides proactive theft detection.
- Nostr DID provides a decentralized identity option that does not depend on external identity providers.
- Permissions are granular enough to support future role customization without code changes.

### Negative
- In-memory token revocation does not survive process restarts. Production requires Redis or database-backed revocation.
- The permission model adds complexity to testing (each role combination must be verified).
- Nostr DID adds an additional authentication flow that must be maintained alongside email/password.
- No SSO/SAML integration yet (PRD 12.1 lists it as optional).

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **Session-based auth (server-side sessions with cookies)** | Requires sticky sessions or centralized session store for multi-instance deployment. JWT is stateless and scales more easily. |
| **OAuth 2.0 / OpenID Connect** | Adds external dependency on an identity provider. Suitable for v2 when SSO integration is needed, but over-engineered for v1 where email/password is the primary flow. |
| **Passport.js** | Express middleware library that abstracts auth strategies. Rejected in favor of custom JWT implementation for full control over token lifecycle, rotation, and revocation logic. |
