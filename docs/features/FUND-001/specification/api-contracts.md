# API Contracts: FUND-001

All API endpoints with request/response schemas. Base URL: `/api/v1`.

---

## Authentication

### POST /auth/login
**Access**: Public

Request:
```json
{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "expiresIn": 900,
    "tokenType": "Bearer"
  }
}
```

### POST /auth/refresh
**Access**: Public (with valid refresh token)

Request:
```json
{
  "refreshToken": "eyJ..."
}
```

Response (200): Same as login response.

### POST /auth/nostr/challenge
**Access**: Public

Response (200):
```json
{
  "success": true,
  "data": {
    "challenge": "a1b2c3...64-char-hex",
    "expiresAt": "2026-02-15T12:05:00.000Z"
  }
}
```

### POST /auth/nostr/verify
**Access**: Public

Request:
```json
{
  "challenge": "a1b2c3...64-char-hex",
  "signature": "sig-hex",
  "pubkey": "pubkey-64-char-hex"
}
```

Response (200): Same as login response.

---

## Funding Calls

### GET /calls/open
**Access**: Public (no auth)

Response (200):
```json
{
  "success": true,
  "data": [
    {
      "call_id": "uuid",
      "name": "Innovation Fund 2026",
      "description": "Funding for SME innovation projects",
      "open_at": "2026-01-15T09:00:00.000Z",
      "close_at": "2026-03-15T17:00:00.000Z",
      "status": "open"
    }
  ]
}
```

### POST /calls
**Access**: Coordinator, Admin

Request (validated by Zod):
```json
{
  "name": "Innovation Fund 2026",
  "description": "Funding for SME innovation projects",
  "open_at": "2026-01-15T09:00:00.000Z",
  "close_at": "2026-03-15T17:00:00.000Z",
  "requirements": {
    "allowedFileTypes": ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    "maxFileSize": 52428800,
    "maxFiles": 5,
    "requiredConfirmations": ["guidance_read", "edi_completed", "data_sharing_consent"],
    "guidanceUrl": "https://example.com/guidance",
    "ediFormUrl": "https://external-edi.example.com/form"
  },
  "criteria_config": [
    {
      "name": "Strategic Alignment",
      "description": "How well the project aligns with fund objectives",
      "maxPoints": 10,
      "weight": 2.0,
      "commentsRequired": true
    },
    {
      "name": "Value for Money",
      "description": "Cost effectiveness and efficiency",
      "maxPoints": 10,
      "weight": 1.5,
      "commentsRequired": false
    }
  ]
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "call_id": "uuid",
    "name": "Innovation Fund 2026",
    "status": "draft",
    "created_at": "2026-02-15T10:00:00.000Z"
  }
}
```

### PUT /calls/:id/criteria
**Access**: Coordinator, Admin

Request: Array of criterion objects (same structure as criteria_config in POST).

### POST /calls/:id/open
**Access**: Coordinator, Admin

Response (200): Updated call object with `status: "open"`.

### POST /calls/:id/close
**Access**: Coordinator, Admin

Response (200): Updated call object with `status: "closed"`.

### POST /calls/:id/clone
**Access**: Coordinator, Admin

Response (201): New call object cloned from source.

### POST /calls/:id/assessors
**Access**: Coordinator, Admin

Request:
```json
{
  "name": "Dr. Jane Smith",
  "email": "jane.smith@university.ac.uk",
  "organisation": "University of Research",
  "expertise_tags": ["technology", "innovation"]
}
```

---

## Applications

### POST /applications
**Access**: Authenticated (Applicant)

Request:
```json
{
  "call_id": "uuid"
}
```

Response (201):
```json
{
  "success": true,
  "data": {
    "application_id": "uuid",
    "reference_number": "INNO-2026-0001",
    "call_id": "uuid",
    "status": "draft",
    "created_at": "2026-02-15T10:30:00.000Z"
  }
}
```

