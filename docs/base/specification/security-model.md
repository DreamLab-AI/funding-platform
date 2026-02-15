# Security Model: Funding Application Submission & Assessment Platform

## 1. RBAC Permission Matrix

The following matrix shows the complete mapping of permissions to roles. Source: `backend/src/security/rbac.service.ts` and `backend/src/types/security.types.ts`.

### Application Permissions

| Permission | Applicant | Assessor | Coordinator | Scheme Owner |
|---|:---:|:---:|:---:|:---:|
| `application:create` | Y | - | - | - |
| `application:read:own` | Y | Y (assigned only) | - | - |
| `application:read:all` | - | - | Y | Y |
| `application:update:own` | Y | - | - | - |
| `application:delete:own` | Y | - | - | - |
| `application:submit` | Y | - | - | - |
| `application:withdraw` | Y | - | - | - |
| `application:reopen` | - | - | Y | - |
| `application:export` | - | - | Y | - |
| `application:download:files` | - | - | Y | - |

### Assessment Permissions

| Permission | Applicant | Assessor | Coordinator | Scheme Owner |
|---|:---:|:---:|:---:|:---:|
| `assessment:create` | - | Y | - | - |
| `assessment:read:own` | - | Y | - | - |
| `assessment:read:all` | - | - | Y | Y |
| `assessment:update:own` | - | Y | - | - |
| `assessment:submit` | - | Y | - | - |
| `assessment:return` | - | - | Y | - |

### Call Management Permissions

| Permission | Applicant | Assessor | Coordinator | Scheme Owner |
|---|:---:|:---:|:---:|:---:|
| `call:create` | - | - | Y | - |
| `call:read` | - | - | Y | Y |
| `call:update` | - | - | Y | - |
| `call:delete` | - | - | Y | - |
| `call:clone` | - | - | Y | - |
| `call:configure` | - | - | Y | - |

### Assessor Pool & Results Permissions

| Permission | Applicant | Assessor | Coordinator | Scheme Owner |
|---|:---:|:---:|:---:|:---:|
| `assessor_pool:manage` | - | - | Y | - |
| `assessor:assign` | - | - | Y | - |
| `assessor:remove` | - | - | Y | - |
| `results:view:master` | - | - | Y | Y |
| `results:export` | - | - | Y | Y |

### Administrative Permissions

| Permission | Applicant | Assessor | Coordinator | Scheme Owner |
|---|:---:|:---:|:---:|:---:|
| `user:create` | - | - | Y | - |
| `user:read` | - | - | Y | - |
| `user:update` | - | - | Y | - |
| `audit:read` | - | - | Y | Y |
| `gdpr:export:data` | Y | Y | Y | Y |
| `gdpr:delete:data` | Y | - | - | - |

---

## 2. Authentication Flows

### 2.1 Email/Password Authentication

```
Client                          Server                          Database
  |                               |                               |
  |-- POST /api/v1/auth/login --->|                               |
  |   { email, password }         |                               |
  |                               |-- Validate credentials ------>|
  |                               |   (bcrypt compare)            |
  |                               |                               |
  |                               |<-- User record + role --------|
  |                               |                               |
  |                               |-- Check account lockout       |
  |                               |-- Generate JWT access token   |
  |                               |   (15min, HS256, with role    |
  |                               |    + permissions + sessionId) |
  |                               |-- Generate refresh token      |
  |                               |   (7d, separate secret,       |
  |                               |    with family ID)            |
  |                               |-- Create session record ----->|
  |                               |-- Log audit event ----------->|
  |                               |                               |
  |<-- { accessToken,             |                               |
  |      refreshToken,            |                               |
  |      expiresIn, tokenType } --|                               |
```

### 2.2 Token Refresh Flow

```
Client                          Server
  |                               |
  |-- POST /api/v1/auth/refresh ->|
  |   { refreshToken }            |
  |                               |
  |                               |-- Verify refresh token signature
  |                               |-- Check expiration
  |                               |-- Check revocation list
  |                               |-- Check family rotation limit (max 5)
  |                               |-- Verify user still exists and is active
  |                               |-- Revoke old refresh token
  |                               |-- Generate new token pair (same family)
  |                               |
  |<-- { accessToken,             |
  |      refreshToken,            |
  |      expiresIn } -------------|
```

### 2.3 Nostr DID Authentication

