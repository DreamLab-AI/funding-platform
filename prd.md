# Product Requirements Document (PRD)
# Funding Application Submission & Assessment Platform

**Document Version:** 1.0  
**Status:** Draft for Review  
**Owner:** Project Co-ordinator (Platform Admin)  
**Created:** 29 January 2026  
**Last Updated:** 29 January 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Users & Personas](#4-users--personas)
5. [User Stories](#5-user-stories)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [System Architecture](#8-system-architecture)
9. [Data Model](#9-data-model)
10. [Key Workflows](#10-key-workflows)
11. [User Interface Requirements](#11-user-interface-requirements)
12. [Security, Privacy & Compliance](#12-security-privacy--compliance)
13. [Integration Requirements](#13-integration-requirements)
14. [Acceptance Criteria](#14-acceptance-criteria)
15. [Scope & Constraints](#15-scope--constraints)
16. [Glossary](#16-glossary)
17. [Appendix A: AFD Generation Instructions](#appendix-a-afd-generation-instructions)
18. [Appendix B: DDD Generation Instructions](#appendix-b-ddd-generation-instructions)

---

## 1. Executive Summary

### 1.1 Purpose

This document specifies the complete product requirements for a web-based **Funding Application Submission & Assessment Platform** that enables funding bodies to collect applications, manage assessor assignments, capture scoring, and produce consolidated results for decision-making.

### 1.2 Vision

To provide a streamlined, secure, and auditable platform that simplifies the funding application lifecycle—from submission through assessment to final results—while maintaining strict role-based access controls and GDPR compliance.

### 1.3 Key Capabilities

- **Applicant Portal**: Simple journey to upload application forms, supporting documents, complete required confirmations, and submit before deadline
- **Multi-Call Support**: Independent funding calls with their own deadlines, criteria, and assessor pools
- **Coordinator Dashboard**: Post-deadline administration including spreadsheet-style views, bulk exports, assessor assignment, and progress monitoring
- **Assessor Interface**: Restricted access to assigned applications only with structured scoring and commentary
- **Master Results**: Aggregated scores and comments visible exclusively to Project Coordinators

---

## 2. Problem Statement

### 2.1 Current State

Funding bodies currently rely on fragmented systems (email, spreadsheets, shared drives) to manage application submissions and assessments. This leads to:

- Manual tracking of submissions and deadlines
- Risk of data loss or version confusion
- Difficulty maintaining assessor blinding and confidentiality
- Time-consuming aggregation of assessment scores
- Audit trail gaps and compliance concerns
- Inconsistent applicant experience

### 2.2 Desired State

A unified platform where:

- Applicants have a clear, self-service submission journey
- Coordinators can configure calls, assign assessors, and monitor progress from a single interface
- Assessors only access their assigned applications and cannot view others' assessments
- All actions are logged for audit purposes
- Results aggregate automatically for informed decision-making

### 2.3 Impact

| Stakeholder | Current Pain | Platform Benefit |
|-------------|--------------|------------------|
| Applicants | Unclear requirements, no receipt confirmation | Guided submission, instant receipt |
| Coordinators | Manual tracking, spreadsheet juggling | Centralised dashboard, automated aggregation |
| Assessors | Scattered documents, unclear assignments | Clear task list, structured scoring forms |
| Governance | Audit gaps, compliance risk | Complete audit trail, GDPR alignment |

---

## 3. Goals & Success Metrics

### 3.1 Primary Goals

| Goal | Description | Priority |
|------|-------------|----------|
| G1 | Provide intuitive applicant submission journey | P0 |
| G2 | Support multiple concurrent funding calls | P0 |
| G3 | Enable efficient post-deadline administration | P0 |
| G4 | Restrict assessor access to assigned applications only | P0 |
| G5 | Aggregate scores into coordinator-only master results | P0 |
| G6 | Maintain full audit trail and GDPR compliance | P0 |

### 3.2 Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Application submission success rate | >95% | Submissions completed / submissions started |
| Average submission time | <15 minutes | Analytics from start to submission |
| Assessment completion rate | >90% | Assessments submitted / assessments assigned |
| Coordinator time to assign applications | <30 minutes for 100 applications | Time tracking |
| System availability during call windows | 99.5% | Uptime monitoring |
| Page load time | <3 seconds | Performance monitoring |

---

## 4. Users & Personas

### 4.1 Role Definitions

| Role | Primary Capabilities | Restrictions | Typical Users |
|------|---------------------|--------------|---------------|
| **Applicant** | Create and submit applications; upload files; complete confirmations; receive submission receipt | Cannot see other applications; cannot see assessor activity; cannot edit after submission (unless reopened) | SME, organisation, individual applicant |
| **Assessor** | View assigned applications; enter criterion scores and comments; submit assessment | Cannot see other assessors' work; cannot see master ranking; cannot reassign applications; cannot access unassigned applications | External reviewer, internal assessor |
| **Project Coordinator** | Create/manage calls; view/export all applications; assign assessors; monitor progress; access master results; lock/unlock phases | Cannot act as assessor unless explicitly granted; cannot expose master results to assessors | Funding delivery team admin |
| **Scheme Owner** (Optional) | Read-only overview across calls; reporting and audit access | Cannot edit calls; cannot assign assessors; cannot access applicant PII beyond configured scope | Senior stakeholder, governance |

### 4.2 Personas

#### Persona 1: Sarah the Applicant
- **Role**: SME owner applying for business growth funding
- **Technical Skill**: Moderate
- **Goals**: Submit application quickly with clear guidance
- **Frustrations**: Unclear requirements, no confirmation of receipt, deadline anxiety
- **Needs**: Mobile-friendly interface, progress indicators, instant confirmation

#### Persona 2: James the Coordinator
- **Role**: Programme Manager in funding delivery team
- **Technical Skill**: High
- **Goals**: Efficiently manage multiple funding calls, ensure fair assessment
- **Frustrations**: Manual spreadsheet management, chasing assessors, aggregating scores
- **Needs**: Dashboard overview, bulk operations, automated reminders, export capabilities

#### Persona 3: Maria the Assessor
- **Role**: Industry expert reviewing applications
- **Technical Skill**: Moderate
- **Goals**: Review assigned applications thoroughly, meet deadlines
- **Frustrations**: Unclear assignments, scattered documents, time pressure
- **Needs**: Clear task list, structured scoring form, ability to add comments

---

## 5. User Stories

### 5.1 Applicant Stories

| ID | User Story | Acceptance Criteria | Priority |
|----|------------|---------------------|----------|
| US-A01 | As an applicant, I want to view open funding calls so that I can find relevant opportunities | - List of open calls displayed with name, description, deadline<br>- Only calls with status "Open" shown<br>- Deadline displayed in local timezone | P0 |
| US-A02 | As an applicant, I want to start an application for a selected call so that I can begin my submission | - "Start Application" button visible for open calls<br>- Click creates draft application<br>- User navigated to submission form | P0 |
| US-A03 | As an applicant, I want to upload my application form and supporting documents so that I can provide required information | - Drag-and-drop or browse upload<br>- File type validation (configurable per call)<br>- File size validation (configurable per call)<br>- Virus scan on upload<br>- Progress indicator for uploads<br>- Multiple files supported | P0 |
| US-A04 | As an applicant, I want to complete required confirmations so that I acknowledge terms and conditions | - Checkboxes for: guidance read, EDI form completed, data sharing consent<br>- All required checkboxes must be ticked before submission<br>- Clear labelling of required vs optional | P0 |
| US-A05 | As an applicant, I want the system to prevent submission after the deadline so that fairness is maintained | - Submit button disabled after deadline<br>- Clear message showing deadline passed<br>- Deadline enforced server-side (Europe/London timezone) | P0 |
| US-A06 | As an applicant, I want to receive confirmation of my submission so that I have proof it was received | - Confirmation screen displayed on successful submission<br>- Email receipt sent to applicant<br>- Receipt includes timestamp, application reference, call name | P0 |
| US-A07 | As an applicant, I want to save my draft application so that I can return and complete it later | - Auto-save on file upload and confirmation changes<br>- "Save Draft" button<br>- Draft accessible until deadline | P1 |

### 5.2 Coordinator Stories

| ID | User Story | Acceptance Criteria | Priority |
|----|------------|---------------------|----------|
| US-C01 | As a coordinator, I want to create a funding call so that I can open a new application window | - Form with: name, description, open date-time, close date-time<br>- Status defaults to "Draft"<br>- Call saved to database | P0 |
| US-C02 | As a coordinator, I want to configure submission requirements so that applicants know what to provide | - Configure allowed file types (e.g., PDF, DOCX)<br>- Configure maximum file size<br>- Configure required confirmations<br>- Add guidance text/links | P0 |
| US-C03 | As a coordinator, I want to define assessment criteria so that scoring is consistent | - Add/edit/remove criteria<br>- Set max points per criterion<br>- Set optional weighting per criterion<br>- Set required number of assessors per application | P0 |
| US-C04 | As a coordinator, I want to manage the assessor pool so that I can control who reviews applications | - Add assessors (name, email, organisation)<br>- Remove assessors<br>- Tag assessors with expertise areas (optional)<br>- Invite assessors by email | P0 |
| US-C05 | As a coordinator, I want to view all applications in a spreadsheet-style table so that I can review submissions | - Table with columns: reference, applicant, submission date, file count, assignment count, assessment status<br>- Sortable columns<br>- Filterable by status<br>- Available only after deadline | P0 |
| US-C06 | As a coordinator, I want to export application metadata so that I can work offline or share with stakeholders | - Export to CSV<br>- Export to XLSX<br>- Configurable columns | P0 |
| US-C07 | As a coordinator, I want to download application files so that assessors can review offline | - Download individual application pack (ZIP)<br>- Download all applications (bulk ZIP)<br>- Secure, logged download | P0 |
| US-C08 | As a coordinator, I want to assign applications to assessors so that reviews can begin | - Select application(s) and assign to assessor(s)<br>- Bulk round-robin assignment<br>- Manual individual assignment<br>- Prevent self-assessment conflicts | P0 |
| US-C09 | As a coordinator, I want to view assessment progress so that I can monitor completion | - Dashboard showing: assessor name, assigned count, completed count, outstanding count<br>- Application view showing: which assessors assigned, who has completed<br>- Visual progress indicators | P0 |
| US-C10 | As a coordinator, I want to send reminder emails so that assessors complete on time | - Select assessors with outstanding assessments<br>- Send reminder email (template with customisation)<br>- Log reminder sent | P0 |
| US-C11 | As a coordinator, I want to view master results so that I can see aggregated scores | - One row per application<br>- Per-assessor scores visible<br>- Calculated totals/averages<br>- Assessor comments visible<br>- Variance flagging for high divergence | P0 |
| US-C12 | As a coordinator, I want to export master results so that I can prepare governance reports | - Export to XLSX<br>- Include all scores, aggregates, comments<br>- Access restricted to coordinator role | P0 |

### 5.3 Assessor Stories

| ID | User Story | Acceptance Criteria | Priority |
|----|------------|---------------------|----------|
| US-S01 | As an assessor, I want to see only my assigned applications so that I focus on my work | - Dashboard shows only calls where I have assignments<br>- Within call, only assigned applications visible<br>- No access to unassigned applications | P0 |
| US-S02 | As an assessor, I want to view application materials so that I can evaluate the submission | - View/download application form<br>- View/download supporting documents<br>- Clear file listing | P0 |
| US-S03 | As an assessor, I want to score applications against defined criteria so that evaluation is structured | - Form showing each criterion with description<br>- Score input field with valid range<br>- Comments field per criterion (optional or required per config) | P0 |
| US-S04 | As an assessor, I want to declare conflicts of interest so that integrity is maintained | - COI declaration checkbox per call or per application<br>- Must confirm COI status before submitting assessment<br>- Flag to coordinator if COI declared | P0 |
| US-S05 | As an assessor, I want to submit my assessment so that it is recorded | - Submit button active when all required fields complete<br>- Confirmation prompt before final submission<br>- Assessment timestamped and locked on submission | P0 |
| US-S06 | As an assessor, I want to be unable to see other assessors' scores so that my assessment is independent | - No visibility of other assessors' assessments<br>- No visibility of master results<br>- Enforced server-side | P0 |
| US-S07 | As an assessor, I want to save my in-progress assessment so that I can return later | - Auto-save on field change<br>- "Save Draft" button<br>- Draft accessible until submission or deadline | P1 |

---

## 6. Functional Requirements

### 6.1 Funding Call Management

| ID | Requirement | Description | Priority |
|----|-------------|-------------|----------|
| FR-001 | Create funding call | Coordinator creates call with name, description, open/close date-times, status (Draft/Open/Closed/In Assessment/Completed/Archived) | P0 |
| FR-002 | Configure submission requirements | Coordinator configures allowed file types, maximum file size, and required applicant confirmations | P0 |
| FR-003 | Configure assessment rubric | Coordinator defines assessment criteria with max points, optional weights, and required number of assessors per application | P0 |
| FR-004 | Manage assessor pool | Coordinator adds/removes assessors for a call; optionally tags assessors with expertise areas | P0 |
| FR-005 | Call status transitions | System enforces valid status transitions: Draft → Open → Closed → In Assessment → Completed → Archived | P0 |
| FR-006 | Clone funding call | Coordinator can clone an existing call to create a new one with similar configuration | P1 |

### 6.2 Applicant Submission

| ID | Requirement | Description | Priority |
|----|-------------|-------------|----------|
| FR-010 | Select funding call | Applicants view open calls and start application for selected call | P0 |
| FR-011 | Upload application form | Applicants upload required files; system validates file type, size, and performs virus scan | P0 |
| FR-012 | Required confirmations | Applicants tick required confirmations: guidance read, EDI form completed (acknowledgement), data sharing consent | P0 |
| FR-013 | Deadline enforcement | System prevents submission after call close date-time (Europe/London timezone); enforced server-side | P0 |
| FR-014 | Submission receipt | On successful submission, system timestamps application, locks edits, and sends confirmation email | P0 |
| FR-015 | Draft persistence | Applicant drafts are saved and accessible until deadline or submission | P1 |
| FR-016 | Application withdrawal | Applicant can withdraw application before deadline (logged action) | P2 |

### 6.3 Coordinator Post-Deadline Operations

| ID | Requirement | Description | Priority |
|----|-------------|-------------|----------|
| FR-020 | Applications table view | After deadline, coordinator views applications in spreadsheet-like table with metadata, file links, confirmation flags, assignment counts, assessment completion counts | P0 |
| FR-021 | Export metadata | Coordinator exports application metadata to CSV/XLSX | P0 |
| FR-022 | Download application files | Coordinator downloads individual application packs and optionally all files as ZIP | P0 |
| FR-023 | Assign applications | Coordinator assigns applications to assessors; bulk round-robin and manual assignment supported | P0 |
| FR-024 | Progress dashboard | Coordinator views assessment completion by assessor and by application, including outstanding assessments | P0 |
| FR-025 | Send reminders | Coordinator triggers reminder emails to assessors with outstanding assessments (manually initiated) | P0 |
| FR-026 | Reopen application | Coordinator can reopen a submitted application for applicant to edit (logged action) | P2 |
| FR-027 | Return assessment | Coordinator can return an assessment to assessor for revision (logged action) | P2 |

### 6.4 Assessor Scoring

| ID | Requirement | Description | Priority |
|----|-------------|-------------|----------|
| FR-030 | Restricted access | Assessors see only calls and applications assigned to them | P0 |
| FR-031 | View application materials | Assessors view/download assigned application form and supporting documents | P0 |
| FR-032 | Score by criterion | Assessors enter scores per criterion within configured ranges; add free-text comments | P0 |
| FR-033 | COI declaration | Assessors confirm conflict-of-interest declaration per call or per application before submitting | P0 |
| FR-034 | Submit and lock | On submit, assessment is timestamped and locked; unless returned by coordinator | P0 |
| FR-035 | Draft assessment | Assessors can save in-progress assessments as drafts | P1 |

### 6.5 Master Results

| ID | Requirement | Description | Priority |
|----|-------------|-------------|----------|
| FR-040 | Aggregate scoring | Platform calculates totals/averages across assessors per application, including optional weighted criteria | P0 |
| FR-041 | Variance flagging | Platform flags high variance between assessor scores (threshold configurable) | P0 |
| FR-042 | Master results view | Coordinator accesses master results with one row per application: per-assessor scores, aggregates, comments | P0 |
| FR-043 | Export results | Coordinator exports master results to XLSX; access restricted to coordinator role | P0 |
| FR-044 | Ranking/sorting | Master results sortable by total score, average score, variance | P1 |

---

## 7. Non-Functional Requirements

### 7.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-001 | Page load time | Key pages load in <3 seconds under normal load |
| NFR-002 | Concurrent users | Support 100+ concurrent applicants during peak submission windows |
| NFR-003 | Application scale | Support hundreds to a few thousand applications per call |
| NFR-004 | File upload | Support uploads up to 50MB per file with progress indication |
| NFR-005 | Export generation | Generate exports for 1000 applications in <60 seconds |

### 7.2 Availability & Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-010 | System availability | 99.5% availability during open call windows (excluding planned maintenance) |
| NFR-011 | Scheduled maintenance | Maintenance windows scheduled outside peak hours with 24-hour notice |
| NFR-012 | Backups | Daily backups of database and file store; defined restore procedure |
| NFR-013 | Data retention | Retention policy configurable per call; default 7 years |

### 7.3 Usability & Accessibility

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-020 | Browser support | Latest versions of Chrome, Edge, Safari, Firefox (desktop-first; mobile acceptable) |
| NFR-021 | Accessibility | WCAG 2.1 AA alignment for public applicant journeys |
| NFR-022 | Responsive design | Applicant submission works on tablet and mobile devices |
| NFR-023 | Language | English (UK) as primary language; i18n-ready for future |

### 7.4 Technical Standards

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-030 | Timezone handling | All deadlines and timestamps stored in UTC; displayed in Europe/London |
| NFR-031 | API design | RESTful API with OpenAPI specification |
| NFR-032 | Code quality | Minimum 80% test coverage for business logic |
| NFR-033 | Documentation | API documentation auto-generated; user guides provided |

---

## 8. System Architecture

### 8.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  Applicant UI    │  │  Assessor UI     │  │  Coordinator UI  │          │
│  │  (Public)        │  │  (Authenticated) │  │  (Authenticated) │          │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘          │
│           │                     │                     │                     │
│           └─────────────────────┼─────────────────────┘                     │
│                                 │                                           │
├─────────────────────────────────┼───────────────────────────────────────────┤
│                              API LAYER                                       │
├─────────────────────────────────┼───────────────────────────────────────────┤
│                                 ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                        API Gateway                                │      │
│  │        (Rate Limiting, Authentication, Request Routing)          │      │
│  └──────────────────────────────┬───────────────────────────────────┘      │
│                                 │                                           │
│  ┌──────────────────────────────┼───────────────────────────────────┐      │
│  │                     APPLICATION SERVICES                          │      │
│  ├──────────────────┬───────────┴───────────┬───────────────────────┤      │
│  │  Call Service    │  Application Service  │  Assessment Service   │      │
│  │  - CRUD calls    │  - Submissions        │  - Scoring            │      │
│  │  - Configuration │  - File handling      │  - Aggregation        │      │
│  │  - Status mgmt   │  - Confirmations      │  - Master results     │      │
│  └──────────────────┴───────────────────────┴───────────────────────┘      │
│                                                                             │
│  ┌──────────────────┬───────────────────────┬───────────────────────┐      │
│  │  User Service    │  Assignment Service   │  Notification Service │      │
│  │  - Auth/AuthZ    │  - Allocation         │  - Email receipts     │      │
│  │  - Roles         │  - Round-robin        │  - Reminders          │      │
│  │  - Profiles      │  - Progress tracking  │  - Templates          │      │
│  └──────────────────┴───────────────────────┴───────────────────────┘      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              DATA LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │
│  │  PostgreSQL      │  │  File Storage    │  │  Redis Cache     │          │
│  │  (Primary DB)    │  │  (S3/Azure Blob) │  │  (Sessions)      │          │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
           ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
           │ Email Service│ │ Virus Scanner│ │ SSO Provider │
           │ (SMTP/SES)   │ │ (ClamAV/API) │ │ (Optional)   │
           └──────────────┘ └──────────────┘ └──────────────┘
```

### 8.2 Technology Recommendations

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React with TypeScript | Modern, component-based, strong typing |
| Backend | Node.js/Express or Python/FastAPI | Async capabilities, JSON-native |
| Database | PostgreSQL | Relational integrity, JSON support, audit-friendly |
| File Storage | AWS S3 / Azure Blob | Scalable, encrypted at rest |
| Cache | Redis | Session management, performance |
| Email | AWS SES / SendGrid | Transactional email reliability |
| Virus Scanning | ClamAV or cloud service | File security |

---

## 9. Data Model

### 9.1 Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   FundingCall   │       │   Application   │       │    Assessor     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ call_id (PK)    │◄──────┤ call_id (FK)    │       │ assessor_id (PK)│
│ name            │       │ application_id  │       │ name            │
│ description     │       │   (PK)          │       │ email           │
│ open_at         │       │ applicant_name  │       │ organisation    │
│ close_at        │       │ applicant_email │       │ expertise_tags  │
│ status          │       │ submitted_at    │       └────────┬────────┘
│ requirements    │       │ status          │                │
│ criteria_config │       └────────┬────────┘                │
│ retention_policy│                │                         │
└─────────────────┘                │                         │
                                   │                         │
                          ┌────────┴────────┐                │
                          │                 │                │
                          ▼                 ▼                │
                 ┌─────────────────┐ ┌─────────────────┐     │
                 │ ApplicationFile │ │   Confirmation  │     │
                 ├─────────────────┤ ├─────────────────┤     │
                 │ file_id (PK)    │ │ confirmation_id │     │
                 │ application_id  │ │ application_id  │     │
                 │ filename        │ │ type            │     │
                 │ file_path       │ │ confirmed_at    │     │
                 │ file_size       │ │ ip_address      │     │
                 │ mime_type       │ └─────────────────┘     │
                 │ uploaded_at     │                         │
                 │ scan_status     │                         │
                 └─────────────────┘                         │
                                                             │
┌─────────────────────────────────────────────────────────────┘
│
│    ┌─────────────────┐       ┌─────────────────┐
│    │   Assignment    │       │   Assessment    │
│    ├─────────────────┤       ├─────────────────┤
└───►│ assignment_id   │◄──────┤ assessment_id   │
     │   (PK)          │       │   (PK)          │
     │ application_id  │       │ assignment_id   │
     │ assessor_id (FK)│       │ scores_json     │
     │ assigned_at     │       │ overall_score   │
     │ due_at          │       │ comments        │
     │ status          │       │ coi_confirmed   │
     └─────────────────┘       │ submitted_at    │
                               │ status          │
                               └─────────────────┘

┌─────────────────┐
│    AuditLog     │
├─────────────────┤
│ event_id (PK)   │
│ actor_id        │
│ actor_role      │
│ action          │
│ target_type     │
│ target_id       │
│ details_json    │
│ timestamp       │
│ ip_address      │
└─────────────────┘
```

### 9.2 Entity Definitions

| Entity | Key Fields | Description |
|--------|------------|-------------|
| **FundingCall** | call_id, name, description, open_at, close_at, status, submission_requirements, edi_link, criteria_config, retention_policy | A single application window with deadline and configuration |
| **Application** | application_id, call_id, applicant_details, files, confirmations, status, submitted_at | An applicant submission with uploaded files and confirmations |
| **ApplicationFile** | file_id, application_id, filename, file_path, file_size, mime_type, uploaded_at, scan_status | Individual uploaded file with virus scan status |
| **Confirmation** | confirmation_id, application_id, type, confirmed_at, ip_address | Record of applicant confirmation (guidance, EDI, consent) |
| **Assessor** | assessor_id, name, email, organisation, expertise_tags | A reviewer who scores assigned applications |
| **Assignment** | assignment_id, application_id, assessor_id, assigned_at, due_at, status | Link between application and assessor |
| **Assessment** | assessment_id, assignment_id, scores_json, overall_score, comments, coi_confirmed, submitted_at, status | Assessor's evaluation with scores and comments |
| **AuditLog** | event_id, actor_id, actor_role, action, target_type, target_id, details_json, timestamp, ip_address | Immutable log of all significant actions |

---

## 10. Key Workflows

### 10.1 Applicant Submission Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        APPLICANT SUBMISSION WORKFLOW                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌──────────────┐    ┌──────────────────────────┐                        │
│    │ Browse Open  │───►│ Select Funding Call      │                        │
│    │ Calls        │    └───────────┬──────────────┘                        │
│    └──────────────┘                │                                        │
│                                    ▼                                        │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │                    UPLOAD DOCUMENTS                               │    │
│    ├──────────────────────────────────────────────────────────────────┤    │
│    │  ┌────────────────────┐    ┌─────────────────────────────────┐  │    │
│    │  │ Upload Application │    │ Upload Supporting Materials     │  │    │
│    │  │ Form (Required)    │    │ (Pitch Deck, Video, Images,     │  │    │
│    │  │                    │    │  Letters of Support)            │  │    │
│    │  └────────────────────┘    └─────────────────────────────────┘  │    │
│    └──────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│    ┌──────────────────────────────────────────────────────────────────┐    │
│    │                    REQUIRED CONFIRMATIONS                         │    │
│    ├──────────────────────────────────────────────────────────────────┤    │
│    │  ☐ Guidance/Terms Read                                           │    │
│    │  ☐ EDI Form Completed (External)                                 │    │
│    │  ☐ Data Sharing Consent                                          │    │
│    └──────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                       │
│                    │      Before Deadline?         │                       │
│                    └───────────────┬───────────────┘                       │
│                         YES        │         NO                            │
│                          │         │          │                            │
│                          ▼         │          ▼                            │
│              ┌───────────────────┐ │  ┌───────────────────┐               │
│              │ SUBMIT APPLICATION│ │  │ Submission Blocked │               │
│              └─────────┬─────────┘ │  │ (Deadline Passed)  │               │
│                        │           │  └───────────────────┘               │
│                        ▼           │                                       │
│    ┌──────────────────────────────┐│                                       │
│    │    CONFIRMATION              ││                                       │
│    │  • On-screen confirmation    ││                                       │
│    │  • Email receipt sent        ││                                       │
│    │  • Application locked        ││                                       │
│    └──────────────────────────────┘│                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Coordinator Post-Deadline Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     COORDINATOR POST-DEADLINE WORKFLOW                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌─────────────────────────────────────┐                                 │
│    │         APPLICATIONS CLOSE          │                                 │
│    │  (Call status → Closed/In Assessment)│                                │
│    └──────────────────┬──────────────────┘                                 │
│                       │                                                     │
│    ┌──────────────────┼──────────────────┐                                 │
│    ▼                  ▼                  ▼                                  │
│  ┌────────────┐ ┌────────────────┐ ┌──────────────┐                        │
│  │ View       │ │ Assign to      │ │ Track        │                        │
│  │Applications│ │ Assessors      │ │ Progress     │                        │
│  │ Spreadsheet│ │                │ │              │                        │
│  └─────┬──────┘ └───────┬────────┘ └──────┬───────┘                        │
│        │                │                  │                                │
│        ▼                ▼                  │                                │
│  ┌────────────┐ ┌────────────────────────┐│                                │
│  │ Export     │ │    ASSIGN TO ASSESSORS ││                                │
│  │ Metadata   │ ├────────────────────────┤│                                │
│  │ (CSV/XLSX) │ │ ┌────────┐ ┌────────┐ ││                                │
│  └────────────┘ │ │Assessor│ │Assessor│ ││                                │
│                 │ │   A    │ │   B    │ ││                                │
│                 │ └────┬───┘ └───┬────┘ ││                                │
│                 │      │         │      ││                                │
│                 │      └────┬────┘      ││                                │
│                 │           ▼           ││                                │
│                 │ ┌──────────────────┐  ││                                │
│                 │ │ Applications     │  ││                                │
│                 │ │ Assigned         │  ││                                │
│                 │ └──────────────────┘  ││                                │
│                 └────────────────────────┘│                                │
│                                           │                                │
│    ┌──────────────────────────────────────┴─────────────────────────────┐  │
│    │                      MONITOR & REMIND                               │  │
│    │  • View progress dashboard                                          │  │
│    │  • Send reminder emails to assessors with outstanding work          │  │
│    └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Assessor Review Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ASSESSOR REVIEW WORKFLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌────────────────────────────────────┐                                  │
│    │ Login → View Assigned Applications │                                  │
│    └──────────────────┬─────────────────┘                                  │
│                       │                                                     │
│                       ▼                                                     │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │                    EVALUATE APPLICATION                          │     │
│    ├─────────────────────────────────────────────────────────────────┤     │
│    │                                                                  │     │
│    │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │     │
│    │  │ Review         │  │ Score          │  │ Add            │    │     │
│    │  │ Application    │  │ Criteria       │  │ Comments       │    │     │
│    │  │ Materials      │  │                │  │                │    │     │
│    │  └────────────────┘  └────────────────┘  └────────────────┘    │     │
│    │                                                                  │     │
│    │  ┌─────────────────────────────────────────────────────────┐   │     │
│    │  │ Confirm COI Declaration                                  │   │     │
│    │  └─────────────────────────────────────────────────────────┘   │     │
│    │                                                                  │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│                       │                                                     │
│                       ▼                                                     │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │                    SUBMIT ASSESSMENT                             │     │
│    │  • Assessment timestamped                                        │     │
│    │  • Assessment locked                                             │     │
│    │  • Confirmation displayed                                        │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Results Compilation Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       RESULTS COMPILATION WORKFLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │              ASSESSMENTS COLLECTED FROM ALL REVIEWERS            │     │
│    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │     │
│    │  │ Assessment   │  │ Assessment   │  │ Assessment   │          │     │
│    │  │ by Reviewer A│  │ by Reviewer B│  │ by Reviewer C│          │     │
│    │  │     ✓        │  │     ✓        │  │     ✓        │          │     │
│    │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │     │
│    │         │                 │                 │                   │     │
│    │         └─────────────────┼─────────────────┘                   │     │
│    │                           │                                     │     │
│    └───────────────────────────┼─────────────────────────────────────┘     │
│                                ▼                                            │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │                      MASTER SPREADSHEET                          │     │
│    ├─────────────────────────────────────────────────────────────────┤     │
│    │  • Combined Scores (per assessor)                                │     │
│    │  • Aggregated Totals/Averages                                    │     │
│    │  • Reviewer Comments                                             │     │
│    │  • Variance Flags                                                │     │
│    │  • Summary Overview                                              │     │
│    └──────────────────────────────┬──────────────────────────────────┘     │
│                                   │                                         │
│              ┌────────────────────┼────────────────────┐                   │
│              ▼                                         ▼                    │
│    ┌──────────────────────┐              ┌──────────────────────┐          │
│    │ COORDINATOR VIEW ONLY│              │  REVIEW PROGRESS     │          │
│    │ 🔒 Restricted Access │              │  📊 Track Assessor   │          │
│    │ • Full results access│              │     Status           │          │
│    │ • Export to XLSX     │              │  • Completion rates  │          │
│    └──────────────────────┘              └──────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 11. User Interface Requirements

### 11.1 Minimum Screen Set

| User | Screen | Key Components |
|------|--------|----------------|
| **Applicant** | Funding Call Landing | List of open calls, call details, "Start Application" CTA |
| **Applicant** | Application Submission | File upload zone, confirmation checkboxes, progress indicator, submit button |
| **Applicant** | Submission Confirmation | Success message, reference number, receipt details |
| **Assessor** | Assigned Applications List | Call filter, application cards with status badges |
| **Assessor** | Assessment Form | File viewer, scoring rubric, comment fields, COI checkbox, submit |
| **Coordinator** | Call Setup | Multi-step wizard: basic info, requirements, criteria, assessors |
| **Coordinator** | Applications Table | Spreadsheet-style grid with filters, sort, export, assignment actions |
| **Coordinator** | Assignment Tool | Bulk selection, round-robin allocation, manual assign modal |
| **Coordinator** | Progress Dashboard | Charts and tables showing completion by assessor and by application |
| **Coordinator** | Master Results | Aggregated view with per-assessor breakdown, variance flags, export |

### 11.2 Design Principles

1. **Clarity**: Clear visual hierarchy, minimal cognitive load
2. **Consistency**: Uniform patterns across all user journeys
3. **Feedback**: Immediate feedback on all actions (loading states, success/error messages)
4. **Accessibility**: Keyboard navigation, screen reader support, sufficient colour contrast
5. **Responsiveness**: Works on desktop (primary), tablet, and mobile (applicant flow)

### 11.3 Key UI Patterns

| Pattern | Usage |
|---------|-------|
| Progress Stepper | Multi-step forms (application submission, call setup) |
| Data Table | Applications list, master results, assessor pool |
| Card Grid | Applicant call selection, assessor application list |
| Modal Dialog | Confirmations, assignment, quick actions |
| File Upload Zone | Drag-and-drop with validation feedback |
| Toast Notifications | Success/error messages, async operation completion |

---

## 12. Security, Privacy & Compliance

### 12.1 Authentication & Authorisation

| Requirement | Implementation |
|-------------|----------------|
| User authentication | Email/password with strong password policy; optional SSO/SAML |
| Role-Based Access Control (RBAC) | Enforced server-side on all API endpoints and file downloads |
| Session management | Secure session tokens; timeout after 30 minutes inactivity |
| Multi-factor authentication | Optional for coordinator and assessor roles |

### 12.2 Data Protection

| Requirement | Implementation |
|-------------|----------------|
| Encryption at rest | All files and database encrypted (AES-256) |
| Encryption in transit | TLS 1.2+ for all traffic |
| Data minimisation | Store only what is necessary for administration and assessment |
| EDI data handling | EDI completion stored as acknowledgement only; actual EDI data in external system |
| PII protection | Applicant PII accessible only to coordinators; anonymised for reporting where possible |

### 12.3 Compliance

| Regulation | Requirements |
|------------|--------------|
| **GDPR** | Privacy notice at submission; explicit consent recording; right to erasure support; data retention policies |
| **UK Data Protection Act 2018** | Lawful basis for processing; security measures; breach notification procedures |
| **Accessibility** | WCAG 2.1 AA for public-facing pages |

### 12.4 Audit & Logging

All significant actions are logged immutably:

- Application submissions
- File downloads (by whom, when)
- Assessor assignments
- Assessment submissions
- Administrative overrides
- Login/logout events
- Configuration changes

---

## 13. Integration Requirements

### 13.1 External Services

| Service | Purpose | Integration Type |
|---------|---------|------------------|
| Email Service (SMTP/SES/SendGrid) | Submission receipts, assessor notifications, reminders | API |
| Virus Scanning (ClamAV/cloud) | Scan uploaded files before storage | API or daemon |
| External EDI Platform | Link-out for EDI data collection | URL redirect |
| SSO/Identity Provider (Optional) | Single sign-on for assessors and coordinators | SAML/OIDC |

### 13.2 API Design

- **REST API** with OpenAPI 3.0 specification
- **Versioned endpoints** (e.g., `/api/v1/...`)
- **Standard HTTP methods** (GET, POST, PUT, PATCH, DELETE)
- **JSON request/response** bodies
- **Consistent error format** with error codes and messages
- **Rate limiting** to prevent abuse
- **API keys** for service-to-service communication

### 13.3 Webhooks (Future)

Potential webhook events for external integrations:
- `application.submitted`
- `assessment.completed`
- `call.status_changed`

---

## 14. Acceptance Criteria

### 14.1 Critical Acceptance Criteria (Must Pass for Go-Live)

| ID | Criterion | Verification |
|----|-----------|--------------|
| AC-01 | Applicants cannot submit without required upload(s) and all required confirmations ticked | Automated test + manual verification |
| AC-02 | Applicants cannot submit after the call close date-time | Automated test with time manipulation |
| AC-03 | Coordinator can view spreadsheet-style applications list after deadline and export metadata | Manual verification with test data |
| AC-04 | Coordinator can assign each application to multiple assessors | Manual verification |
| AC-05 | Assessors only see their assigned applications | Security test with multiple assessor accounts |
| AC-06 | Assessors can submit scores and comments per criterion | Functional test |
| AC-07 | Assessors cannot see other assessors' assessments or master results | Security test |
| AC-08 | Master results aggregates scores from multiple assessors | Calculation verification test |
| AC-09 | Master results visible/exportable only to coordinator role | Security test |
| AC-10 | Progress dashboard accurately shows completion status | Data integrity test |
| AC-11 | All actions are logged in audit log | Log verification test |
| AC-12 | Files are scanned for viruses before storage | Integration test with test virus |

### 14.2 Performance Acceptance Criteria

| ID | Criterion | Target |
|----|-----------|--------|
| PAC-01 | Application submission page loads | <3 seconds |
| PAC-02 | Master results page loads with 500 applications | <5 seconds |
| PAC-03 | Export 1000 applications to XLSX | <60 seconds |
| PAC-04 | System handles 100 concurrent submissions | No failures, <5s response time |

---

## 15. Scope & Constraints

### 15.1 In Scope (Version 1)

- Funding call configuration (deadline, requirements, scoring criteria, assessor pool)
- Applicant submission (file upload, confirmations, submission receipt)
- Assessor assignment and assessment capture (scores, comments, timestamps)
- Progress dashboards and exports for coordinator
- Role-based access control (RBAC), audit logging, secure file storage
- Email notifications (receipts, reminders)

### 15.2 Out of Scope (Version 1)

| Feature | Rationale | Future Version |
|---------|-----------|----------------|
| Payment processing / grant disbursement | Separate financial system | v2+ |
| End-to-end EDI data collection | Handled by separate system; platform stores acknowledgement only | - |
| Applicant outcome communications | Can be added later; v1 focuses on submission receipt only | v2 |
| Panel moderation (live discussion, consensus scoring) | Complex feature; v1 focuses on independent assessment | v2 |
| Complex budget validation / financial modelling | Out of core scope | v2+ |
| Mobile native apps | Web-responsive sufficient for v1 | v2 |
| Multi-language support | English (UK) for v1; i18n-ready | v2 |

### 15.3 Constraints

| Constraint | Description |
|------------|-------------|
| Timeline | Must be operational for next funding call (target: [TBC]) |
| Budget | Development budget to be confirmed |
| Hosting | Must be hosted on UK-based or EU-based infrastructure for GDPR |
| Browser Support | Latest versions of Chrome, Edge, Safari, Firefox |
| Timezone | All deadlines enforced in Europe/London timezone |

### 15.4 Assumptions

- Applicants have access to modern web browsers
- Coordinators have basic technical literacy
- Assessors have email access and can receive notifications
- External EDI platform remains available for link-out
- Email service provider is reliable for transactional emails

### 15.5 Dependencies

- Selection of hosting provider / cloud platform
- Procurement of email service
- Procurement or deployment of virus scanning service
- (Optional) SSO provider configuration

---

## 16. Glossary

| Term | Definition |
|------|------------|
| **Funding Call** | A single application window with its own deadline, requirements, criteria, and assessor pool |
| **Application** | An applicant submission associated with a funding call, including uploaded files and confirmations |
| **Assessor** | A reviewer who scores assigned applications against defined criteria |
| **Project Coordinator** | Call administrator who manages calls, assigns assessors, and accesses master results |
| **EDI Form** | An external Equality, Diversity and Inclusion monitoring form; completion is acknowledged in-platform |
| **RBAC** | Role-Based Access Control - restricting access based on user roles |
| **COI** | Conflict of Interest - a situation where an assessor has a personal or professional interest that could bias their assessment |
| **Master Results** | Aggregated view of all assessments for a call, visible only to coordinators |
| **Round-Robin Assignment** | Automatic distribution of applications to assessors in rotation to balance workload |

---

## Appendix A: AFD Generation Instructions

> **Note:** This section contains instructions for generating Architecture and Feature Documentation (AFD) using the prd2build workflow. Do not generate these artifacts now—use these instructions when ready to proceed with documentation generation.

### A.1 Overview

The Architecture and Feature Documentation (AFD) comprises:

1. **Architecture Decision Records (ADRs)** - Documenting key technical decisions
2. **Feature Specifications** - Detailed requirements, API contracts, edge cases
3. **Implementation Plans** - Milestones, epics, and tasks
4. **Test Documentation** - Test strategy, test cases, TDD approach
5. **Design Mockups** - HTML mockups with design tokens

### A.2 Documentation Generation Command

```bash
/prd2build --ticket FUND-001 /path/to/funding-platform-prd.md
```

This will generate:

| Folder | Contents |
|--------|----------|
| `docs/base/adr/` | 27+ Architecture Decision Records |
| `docs/base/specification/` | Style guide, glossary, security model |
| `docs/base/sparc/` | SPARC methodology docs, traceability matrix |
| `docs/features/FUND-001/specification/` | Requirements, user stories, API contracts, edge cases |
| `docs/features/FUND-001/implementation/` | Milestones, epics, tasks, INDEX.md |
| `docs/features/FUND-001/testing/` | Test strategy, test cases, TDD approach |
| `docs/features/FUND-001/design/mockups/` | HTML mockups with design tokens |

### A.3 Expected ADR Topics

The following ADRs should be generated for this platform:

| ADR | Topic |
|-----|-------|
| ADR-001 | System Architecture (Monolith vs Microservices) |
| ADR-002 | Frontend Framework Selection |
| ADR-003 | Backend Framework Selection |
| ADR-004 | Database Technology |
| ADR-005 | File Storage Strategy |
| ADR-006 | Authentication & Authorisation |
| ADR-007 | Email Service Integration |
| ADR-008 | Virus Scanning Approach |
| ADR-009 | Audit Logging Strategy |
| ADR-010 | API Design Standards |
| ADR-011 | Error Handling Strategy |
| ADR-012 | Timezone Handling |
| ADR-013 | File Upload Validation |
| ADR-014 | Score Aggregation Algorithm |
| ADR-015 | Session Management |
| ADR-016 | Rate Limiting |
| ADR-017 | Export Generation (CSV/XLSX) |
| ADR-018 | Deployment Strategy |
| ADR-019 | Environment Configuration |
| ADR-020 | Testing Strategy |
| ADR-021 | Monitoring & Alerting |
| ADR-022 | Backup & Recovery |
| ADR-023 | Data Retention & Deletion |
| ADR-024 | GDPR Compliance Implementation |
| ADR-025 | Accessibility Implementation |
| ADR-026 | Performance Optimisation |
| ADR-027 | Security Headers & CORS |

### A.4 Verification After Generation

```bash
# Check artifact counts
TICKET="FUND-001"
echo "=== Base Documentation ===" && \
echo "ADR files: $(ls docs/base/adr/ADR-*.md 2>/dev/null | wc -l) (need 27)" && \
echo "Spec files: $(ls docs/base/specification/*.md 2>/dev/null | wc -l) (need 3+)" && \
echo "" && \
echo "=== Feature Documentation ($TICKET) ===" && \
echo "Spec files: $(ls docs/features/$TICKET/specification/*.md 2>/dev/null | wc -l) (need 7+)" && \
echo "Tasks: $(ls docs/features/$TICKET/implementation/tasks/TASK-*.md 2>/dev/null | wc -l) (need 20+)" && \
echo "INDEX.md: $(wc -l < docs/features/$TICKET/implementation/INDEX.md 2>/dev/null || echo 0) lines (need 400+)"
```

---

## Appendix B: DDD Generation Instructions

> **Note:** This section contains instructions for generating Domain-Driven Design (DDD) documentation. Do not generate these artifacts now—use these instructions when ready to proceed.

### B.1 Overview

The Domain-Driven Design documentation comprises:

1. **Domain Model** - Core domain concepts and relationships
2. **Bounded Contexts** - Logical boundaries within the system
3. **Aggregates** - Consistency boundaries and root entities
4. **Repositories** - Data access patterns
5. **Database Schema** - Physical data model
6. **Migrations** - Database migration scripts

### B.2 Expected DDD Artifacts

| File | Description |
|------|-------------|
| `docs/base/ddd/domain-model.md` | Core domain entities, value objects, relationships |
| `docs/base/ddd/bounded-contexts.md` | Context boundaries: Call Management, Submission, Assessment, Results, User Management |
| `docs/base/ddd/aggregates.md` | Aggregate roots: FundingCall, Application, Assessment |
| `docs/base/ddd/repositories.md` | Repository interfaces and data access patterns |
| `docs/base/ddd/database-schema.md` | Detailed database schema with indexes, constraints |
| `docs/base/ddd/migrations/` | Ordered migration scripts |
| `docs/base/ddd/events.md` | Domain events for event-driven patterns |
| `docs/base/ddd/services.md` | Domain services and application services |

### B.3 Bounded Contexts for This Platform

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BOUNDED CONTEXTS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────┐    ┌───────────────────────┐                    │
│  │   CALL MANAGEMENT     │    │     SUBMISSION        │                    │
│  │   CONTEXT             │    │     CONTEXT           │                    │
│  ├───────────────────────┤    ├───────────────────────┤                    │
│  │ • FundingCall         │    │ • Application         │                    │
│  │ • CallConfiguration   │◄───┤ • ApplicationFile     │                    │
│  │ • AssessorPool        │    │ • Confirmation        │                    │
│  │ • Criterion           │    │ • Applicant           │                    │
│  └───────────────────────┘    └───────────────────────┘                    │
│            │                            │                                   │
│            │                            │                                   │
│            ▼                            ▼                                   │
│  ┌───────────────────────┐    ┌───────────────────────┐                    │
│  │     ASSESSMENT        │    │      RESULTS          │                    │
│  │     CONTEXT           │    │      CONTEXT          │                    │
│  ├───────────────────────┤    ├───────────────────────┤                    │
│  │ • Assignment          │───►│ • AggregatedResult    │                    │
│  │ • Assessment          │    │ • VarianceFlag        │                    │
│  │ • Score               │    │ • RankingEntry        │                    │
│  │ • COIDeclaration      │    │ • ExportRequest       │                    │
│  └───────────────────────┘    └───────────────────────┘                    │
│                                                                             │
│  ┌───────────────────────┐    ┌───────────────────────┐                    │
│  │   USER MANAGEMENT     │    │      AUDIT            │                    │
│  │   CONTEXT             │    │      CONTEXT          │                    │
│  ├───────────────────────┤    ├───────────────────────┤                    │
│  │ • User                │    │ • AuditLog            │                    │
│  │ • Role                │    │ • AuditEvent          │                    │
│  │ • Permission          │    │                       │                    │
│  │ • Session             │    │                       │                    │
│  └───────────────────────┘    └───────────────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B.4 Aggregate Roots

| Aggregate | Root Entity | Enclosed Entities | Invariants |
|-----------|-------------|-------------------|------------|
| **FundingCall** | FundingCall | CallConfiguration, Criterion[], AssessorPoolMember[] | Deadline must be in future when opened; criteria must exist before assessment |
| **Application** | Application | ApplicationFile[], Confirmation[] | Cannot submit without required confirmations; cannot submit after deadline |
| **Assessment** | Assessment | Score[], Comment | Cannot submit without all criteria scored; COI must be declared |
| **User** | User | Role[], Permission[] | Must have at least one role |

### B.5 Domain Events

| Event | Trigger | Consumers |
|-------|---------|-----------|
| `ApplicationSubmitted` | Applicant submits application | Notification Service (send receipt) |
| `AssessmentCompleted` | Assessor submits assessment | Progress Tracker, Results Aggregator |
| `AllAssessmentsCompleted` | Last assessor completes for an application | Results Aggregator |
| `CallStatusChanged` | Coordinator changes call status | Notification Service (if configured) |
| `AssessorAssigned` | Coordinator assigns assessor | Notification Service (send assignment email) |
| `ReminderRequested` | Coordinator triggers reminder | Notification Service |

### B.6 Generation with prd2build

DDD artifacts are generated as part of the base documentation:

```bash
/prd2build --ticket FUND-001 /path/to/funding-platform-prd.md
```

For regeneration of base documentation including DDD:

```bash
/prd2build --ticket FUND-001 /path/to/funding-platform-prd.md --regenerate-base
```

### B.7 Database Schema Considerations

Key schema design decisions to document:

1. **UUID vs Integer IDs** - Prefer UUIDs for distributed safety and security
2. **JSON columns** - Use for flexible configuration (criteria_config, scores_json)
3. **Soft deletes** - Consider for audit trail (is_deleted flag vs hard delete)
4. **Timestamps** - All tables should have created_at, updated_at
5. **Indexes** - Index foreign keys and frequently filtered columns
6. **Constraints** - Enforce business rules at database level where practical

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 29 January 2026 | Claude | Initial PRD created from specification |

---

*End of Document*
