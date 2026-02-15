# Quality Engineering Report -- Backend Validation

**Date:** 2026-02-15
**Platform:** Funding Application Submission & Assessment Platform
**Backend:** Node.js/Express + TypeScript + PostgreSQL
**Server:** http://localhost:4000

---

## 1. API Endpoint Test Results

### 1.1 Health Check

| Endpoint | Method | Auth | Status | Result |
|----------|--------|------|--------|--------|
| `/health` | GET | None | 200 | **PASS** |

Response:
```json
{"status":"healthy","timestamp":"2026-02-15T17:58:59.084Z","version":"1.0.0"}
```

### 1.2 Auth Endpoints

| Endpoint | Method | Auth | Status | Result | Notes |
|----------|--------|------|--------|--------|-------|
| `/api/v1/auth/register` | POST | None | 400 | **FAIL** | Returns `INVALID_JSON` -- see Section 5.1 |
| `/api/v1/auth/login` | POST | None | 400 | **FAIL** | Same root cause as register |
| `/api/v1/auth/logout` | POST | JWT | -- | **BLOCKED** | Cannot test without valid JWT |
| `/api/v1/auth/refresh` | POST | None | -- | **BLOCKED** | Cannot test without valid token |
| `/api/v1/auth/me` | GET | JWT | 401 | **PASS** | Correctly rejects unauthenticated |
| `/api/v1/auth/me` | PUT | JWT | 401 | **PASS** | Correctly rejects unauthenticated |
| `/api/v1/auth/change-password` | POST | JWT | 401 | **PASS** | Correctly rejects unauthenticated |

### 1.3 Calls Endpoints (Public)

| Endpoint | Method | Auth | Status | Result | Notes |
|----------|--------|------|--------|--------|-------|
| `/api/v1/calls/open` | GET | None | 200 | **PASS** | Returns 3 demo calls |
| `/api/v1/calls/demo` | GET | None | 200 | **PASS** | Returns demo data with call list |
| `/api/v1/calls/:id/public` | GET | None | 500 | **FAIL** | INTERNAL_ERROR -- DB column mismatch |

### 1.4 Calls Endpoints (Protected)

| Endpoint | Method | Auth | Status | Result |
|----------|--------|------|--------|--------|
| `/api/v1/calls/` | GET | JWT | 401 | **PASS** (auth gate works) |
| `/api/v1/calls/` | POST | JWT | 401 | **PASS** (auth gate works) |
| `/api/v1/calls/:id` | GET | JWT | 401 | **PASS** (auth gate works) |

### 1.5 Applications Endpoints

| Endpoint | Method | Auth | Status | Result | Notes |
|----------|--------|------|--------|--------|-------|
| `/api/v1/applications/demo` | GET | None | 200 | **PASS** | Returns empty array (no demo data in list) |
| `/api/v1/applications/my` | GET | JWT | 401 | **PASS** (auth gate works) |

### 1.6 Assessments Endpoints

| Endpoint | Method | Auth | Status | Result |
|----------|--------|------|--------|--------|
| `/api/v1/assessments/my` | GET | JWT | 401 | **PASS** (auth gate works) |

### 1.7 AI Endpoints

| Endpoint | Method | Auth | Status | Result | Notes |
|----------|--------|------|--------|--------|-------|
| `/api/v1/ai/status` | GET | None | 200 | **PASS** | Returns demo AI status |
| `/api/v1/ai/providers` | GET | None | 200 | **PASS** | Returns live provider list |

### 1.8 Results Endpoints

| Endpoint | Method | Auth | Status | Result | Notes |
|----------|--------|------|--------|--------|-------|
| `/api/v1/results/demo/:callId` | GET | None | 200 | **PASS** | Returns 3 demo application results |

### Summary

| Category | Total | Pass | Fail | Blocked |
|----------|-------|------|------|---------|
| Public endpoints | 8 | 6 | 2 | 0 |
| Protected endpoints (auth gate) | 7 | 7 | 0 | 0 |
| Functional (requires auth) | 3 | 0 | 0 | 3 |
| **Total** | **18** | **13** | **2** | **3** |

---

## 2. Test Suite Results

```
Test Suites: 2 failed, 38 passed, 40 total
Tests:       4 failed, 1 skipped, 1668 passed, 1673 total
Time:        33.464 s
```