```
Client                          Server                          Database
  |                               |                               |
  |-- GET /api/v1/auth/nostr/     |                               |
  |   challenge ----------------->|                               |
  |                               |-- Generate 64-char hex ------>|
  |                               |   challenge, store with       |
  |                               |   5-min expiry                |
  |<-- { challenge } -------------|                               |
  |                               |                               |
  | (Client signs challenge with  |                               |
  |  Nostr private key via        |                               |
  |  NIP-07 browser extension)    |                               |
  |                               |                               |
  |-- POST /api/v1/auth/nostr/    |                               |
  |   verify ------------------->|                               |
  |   { challenge, signature,     |                               |
  |     pubkey }                  |                               |
  |                               |-- Verify challenge exists     |
  |                               |   and not expired             |
  |                               |-- Verify secp256k1 signature  |
  |                               |-- Lookup user_identities by   |
  |                               |   pubkey ---------------------->|
  |                               |<-- User record -----------------|
  |                               |-- Mark challenge used -------->|
  |                               |-- Generate JWT token pair      |
  |                               |-- Update auth tracking ------->|
  |                               |                               |
  |<-- { accessToken,             |                               |
  |      refreshToken } ----------|                               |
```

### 2.4 API Request Authentication

```
Client                          Middleware                       Handler
  |                               |                               |
  |-- GET /api/v1/applications    |                               |
  |   Authorization: Bearer <JWT> |                               |
  |                               |                               |
  |                               |-- auth.middleware:             |
  |                               |   1. Extract Bearer token     |
  |                               |   2. Verify JWT signature     |
  |                               |   3. Check expiration         |
  |                               |   4. Check revocation         |
  |                               |   5. Validate iss/aud         |
  |                               |   6. Attach user to req       |
  |                               |                               |
  |                               |-- rbac.middleware:             |
  |                               |   1. Check role matches       |
  |                               |      required roles           |
  |                               |   2. Reject if insufficient   |
  |                               |                               |
  |                               |-- audit.middleware:            |
  |                               |   1. Log request context      |
  |                               |                               |
  |                               |---------------> Handler       |
  |                               |                 (with user    |
  |                               |                  context)     |
```

---

## 3. Data Protection Measures

### 3.1 Encryption

| Layer | Mechanism | Configuration |
|---|---|---|
| **In transit** | TLS 1.2+ | Enforced via HSTS header: `max-age=31536000; includeSubDomains; preload` |
| **At rest (files)** | S3 server-side encryption (AES-256) | Default S3 encryption; region `eu-west-2` |
| **At rest (database)** | PostgreSQL TDE or disk encryption | Configured at infrastructure level |
| **Passwords** | bcrypt (12 rounds production) | `BCRYPT_CONFIG.saltRounds` in `backend/src/config/security.ts` |
| **Session tokens** | SHA-256 hashed before storage | `sessions.token_hash` column |
| **File integrity** | SHA-256 per file | `application_files.file_hash` column |

### 3.2 Security Headers

Configured via Helmet in `backend/src/app.ts` and detailed in `backend/src/config/security.ts` (`SECURITY_HEADERS_CONFIG`):

