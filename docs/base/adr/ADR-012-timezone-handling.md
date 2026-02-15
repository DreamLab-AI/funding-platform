# ADR-012: Timezone Handling

## Status
Accepted

## Context
PRD NFR-030 requires all deadlines and timestamps to be stored in UTC and displayed in Europe/London. PRD FR-013 mandates server-side deadline enforcement in Europe/London timezone. The platform serves users across the UK, where Europe/London transitions between GMT (UTC+0) and BST (UTC+1) based on daylight saving time rules.

## Decision
We store all timestamps in **UTC (TIMESTAMPTZ)** in the database and configure the application to use **Europe/London** as the display timezone.

### Storage Layer

All timestamp columns in the schema use `TIMESTAMPTZ` (timestamp with time zone):
- `funding_calls.open_at`, `funding_calls.close_at` (deadline timestamps)
- `applications.submitted_at`, `applications.withdrawn_at`
- `application_files.uploaded_at`, `application_files.scanned_at`
- `confirmations.confirmed_at`
- `assignments.assigned_at`, `assignments.due_at`
- `assessments.submitted_at`
- `audit_logs.timestamp`
- `sessions.created_at`, `sessions.expires_at`, `sessions.last_activity_at`
- All `created_at` and `updated_at` columns default to `NOW()` (UTC)

PostgreSQL stores TIMESTAMPTZ values in UTC internally and converts to/from the session timezone. The application connects with UTC as the session timezone to avoid implicit conversions.

### Application Layer

**Configuration**: `backend/src/config/index.ts` sets `timezone: 'Europe/London'` from the `TIMEZONE` environment variable.

**Deadline enforcement** (server-side):
- When checking if a submission is before the deadline, the server compares `NOW()` against `funding_calls.close_at` directly in UTC. Both values are in UTC, so the comparison is correct regardless of DST.
- The `DeadlinePassedError` error class (in `backend/src/utils/errors.ts`) includes the deadline timestamp in its message.

**Display formatting**:
- The `formatDate()` utility converts UTC timestamps to Europe/London for display.
- Email templates use UK-formatted dates with explicit "(UK Time)" label (see `backend/src/services/email.service.ts`).

### Frontend Layer

- Timestamps received from the API are in ISO 8601 UTC format.
- The frontend converts to the user's local timezone for display (typically Europe/London for UK users).
- Call deadlines show explicit timezone context.

### Database-level safeguards

The `funding_calls_dates_check` constraint ensures `close_at > open_at`, which works correctly in UTC regardless of DST transitions.

## Consequences

### Positive
- UTC storage eliminates ambiguity during BST/GMT transitions (the "2am twice" problem).
- Server-side deadline comparison in UTC is always correct, even during DST changes.
- TIMESTAMPTZ ensures PostgreSQL handles timezone conversion correctly when clients connect with different timezone settings.

### Negative
- Developers must be careful to always use TIMESTAMPTZ (not TIMESTAMP without time zone) for all new columns.
- The Europe/London display timezone must be explicitly applied; it does not happen automatically.
- If the platform expands to non-UK users, per-user timezone preferences will need to be added.

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **Store in Europe/London timezone** | Ambiguous during DST transitions. A deadline of "2026-10-25 01:30" could refer to two different instants. UTC eliminates this ambiguity. |
| **Store as TIMESTAMP (without timezone)** | Loses timezone context. A value of "2026-03-29 01:00" could be interpreted as UTC or local time depending on the context. TIMESTAMPTZ is unambiguous. |
| **Use Unix epoch integers** | Harder to query and debug. PostgreSQL's TIMESTAMPTZ provides arithmetic, comparison, and formatting functions natively. |