**Pass Rate: 99.76%** (1668/1672 executed)

### Failed Tests

#### 2.1 `tests/unit/controllers/calls.controller.test.ts`

| Test | Status | Root Cause |
|------|--------|------------|
| Error Handling > should pass database errors to error handler (500) | **FAIL** | `asyncHandler` wraps controller; rejected promise calls `next(err)` asynchronously but `mockNext` assertion runs before the microtask resolves. The test calls `listCalls()` without `await` on the returned promise, then awaits `flushPromises()`, but `flushPromises` may not resolve the full chain. |

#### 2.2 `tests/unit/controllers/results.controller.test.ts`

| Test | Status | Root Cause |
|------|--------|------------|
| getMasterResults > should handle database error (500) | **FAIL** | Same async error propagation issue |
| Error Handling > should handle database connection errors (500) | **FAIL** | Same async error propagation issue |
| Error Handling > should handle invalid UUID format | **FAIL** | Same async error propagation issue |

**Common Pattern:** All 4 failures share the same root cause -- `asyncHandler` wraps the controller function, and rejected promises are caught and passed to `next()` asynchronously. The tests call the controller without awaiting the returned value, then use `flushPromises()` which does not fully drain the microtask queue for these specific error paths.

---

## 3. TypeScript Compilation

**Status: PASS**

`npx tsc --noEmit` completed with zero errors. All TypeScript types resolve correctly at compile time.

---

## 4. Database Schema Verification

### 4.1 Tables Present (14 tables)

| Table | Status | Row Count |
|-------|--------|-----------|
| `users` | Present | 0 |
| `funding_calls` | Present | 0 |
| `applications` | Present | 0 |
| `assessments` | Present | 0 |
| `assignments` | Present | 0 |
| `assessors` | Present | 0 |
| `application_files` | Present | 0 |
| `confirmations` | Present | 0 |
| `sessions` | Present | 0 |
| `audit_logs` | Present | 0 |
| `call_assessor_pool` | Present | 0 |
| `notification_logs` | Present | 0 |
| `nostr_auth_challenges` | Present | 0 |
| `user_identities` | Present | 0 |

**Indexes:** 97 indexes defined across all tables. Comprehensive coverage for queries.

### 4.2 Schema-Model Mismatches (CRITICAL)

The database schema and ORM model layer reference different column names. This is the root cause of all runtime database failures.

#### `users` Table

| DB Column | Model Expects | Match |
|-----------|--------------|-------|
| `id` | `user_id` | MISMATCH |
| `name` | `first_name`, `last_name` | MISMATCH (single column vs two) |
| -- | `organisation` | MISSING from DB |
| -- | `expertise_tags` | MISSING from DB |
| -- | `is_active` | MISSING from DB |
| `email_verified` | `email_verified` | Match |
| `failed_login_attempts` | -- | Not referenced in model |
| `locked_until` | -- | Not referenced in model |
| `deleted_at` | -- | Not referenced in model |

#### `funding_calls` Table

| DB Column | Model Expects | Match |
|-----------|--------------|-------|
| `id` | `call_id` | MISMATCH |
| `requirements` | `submission_requirements` | MISMATCH |
| `criteria_config` | `criteria` | MISMATCH |
| `retention_policy` | `retention_years` | MISMATCH |
| `edi_form_url` | -- | Not in model INSERT |
| -- | `required_assessors_per_application` | MISSING from DB |
| -- | `variance_threshold` | MISSING from DB |

#### `applications` Table

| DB Column | Model Expects | Match |
|-----------|--------------|-------|
| `id` | `application_id` (inferred) | MISMATCH |
| Other columns | Appear aligned | Likely match |

#### `assessments` Table

| DB Column | Model Expects | Match |
|-----------|--------------|-------|
| `id` | `assessment_id` (inferred) | MISMATCH |
| `scores_json` | -- | Naming may differ in model |

#### `assignments` Table

| DB Column | Model Expects | Match |
|-----------|--------------|-------|
| `id` | `assignment_id` (inferred) | MISMATCH |

---

## 5. Missing Implementations and Bugs

### 5.1 CRITICAL: Auth Register/Login Broken at Runtime

**Severity:** Critical
**Impact:** No user can register or log in