### POST /applications/:id/files
**Access**: Authenticated (Applicant)
**Content-Type**: multipart/form-data

Request: FormData with one or more file fields.

Response (200):
```json
{
  "success": true,
  "data": [
    {
      "file_id": "uuid",
      "filename": "unique-name.pdf",
      "original_filename": "Application Form.pdf",
      "file_size": 2048576,
      "mime_type": "application/pdf",
      "scan_status": "pending",
      "uploaded_at": "2026-02-15T10:35:00.000Z"
    }
  ]
}
```

### POST /applications/:id/confirmations
**Access**: Authenticated (Applicant)

Request:
```json
{
  "type": "guidance_read"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "confirmation_id": "uuid",
    "type": "guidance_read",
    "confirmed_at": "2026-02-15T10:40:00.000Z"
  }
}
```

### POST /applications/:id/submit
**Access**: Authenticated (Applicant, before deadline)

Response (200):
```json
{
  "success": true,
  "data": {
    "application_id": "uuid",
    "reference_number": "INNO-2026-0001",
    "status": "submitted",
    "submitted_at": "2026-02-15T10:45:00.000Z",
    "receipt_sent": true
  }
}
```

Error (400 - Deadline passed):
```json
{
  "success": false,
  "error": {
    "code": "DEADLINE_PASSED",
    "message": "Submission deadline has passed (2026-03-15T17:00:00.000Z)"
  }
}
```

### GET /applications/call/:callId
**Access**: Coordinator, Admin

