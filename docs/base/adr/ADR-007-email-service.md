# ADR-007: Email Service Integration

## Status
Accepted

## Context
The platform sends three categories of transactional email: submission receipts to applicants (FR-014), assignment notifications to assessors (FR-023 implied), and assessment reminders to assessors with outstanding work (FR-025). PRD Section 13.1 specifies SMTP/SES/SendGrid integration.

## Decision
We implement a **dual-provider email service** with SendGrid as the primary provider and SMTP as the fallback, wrapped in a unified interface.

Implementation: `backend/src/services/email.service.ts`

**Provider selection logic:**
1. If `SENDGRID_API_KEY` is configured, use the `@sendgrid/mail` SDK.
2. Else if SMTP host is configured, use `nodemailer` with SMTP transport.
3. Else log a warning and return false (no-send mode for development).

**Email types implemented:**
1. `sendSubmissionReceipt()`: HTML + plaintext with applicant name, call name, reference number, and UK-formatted timestamp. Sent on application submission.
2. `sendAssessorAssignment()`: HTML + plaintext with call name, application count, due date, and login URL. Sent when coordinator assigns applications.
3. `sendReminder()`: HTML + plaintext with outstanding count, call name, due date, and login URL. Highlights urgency with red styling.
4. `sendBulkReminders()`: Sequential sending with 100ms delay between emails to avoid rate limiting. Returns sent/failed counts.

**Email templates:**
- Inline HTML with embedded CSS (no external template engine).
- Responsive design with max-width 600px containers.
- Branded headers (blue for receipts, green for assignments, red for reminders).
- Plaintext alternatives for accessibility and email client compatibility.
- From address defaults to `noreply@fundingplatform.gov.uk`.

**Configuration** (`backend/src/config/index.ts`):
- SendGrid API key, SMTP host/port/user/password/secure
- From address and display name
- All configurable via environment variables

## Consequences

### Positive
- Dual-provider approach ensures email delivery resilience if one provider experiences issues.
- No-send mode allows development and testing without email credentials.
- HTML + plaintext dual format maximizes email client compatibility.
- Bulk reminder sending with rate limiting protects against provider throttling.

### Negative
- Inline HTML templates are harder to maintain than template files. For v2, consider moving to a template engine (Handlebars, MJML).
- No email delivery tracking beyond logging. The `notification_logs` table exists in the schema but the service does not yet write to it.
- No email queue or retry mechanism. Failed sends are logged but not retried.

## Alternatives Considered

| Alternative | Reason for Rejection |
|---|---|
| **AWS SES only** | Locks into AWS ecosystem. SendGrid + SMTP gives provider flexibility. |
| **Mailgun** | Viable alternative but SendGrid has better deliverability reputation for UK government domains. |
| **Template engine (MJML/Handlebars)** | Good practice but adds build step complexity. Inline templates are sufficient for v1's three email types. |
