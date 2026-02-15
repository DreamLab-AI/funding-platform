# Domain Events

**Funding Application Submission & Assessment Platform**

This document defines the domain events specified by the PRD, their current implementation status, and the gap between the desired event-driven architecture and the current implementation.

---

## 1. Event Architecture Overview

### Current State

The platform does **not** have an explicit domain event system. Instead, events are represented as:

1. **Audit log entries** -- created synchronously via `createAuditLog()` middleware after business operations complete
2. **Direct service calls** -- email notifications triggered inline within controller/model methods
3. **Status field changes** -- state transitions on entities serve as implicit events

### Desired State (per PRD Section 13.3)

The PRD envisions webhook-compatible domain events:
- `application.submitted`
- `assessment.completed`
- `call.status_changed`

These would enable external integrations and decouple internal concerns.

---

## 2. Domain Events Catalogue

### 2.1 ApplicationSubmitted

**Trigger:** Applicant submits their application.

**Payload:**
```typescript
interface ApplicationSubmitted {
  type: 'ApplicationSubmitted';
  application_id: string;
  call_id: string;
  reference_number: string;
  applicant_name: string;
  applicant_email: string;
  submitted_at: Date;
  file_count: number;
}
```

**Consumers:**
| Consumer | Action | Implementation Status |
|----------|--------|----------------------|
| Email Service | Send submission receipt to applicant | **Partially implemented** -- `EmailService.sendSubmissionReceipt()` exists at `/backend/src/services/email.service.ts` lines 85-153, but is not called from the submit flow |
| Audit Service | Log APPLICATION_SUBMITTED event | **Implemented** -- `AuditAction.APPLICATION_SUBMITTED` enum exists and is used in controller audit logging |
| Notification Log | Record receipt email delivery | **Not implemented** -- `notification_logs` table exists in migration but no model/service writes to it |

**Current Implementation:**

In `/backend/src/models/application.model.ts` `submit()` (lines 142-151):
```typescript
static async submit(application_id: string): Promise<Application | null> {
  await query(
    `UPDATE applications SET status = $1, submitted_at = NOW(), updated_at = NOW()
     WHERE application_id = $2`,
    [ApplicationStatus.SUBMITTED, application_id]
  );
  return this.findById(application_id);
}
```

The model performs the state change but does not emit an event. The email receipt would need to be triggered by the calling controller, which currently does not call `EmailService.sendSubmissionReceipt()`.

In `/backend/src/controllers/applications.controller.ts` `submit()` (lines 190-220), the direct pool query version also does not send a receipt email.

**Gap:** The submission receipt email -- a P0 requirement (US-A06) -- is not wired into the submission flow. The `EmailService.sendSubmissionReceipt()` method is implemented but never invoked on submission.

---

### 2.2 AssessmentCompleted

**Trigger:** Assessor submits their assessment.

**Payload:**
```typescript
interface AssessmentCompleted {
  type: 'AssessmentCompleted';
  assessment_id: string;
  assignment_id: string;
  application_id: string;
  call_id: string;
  assessor_id: string;
  overall_score: number;
  submitted_at: Date;
}
```

**Consumers:**
| Consumer | Action | Implementation Status |
|----------|--------|----------------------|
| Progress Tracker | Update completion statistics | **Implicit** -- progress is computed on-demand via `ScoringService.getCallProgress()` |
| Results Aggregator | Recalculate application results | **Implicit** -- results are computed on-demand via `ScoringService.getMasterResults()` |
| Audit Service | Log ASSESSMENT_SUBMITTED event | **Implemented** -- `AuditAction.ASSESSMENT_SUBMITTED` enum exists |

**Current Implementation:**

In `/backend/src/models/assessment.model.ts` `submit()` (lines 396-417):
```typescript
static async submit(assessment_id: string): Promise<Assessment | null> {
  const result = await query<Assessment>(
    `UPDATE assessments SET status = $1, submitted_at = NOW(), updated_at = NOW()
     WHERE assessment_id = $2 RETURNING *`,
    [AssessmentStatus.SUBMITTED, assessment_id]
  );
  // Update assignment status
  await AssignmentModel.updateStatus(assessment.assignment_id, AssignmentStatus.COMPLETED);
  return assessment;
}
```