Response (200):
```json
{
  "success": true,
  "data": [
    {
      "application_id": "uuid",
      "reference_number": "INNO-2026-0001",
      "applicant_name": "Acme Corp",
      "applicant_email": "ceo@acme.com",
      "applicant_organisation": "Acme Corporation",
      "status": "submitted",
      "file_count": 3,
      "confirmation_count": 3,
      "assignment_count": 2,
      "completed_assessments": 1,
      "submitted_at": "2026-02-15T10:45:00.000Z",
      "created_at": "2026-02-15T10:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### GET /applications/export/:callId
**Access**: Coordinator, Admin
**Query**: `?format=xlsx` or `?format=csv`

Response: Binary file download with appropriate Content-Type and Content-Disposition headers.

---

## Assignments

### POST /assignments
**Access**: Coordinator, Admin

Request (Zod validated):
```json
{
  "applicationId": "uuid",
  "assessorId": "uuid",
  "dueAt": "2026-04-15T17:00:00.000Z"
}
```

### POST /assignments/bulk
**Access**: Coordinator, Admin

Request (Zod validated):
```json
{
  "applicationIds": ["uuid1", "uuid2", "uuid3"],
  "assessorIds": ["assessor-uuid1", "assessor-uuid2"],
  "strategy": "round-robin",
  "assessorsPerApplication": 2,
  "dueAt": "2026-04-15T17:00:00.000Z"
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "created": 6,
    "assignments": [
      {
        "assignment_id": "uuid",
        "application_id": "uuid1",
        "assessor_id": "assessor-uuid1",
        "status": "assigned"
      }
    ]
  }
}
```

### GET /assignments/progress/:callId
**Access**: Coordinator, Admin

Response (200):
```json
{
  "success": true,
  "data": {
    "call_id": "uuid",
    "call_name": "Innovation Fund 2026",
    "status": "in_assessment",
    "total_applications": 150,
    "total_assignments": 300,
    "completed_assessments": 180,
    "outstanding_assessments": 120,
    "completion_percentage": 60,
    "assessor_progress": [
      {
        "assessor_id": "uuid",
        "assessor_name": "Dr. Jane Smith",
        "assessor_email": "jane.smith@university.ac.uk",
        "assigned_count": 25,
        "completed_count": 15,
        "outstanding_count": 10,
        "last_activity": "2026-02-14T16:30:00.000Z"
      }
    ]
  }
}
```

### POST /assignments/remind-bulk
**Access**: Coordinator, Admin

Request:
```json
{
  "callId": "uuid",
  "assessorIds": ["uuid1", "uuid2"]
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "sent": 2,
    "failed": 0
  }
}
```

---

## Assessments

### POST /assessments/assignment/:assignmentId
**Access**: Assessor

Request (Zod validated):
```json
{
  "scores": [
    {
      "criterionId": "uuid",
      "score": 8,
      "comment": "Strong strategic alignment with fund objectives"
    },
    {
      "criterionId": "uuid",
      "score": 7,
      "comment": "Good value proposition"
    }
  ],
  "overallComment": "A strong application with clear impact potential",
  "coiConfirmed": true
}
```

Response (200):
```json
{
  "success": true,
  "data": {
    "assessment_id": "uuid",
    "assignment_id": "uuid",
    "status": "draft",
    "overall_score": 15,
    "created_at": "2026-02-15T14:00:00.000Z"
  }
}
```

### POST /assessments/assignment/:assignmentId/submit
**Access**: Assessor

Response (200):
```json
{
  "success": true,
  "data": {
    "assessment_id": "uuid",
    "status": "submitted",
    "submitted_at": "2026-02-15T14:30:00.000Z"
  }
}
```

### POST /assessments/:id/return
**Access**: Coordinator, Admin

Request:
```json
{
  "reason": "Please review criterion 2 scoring justification"
}
```

---

## Results

### GET /results/call/:callId
**Access**: Coordinator, Admin

Response (200):
```json
{
  "success": true,
  "data": {
    "call_id": "uuid",
    "call_name": "Innovation Fund 2026",
    "results": [
      {
        "application_id": "uuid",
        "reference_number": "INNO-2026-0001",
        "applicant_name": "Acme Corp",
        "applicant_organisation": "Acme Corporation",
        "assessor_scores": [
          {
            "assessor_id": "uuid",
            "assessor_name": "Dr. Jane Smith",
            "scores": [
              { "criterion_id": "uuid", "score": 8, "comment": "Strong alignment" },
              { "criterion_id": "uuid", "score": 7, "comment": "Good value" }
            ],
            "overall_score": 15,
            "overall_comment": "Strong application",
            "submitted_at": "2026-02-14T16:30:00.000Z"
          }
        ],
        "criterion_aggregates": [
          {
            "criterion_id": "uuid",
            "criterion_name": "Strategic Alignment",
            "max_points": 10,
            "weight": 2.0,
            "scores": [8, 7, 9],
            "average": 8.0,
            "min": 7,
            "max": 9,
            "variance": 0.67,
            "high_variance": false
          }
        ],
        "total_average": 14.5,
        "weighted_average": 15.2,
        "total_variance": 1.5,
        "high_variance_flag": false,
        "assessments_completed": 3,
        "assessments_required": 3
      }
    ],
    "summary": {
      "total_applications": 150,
      "fully_assessed": 120,
      "partially_assessed": 25,
      "not_assessed": 5,
      "high_variance_count": 12
    }
  }
}
```

### GET /results/call/:callId/export
**Access**: Coordinator, Admin

Response: XLSX binary download. Three sheets: Summary, Results, Assessor Details.

---

## Common Error Responses

### 400 Validation Error
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "name", "message": "String must contain at least 3 character(s)" }
    ]
  }
}
```

### 401 Authentication Error
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_ERROR",
    "message": "Authentication required"
  }
}
```

### 403 Authorization Error
```json
{
  "success": false,
  "error": {
    "code": "AUTHORIZATION_ERROR",
    "message": "Only Coordinators can manage funding calls"
  }
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Application with ID abc-123 not found"
  }
}
```

### 429 Rate Limited
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "details": { "retryAfter": 300 }
  }
}
```

### 500 Internal Error (production)
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
  }
}
```