The `POST /api/v1/auth/register` endpoint fails with `{"code":"INVALID_JSON","message":"An unexpected error occurred"}` (HTTP 400) for all valid payloads. Root causes:

1. **Route schema vs controller schema mismatch:** The route-level `registerSchema` (in `auth.routes.ts`) requires `name` (single string), but the controller's `userCreateSchema` (in `utils/validation.ts`) requires `first_name` and `last_name` (two strings). The Zod validation at the route strips extra fields and fails if the expected fields are missing.

2. **Database column mismatch:** Even if validation passed, the `UserModel.create()` method attempts to INSERT into columns `user_id`, `first_name`, `last_name`, `organisation`, `expertise_tags`, `is_active` -- none of which exist in the `users` table. The actual table has `id`, `name`, and lacks `organisation`, `expertise_tags`, and `is_active`.

3. **Error handler misclassification:** The error handler maps internal errors to `INVALID_JSON` error code when the error does not match the `AppError` instanceof check. The `Object.setPrototypeOf` in the `AppError` constructor may fail across module boundaries in certain Node.js configurations, causing `isAppError()` to return `false` for genuine `AppError` instances.

### 5.2 CRITICAL: Database Schema Out of Sync with Models

**Severity:** Critical
**Impact:** All write operations and most read operations involving these tables will fail at runtime

Every model uses column names (`user_id`, `call_id`, `first_name`, `last_name`, `submission_requirements`, `criteria`, etc.) that do not exist in the actual PostgreSQL schema. The tables use `id`, `name`, `requirements`, `criteria_config`, etc.

### 5.3 HIGH: Calls Public Detail Endpoint Broken

**Severity:** High
**Impact:** Public call detail pages cannot load

`GET /api/v1/calls/:id/public` returns 500 INTERNAL_ERROR. The `getCall` handler queries `WHERE call_id = $1` but the column is `id`.

### 5.4 MEDIUM: Error Handler Misclassifies Errors

**Severity:** Medium
**Impact:** Misleading error codes returned to clients

The global error handler returns `INVALID_JSON` code for errors that are not JSON parse errors. The `isAppError()` check using `instanceof` may fail due to prototype chain issues, causing `AppError` subclasses to fall through to the wrong error handling branch.

### 5.5 LOW: Test Async Error Handling Pattern

**Severity:** Low
**Impact:** 4 test failures give false negatives

Tests for error propagation through `asyncHandler` do not properly await the microtask queue. The pattern:
```typescript
controllerMethod(req, res, next);
await flushPromises();
expect(next).toHaveBeenCalledWith(error);
```
does not reliably wait for the `Promise.resolve(fn(...)).catch(next)` chain to complete.

### 5.6 INFO: Applications Demo Endpoint Returns Empty

**Severity:** Info
**Impact:** Demo mode shows no applications

`GET /api/v1/applications/demo` routes to `applicationsController.list` which queries the database (returns empty since no rows exist). Unlike the calls and results endpoints, this endpoint does not have demo data fallback logic.

---

## 6. Controller/Route/Model Integrity Verification

### 6.1 Route-to-Controller Mapping

| Route File | Controller | All Methods Exist | Status |
|------------|-----------|-------------------|--------|
| `auth.routes.ts` | `authController` | register, login, logout, refreshAccessToken, getProfile, updateProfile, changePassword | **PASS** |
| `calls.routes.ts` | `callsController` | listOpenCalls, getPublicCallDetails, list, create, getById, update, delete, openCall, closeCall, cloneCall, getAssessors, addAssessor, removeAssessor, getCriteria, updateCriteria | **PASS** |
| `applications.routes.ts` | `applicationsController` | create, getMyApplications, getById, update, withdraw, uploadFiles, deleteFile, downloadFile, addConfirmation, getConfirmations, submit, list, listByCall, exportMetadata, downloadAllFiles, reopen, getAssignedApplications, getMaterials | **PASS** |
| `assessments.routes.ts` | `assessmentsController` | getMyAssessments, getByAssignment, submitAssessment, updateDraft, finalSubmit, list, listByCall, listByApplication, returnForRevision | **PASS** |
| `assignments.routes.ts` | `assignmentsController` | assign, bulkAssign, listByCall, listByApplication, listByAssessor, unassign, getProgress, getProgressByAssessor, sendReminder, sendBulkReminders | **PASS** |
| `results.routes.ts` | `resultsController` | getMasterResults, getSummary, getVarianceFlags, getRanking, exportResults, exportDetailedResults, getApplicationResults, getScoreBreakdown, getAnalytics, getScoreDistribution | **PASS** |
| `ai.routes.ts` | inline handlers | All defined inline | **PASS** |
| `nostr.routes.ts` | `NostrMiddleware` | getChallenge, loginWithNostr, resolveDid, getLinkChallenge, linkNostrIdentity, unlinkNostrIdentity, getNostrIdentity | **PASS** |