**Gap:** No explicit event is raised. Progress and results are computed on-demand rather than reactively. This is functionally correct for the current scale but would not support real-time dashboards or webhook notifications.

---

### 2.3 AllAssessmentsCompleted

**Trigger:** The last required assessor completes their assessment for a given application.

**Payload:**
```typescript
interface AllAssessmentsCompleted {
  type: 'AllAssessmentsCompleted';
  application_id: string;
  call_id: string;
  reference_number: string;
  assessments_completed: number;
  assessments_required: number;
}
```

**Consumers:**
| Consumer | Action | Implementation Status |
|----------|--------|----------------------|
| Results Aggregator | Mark application as fully assessed | **Not implemented** |
| Coordinator Notification | Notify coordinator that application is ready for review | **Not implemented** |

**Current Implementation:** This event does not exist in the codebase. The required number of assessors is tracked (`funding_calls.required_assessors_per_application`) and compared against completion counts in `ScoringService.calculateApplicationResult()`, but no event fires when the threshold is reached.

**Gap:** No mechanism detects or reacts to full assessment completion. The coordinator must manually check the progress dashboard.

---

### 2.4 CallStatusChanged

**Trigger:** Coordinator changes the status of a funding call.

**Payload:**
```typescript
interface CallStatusChanged {
  type: 'CallStatusChanged';
  call_id: string;
  call_name: string;
  from_status: CallStatus;
  to_status: CallStatus;
  changed_by: string;
  timestamp: Date;
}
```

**Consumers:**
| Consumer | Action | Implementation Status |
|----------|--------|----------------------|
| Notification Service | Notify assessors when call moves to In Assessment | **Not implemented** |
| Application Lock | Lock applications when call moves to Closed | **Implicit** -- deadline enforcement is time-based, not event-based |
| Audit Service | Log CALL_STATUS_CHANGED event | **Implemented** |

**Current Implementation:**

In `/backend/src/controllers/calls.controller.ts` `updateCallStatus()` (lines 255-294):
```typescript
await FundingCallModel.updateStatus(callId, status);
await createAuditLog(req, AuditAction.CALL_STATUS_CHANGED, 'call', callId, {
  from: existingCall.status, to: status
});
```

**Gap:** Status changes are logged but do not trigger downstream actions such as assessor notifications or application locking.

---

### 2.5 AssessorAssigned

**Trigger:** Coordinator assigns one or more applications to an assessor.

**Payload:**
```typescript
interface AssessorAssigned {
  type: 'AssessorAssigned';
  assignment_id: string;
  application_id: string;
  assessor_id: string;
  call_id: string;
  assigned_by: string;
  due_at?: Date;
}
```

**Consumers:**
| Consumer | Action | Implementation Status |
|----------|--------|----------------------|
| Email Service | Send assignment notification to assessor | **Partially implemented** |
| Audit Service | Log ASSESSOR_ASSIGNED event | **Implemented** |

**Current Implementation:**

In `/backend/src/controllers/assignments.controller.ts` `assign()` (lines 9-41):
```typescript
// Send notification email
const assessor = await pool.query('SELECT email FROM users WHERE id = $1', [assessorId]);
if (assessor.rows[0]) {
  await emailService.sendAssignmentNotification(assessor.rows[0].email, result.rows[0]);
}
```

`EmailService.sendAssessorAssignment()` is fully implemented at `/backend/src/services/email.service.ts` (lines 158-235).

**Gap:** The assignment notification is sent inline in the controller but there is no formal event. The bulk assignment path (`bulkAssign()`) does **not** send notifications at all. This means assessors assigned via round-robin do not receive emails.

---

### 2.6 ReminderRequested

**Trigger:** Coordinator initiates a reminder to assessors with outstanding assessments.

**Payload:**
```typescript
interface ReminderRequested {
  type: 'ReminderRequested';
  call_id: string;
  assessor_ids: string[];
  outstanding_counts: Record<string, number>;
  requested_by: string;
}
```