| Header | Value |
|---|---|
| Content-Security-Policy | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; frame-ancestors 'none'; form-action 'self'; base-uri 'self'` |
| X-Frame-Options | `DENY` |
| X-Content-Type-Options | `nosniff` |
| X-XSS-Protection | `1; mode=block` |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |

### 3.3 CORS Policy

Source: `backend/src/config/security.ts` (`CORS_CONFIG`)

- Allowed origins: configurable via `CORS_ORIGINS` env var (defaults to localhost:3000, localhost:5173)
- Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
- Credentials: enabled
- Max preflight cache: 24 hours
- Exposed headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-ID

### 3.4 CSRF Protection

Source: `backend/src/config/security.ts` (`CSRF_CONFIG`), `backend/src/security/csrf.service.ts`

- 32-byte random token
- Transmitted via `X-CSRF-Token` header
- Cookie: `csrf_token`, SameSite=strict, Secure in production
- HttpOnly=false (must be readable by JavaScript to include in requests)
- 24-hour maximum age

### 3.5 Rate Limiting

Source: `backend/src/config/security.ts` (`RATE_LIMIT_CONFIG`)

| Endpoint Category | Window | Max Requests |
|---|---|---|
| General API | 15 minutes | 100 |
| Authentication | 15 minutes | 5 |
| Password reset | 1 hour | 3 |
| File upload | 1 hour | 50 |
| Export requests | 1 hour | 10 |

### 3.6 Input Sanitization

Source: `backend/src/security/sanitize.service.ts`, `backend/src/config/security.ts` (`SANITIZE_CONFIG`)

- HTML sanitization: Only `b, i, em, strong, a, p, br, ul, ol, li` tags allowed
- Input length limits: name (255), email (254), description (10,000), comment (5,000), shortText (500)
- SQL injection: Parameterized queries via `pg` library
- Path traversal: Unique filenames generated for uploads; no user-controlled paths used in file operations

### 3.7 Account Security

- Password policy: 12+ chars, uppercase, lowercase, numbers, special chars, no reuse of last 5
- Account lockout: 5 failed attempts triggers 15-minute lockout
- Failed attempts reset after 1 hour
- Password expiry: 90 days maximum age
- Email verification required (`users.email_verified`)

---

## 4. GDPR Compliance

### 4.1 Configuration

Source: `backend/src/config/security.ts` (`GDPR_CONFIG`)

- Default retention: 2,555 days (7 years, per PRD NFR-013)
- Per-call retention configurable via `funding_calls.retention_policy`
- Data export: JSON format, 24-hour processing SLA, 72-hour download link validity
- Data deletion: 30-day grace period for cancellation, anonymization preferred over hard delete

### 4.2 User Rights Implementation

| Right | Permission | Mechanism |
|---|---|---|
| Right of access | `gdpr:export:data` (all roles) | Export user data in JSON format |
| Right to erasure | `gdpr:delete:data` (applicant only) | Anonymization with 30-day grace period |
| Right to data portability | `gdpr:export:data` | Machine-readable JSON export |
| Consent recording | `confirmations` table | Type, timestamp, IP address stored per confirmation |

### 4.3 Data Minimisation

- EDI data stored as acknowledgement only (confirmation type `edi_completed`), not the actual EDI responses
- IP addresses in audit logs are anonymized (last octet zeroed for IPv4)
- Sensitive fields in audit log details are redacted (`[REDACTED]`)
- File access is logged (who downloaded what, when) for accountability

### 4.4 Audit Actions for GDPR

Defined in `AuditAction` enum:
- `gdpr.export`: User data export requested
- `gdpr.delete`: User data deletion requested
- `gdpr.consent_update`: User consent updated

---

## 5. Data Isolation Rules

### 5.1 Applicant Isolation

Applicants can only access:
- Their own applications (enforced by `canAccessApplication()` with ownership check)
- Their own files (via application ownership)
- Their own confirmations (via application ownership)

Cannot access:
- Other applicants' applications
- Any assessment data
- Master results
- Audit logs

### 5.2 Assessor Isolation (PRD AC-05, AC-07)

Assessors can only access:
- Calls where they have assignments
- Applications assigned to them (enforced by `canAccessApplication()` with assignment check)
- Their own assessments only (enforced by `canAccessAssessment()` with ownership check)

Cannot access:
- Unassigned applications
- Other assessors' assessments (critical isolation requirement)
- Master results or aggregated scores
- Applicant contact details beyond what is in the application materials

### 5.3 Coordinator Access

Coordinators have broad access:
- All applications for calls they manage
- All assessments for calls they manage
- Master results (exclusive access with scheme owners)
- Audit logs

Cannot access:
- Cannot act as assessor unless explicitly granted a dual role

### 5.4 Scheme Owner Access

Read-only access:
- All calls, applications, assessments, master results, audit logs
- Cannot modify any data
- PII access may be restricted beyond configured scope

---

## 6. Known Security Gaps

| Gap | Severity | Mitigation |
|---|---|---|
| Token revocation is in-memory only | High | Must implement Redis or database-backed revocation before production |
| Virus scanning returns stub CLEAN | High | Must integrate ClamAV before production (see ADR-008) |
| Audit service stores to in-memory array | High | Must wire to PostgreSQL `audit_logs` table before production |
| No MFA implementation | Medium | PRD lists as optional; implement for coordinator/assessor roles in v2 |
| No OpenAPI specification generated | Low | API is functional but documentation is missing |
| Demo routes bypass authentication | Medium | Must be removed or gated before production deployment |
| MIME type validation is header-based only | Medium | Add magic byte validation for file content verification |
| No SSO/SAML integration | Low | PRD lists as optional; implement when needed |
