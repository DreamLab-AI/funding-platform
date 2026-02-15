# ADR-015: Session Management

## Status
Accepted

## Context
PRD 12.1 requires session tokens with a 30-minute inactivity timeout. The platform must support secure session handling across multiple user roles, including the ability to revoke sessions for security incidents.

## Decision
We implement **JWT-based session management** with refresh token rotation and database-backed session tracking.

### Token Architecture

**Access tokens** (short-lived):
- Expiry: 15 minutes in production, 1 hour in development
- Contains: userId, email, role, permissions array, sessionId
- Signed with HS256 using a dedicated access token secret
- Stateless verification (no database lookup required for validation)

**Refresh tokens** (long-lived):
- Expiry: 7 days
- Contains: userId, token family ID
- Signed with a separate refresh token secret
- Family-based rotation tracking (max 5 rotations per family)

**Token pair lifecycle:**
1. Login produces an access token + refresh token pair
2. Access token used for all API requests via `Authorization: Bearer` header
3. When access token expires, client sends refresh token to get a new pair
4. Old refresh token is revoked; new pair shares the same family ID
5. If a refresh token is reused (possible theft), the entire family is invalidated

### Session Configuration

Defined in `backend/src/config/security.ts` (`SESSION_CONFIG`):
- `inactivityTimeout`: 30 minutes (1,800,000ms) per PRD 12.1
- `absoluteTimeout`: 12 hours maximum session duration
- `extendOnActivity`: true (each request resets the inactivity timer)
- `cookieName`: 'funding_session'
- `secure`: true in production (HTTPS only)
- `sameSite`: 'strict'
- `httpOnly`: true (not accessible via JavaScript)

### Database Session Tracking

**Sessions table** (`database/migrations/001_initial_schema.sql`):
- `id` (UUID PK)
- `user_id` (FK to users, CASCADE delete)
- `token_hash` (SHA-256 of session token, UNIQUE)
- `ip_address`, `user_agent` (for security monitoring)
- `created_at`, `expires_at`, `last_activity_at`
- `revoked_at` (for explicit revocation)

**Indexes:**
- `idx_sessions_user_id`: User session lookup
- `idx_sessions_token`: Token-based authentication
- `idx_sessions_expires`: Active session cleanup (WHERE revoked_at IS NULL)

### Security Measures

- **Timing-safe comparison** for token signature verification (`crypto.timingSafeEqual`)
- **Token family limits** prevent unlimited refresh cycles (theft detection)
- **Per-user revocation**: `revokeAllUserTokens()` invalidates all sessions for password change, account lockout
- **Family revocation**: `revokeTokenFamily()` invalidates a specific token chain
- **Proactive refresh**: `isTokenExpiringSoon()` checks if token expires within 5 minutes for UX-driven refresh
- **Account lockout**: After 5 failed login attempts, account locked for 15 minutes

### Authentication Middleware

`backend/src/middleware/auth.middleware.ts` extracts the Bearer token, verifies it using the JWT service, and attaches the user context to the request.

## Consequences

### Positive
- JWT stateless verification reduces database load for read-heavy API requests.
- Refresh token rotation provides defense against token theft.
- Database session tracking enables admin-initiated session revocation.
- The 30-minute inactivity timeout meets PRD compliance requirements.
- HttpOnly, Secure, SameSite=Strict cookie settings prevent XSS and CSRF attacks on session tokens.

### Negative
- **GAP: Token revocation is currently in-memory** (Set/Map). Production requires Redis or database-backed revocation storage that survives restarts.
- The 15-minute access token lifetime means the frontend must implement transparent refresh logic. A failing refresh should redirect to login.
- JWT tokens cannot be truly "revoked" without checking a revocation list. The in-memory set approach works for a single-instance deployment but needs a shared store for multiple instances.

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **Server-side session with Redis** | Requires a database lookup for every request. JWT stateless verification is more performant for the expected request volume. Redis can be added alongside JWT for revocation tracking. |
| **OAuth 2.0 with external IdP** | Adds complexity and external dependency. Suitable for v2 when SSO is needed. |
| **Opaque tokens with database lookup** | Simpler to implement revocation, but every API request requires a database query. JWT with selective revocation checking is a better tradeoff. |