**Consumers:**
| Consumer | Action | Implementation Status |
|----------|--------|----------------------|
| Email Service | Send reminder emails | **Implemented** |
| Audit Service | Log REMINDER_SENT event | **Implemented** -- `AuditAction.REMINDER_SENT` enum exists |

**Current Implementation:**

In `/backend/src/controllers/assignments.controller.ts`:
- `sendReminder()` (lines 259-297): Sends individual reminder via `emailService.sendReminderEmail()`
- `sendBulkReminders()` (lines 299-335): Sends multiple reminders

`EmailService.sendReminder()` is fully implemented at `/backend/src/services/email.service.ts` (lines 240-317).
`EmailService.sendBulkReminders()` is implemented at lines 323-342.

**Gap:** Reminder sent status is tracked by updating `assignments.reminder_sent_at` but this column is not in the migration schema. The `notification_logs` table is not used.

---

## 3. Implementation Status Summary

| Event | Audit Logged | Email Sent | Event Object | Webhook Ready |
|-------|-------------|------------|--------------|---------------|
| ApplicationSubmitted | Yes | **No** (method exists, not wired) | No | No |
| AssessmentCompleted | Yes | N/A | No | No |
| AllAssessmentsCompleted | No | No | No | No |
| CallStatusChanged | Yes | No | No | No |
| AssessorAssigned | Yes | **Partial** (single assign only) | No | No |
| ReminderRequested | Yes | Yes | No | No |

---

## 4. Implicit Events via AuditAction

The `AuditAction` enum in `/backend/src/types/index.ts` (lines 57-112) effectively catalogues all events the system recognises, even though they are not raised as first-class domain events:

**User Events:** `USER_LOGIN`, `USER_LOGOUT`, `USER_CREATED`, `USER_UPDATED`, `PASSWORD_CHANGED`, `PASSWORD_RESET`

**Call Events:** `CALL_CREATED`, `CALL_UPDATED`, `CALL_STATUS_CHANGED`, `CALL_CLONED`

**Application Events:** `APPLICATION_CREATED`, `APPLICATION_UPDATED`, `APPLICATION_SUBMITTED`, `APPLICATION_WITHDRAWN`, `APPLICATION_REOPENED`

**File Events:** `FILE_UPLOADED`, `FILE_DOWNLOADED`, `FILE_DELETED`

**Assignment Events:** `ASSESSOR_ASSIGNED`, `ASSESSOR_UNASSIGNED`, `BULK_ASSIGNMENT`

**Assessment Events:** `ASSESSMENT_CREATED`, `ASSESSMENT_UPDATED`, `ASSESSMENT_SUBMITTED`, `ASSESSMENT_RETURNED`, `COI_DECLARED`

**Export Events:** `EXPORT_METADATA`, `EXPORT_RESULTS`, `EXPORT_FILES`

**Admin Events:** `CONFIG_CHANGED`, `REMINDER_SENT`

**Nostr Events:** `NOSTR_IDENTITY_LINKED`, `NOSTR_IDENTITY_UNLINKED`, `NOSTR_LOGIN`, `NOSTR_NIP05_VERIFIED`, `NOSTR_CHALLENGE_CREATED`, `NOSTR_CHALLENGE_VERIFIED`

---

## 5. Recommendations for Event-Driven Migration

### Phase 1: Internal Event Bus

Introduce a simple in-process event emitter:
```typescript
// Emit after application submission
domainEvents.emit('ApplicationSubmitted', {
  application_id, call_id, reference_number, applicant_email, submitted_at
});

// Listeners
domainEvents.on('ApplicationSubmitted', async (event) => {
  await emailService.sendSubmissionReceipt(event.applicant_email, { ... });
  await auditLogModel.create({ action: 'APPLICATION_SUBMITTED', ... });
});
```

### Phase 2: External Webhooks

The PRD anticipates webhook events. Each domain event would be serialised to JSON and dispatched to registered webhook URLs:
- `application.submitted`
- `assessment.completed`
- `call.status_changed`

### Phase 3: Event Sourcing (Optional)

For full audit reconstruction capability, each aggregate mutation could be stored as an event in an event store, with the current state derived by replaying events. This is not required for V1 but aligns with the platform's strong audit requirements.