### 6.2 Middleware Verification

| Middleware | Import Path | Exists | Status |
|------------|------------|--------|--------|
| `authenticate` | `middleware/auth.middleware` | Yes | **PASS** |
| `requireRoles` | `middleware/rbac.middleware` | Yes | **PASS** |
| `requireRole` | `middleware/rbac.middleware` | Yes (alias) | **PASS** |
| `validate` | `middleware/validation.middleware` | Yes | **PASS** |
| `uploadMultiple` | `middleware/upload.middleware` | Yes | **PASS** |

### 6.3 Model/Service Verification

| Import | Source File | Exists | Status |
|--------|-----------|--------|--------|
| `UserModel` | `models/user.model.ts` | Yes | **PASS** |
| `FundingCallModel` | `models/fundingCall.model.ts` | Yes | **PASS** |
| `ApplicationModel` | `models/application.model.ts` | Yes | **PASS** |
| `ScoringService` | `services/scoring.service.ts` | Yes | **PASS** |
| `getAIService` | `ai/ai.service.ts` | Yes | **PASS** |
| `NostrMiddleware` | `auth/index.ts` | Yes | **PASS** |

---

## 7. Recommendations

### P0 -- Critical (Must Fix Before Production)

1. **Align database schema with models.** Either migrate the database to match the model column names (`user_id`, `call_id`, `first_name`, `last_name`, `submission_requirements`, `criteria`, etc.) or update all model queries to use the actual column names (`id`, `name`, `requirements`, `criteria_config`, etc.). A single source of truth must be established.

2. **Align route validation schema with controller validation schema.** The `registerSchema` in `auth.routes.ts` accepts `name` but the controller's `userCreateSchema` requires `first_name` + `last_name`. Choose one convention and apply consistently.

3. **Fix `isAppError()` instanceof check.** The `Object.setPrototypeOf` approach in the `AppError` constructor can fail across module boundaries. Consider using a type brand/tag property instead:
   ```typescript
   // In AppError constructor:
   this._isAppError = true;

   // In isAppError:
   export function isAppError(err: unknown): err is AppError {
     return err != null && typeof err === 'object' && '_isAppError' in err;
   }
   ```

### P1 -- High Priority

4. **Add demo data fallback for `/api/v1/applications/demo`.** The calls and results endpoints return demo data when no database rows exist. The applications endpoint does not.

5. **Fix the 4 failing tests.** Update the async error propagation tests to properly await the controller promise chain. Recommended pattern:
   ```typescript
   await listCalls(mockReq, mockRes, mockNext);
   expect(mockNext).toHaveBeenCalledWith(dbError);
   ```

### P2 -- Medium Priority

6. **Add database migration tooling.** No migration framework was detected. Implement versioned migrations (e.g., with `node-pg-migrate` or `knex`) to keep schema and models synchronized.

7. **Add integration tests.** Current test suite is 100% unit tests with mocked database. Integration tests against a test database would have caught the schema-model mismatch.

8. **Add API contract tests.** Validate that request/response shapes match documented API schemas.

### P3 -- Low Priority

9. **Standardize error codes.** Document all error codes returned by the API and ensure the error handler maps each error type to the correct code.

10. **Add database seed script for development.** The database has zero rows in all tables. A seed script with sample data would improve development and testing experience.

---

## 8. Environment Summary

| Component | Version/Status |
|-----------|---------------|
| Backend Server | Running on port 4000 |
| TypeScript Compilation | Clean (0 errors) |
| Test Suite | 1668/1672 passing (99.76%) |
| Database | PostgreSQL, 14 tables, 97 indexes, 0 rows |
| Database Connectivity | Healthy |
| Auth Flow | Broken (schema mismatch) |
| Demo Mode | Partially working (calls, results, AI status work; applications empty) |
