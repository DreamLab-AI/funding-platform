-- Funding Application Platform - Initial Schema
-- Migration 001: Core Tables
-- Created: 2026-01-29

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE call_status AS ENUM (
    'draft',
    'open',
    'closed',
    'in_assessment',
    'completed',
    'archived'
);

CREATE TYPE application_status AS ENUM (
    'draft',
    'submitted',
    'withdrawn',
    'reopened'
);

CREATE TYPE assignment_status AS ENUM (
    'assigned',
    'in_progress',
    'completed',
    'returned'
);

CREATE TYPE assessment_status AS ENUM (
    'draft',
    'submitted',
    'returned'
);

CREATE TYPE file_scan_status AS ENUM (
    'pending',
    'scanning',
    'clean',
    'infected',
    'error'
);

CREATE TYPE user_role AS ENUM (
    'applicant',
    'assessor',
    'coordinator',
    'scheme_owner',
    'admin'
);

CREATE TYPE confirmation_type AS ENUM (
    'guidance_read',
    'edi_completed',
    'data_sharing_consent'
);

-- =============================================================================
-- USERS TABLE
-- =============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'applicant',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE users IS 'Platform users including applicants, assessors, and coordinators';
COMMENT ON COLUMN users.password_hash IS 'bcrypt or argon2 hashed password';
COMMENT ON COLUMN users.locked_until IS 'Account locked until this timestamp after failed login attempts';

-- =============================================================================
-- FUNDING CALLS TABLE
-- =============================================================================

CREATE TABLE funding_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    open_at TIMESTAMPTZ NOT NULL,
    close_at TIMESTAMPTZ NOT NULL,
    status call_status NOT NULL DEFAULT 'draft',

    -- Submission requirements stored as JSON
    -- Structure: { "allowed_file_types": ["pdf", "docx"], "max_file_size_mb": 50, "required_confirmations": ["guidance_read", "edi_completed", "data_sharing_consent"], "guidance_text": "...", "guidance_url": "..." }
    requirements JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Assessment criteria configuration stored as JSON
    -- Structure: { "criteria": [{ "id": "uuid", "name": "...", "description": "...", "max_points": 10, "weight": 1.0, "comments_required": false }], "assessors_per_application": 2, "variance_threshold": 3.0 }
    criteria_config JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Data retention policy in years
    retention_policy INTEGER NOT NULL DEFAULT 7,

    -- EDI form link (external)
    edi_form_url VARCHAR(500),

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT funding_calls_dates_check CHECK (close_at > open_at),
    CONSTRAINT funding_calls_retention_check CHECK (retention_policy >= 1 AND retention_policy <= 100)
);

COMMENT ON TABLE funding_calls IS 'Funding application windows with deadlines and configuration';
COMMENT ON COLUMN funding_calls.requirements IS 'JSON object containing submission requirements (file types, sizes, confirmations)';
COMMENT ON COLUMN funding_calls.criteria_config IS 'JSON object containing assessment criteria and scoring configuration';
COMMENT ON COLUMN funding_calls.retention_policy IS 'Number of years to retain data for GDPR compliance';

-- =============================================================================
-- APPLICATIONS TABLE
-- =============================================================================

CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES funding_calls(id) ON DELETE RESTRICT,

    -- Applicant details
    applicant_id UUID REFERENCES users(id),
    applicant_name VARCHAR(255) NOT NULL,
    applicant_email VARCHAR(255) NOT NULL,
    applicant_organisation VARCHAR(255),

    -- Application reference number (human-readable)
    reference_number VARCHAR(50) UNIQUE,

    status application_status NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,

    -- Receipt email details
    receipt_sent_at TIMESTAMPTZ,
    receipt_email_id VARCHAR(255),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT applications_email_check CHECK (applicant_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT applications_submitted_check CHECK (
        (status = 'submitted' AND submitted_at IS NOT NULL) OR
        (status != 'submitted')
    )
);

COMMENT ON TABLE applications IS 'Applicant submissions for funding calls';
COMMENT ON COLUMN applications.reference_number IS 'Human-readable reference like FUND-2026-001';
COMMENT ON COLUMN applications.receipt_email_id IS 'External email service message ID for tracking';

-- Function to generate application reference number
CREATE OR REPLACE FUNCTION generate_application_reference()
RETURNS TRIGGER AS $$
DECLARE
    call_name_prefix VARCHAR(10);
    year_part VARCHAR(4);
    seq_num INTEGER;
BEGIN
    -- Get first 4 chars of call name (uppercase, alphanumeric only)
    SELECT UPPER(REGEXP_REPLACE(SUBSTRING(name FROM 1 FOR 4), '[^A-Z0-9]', '', 'g'))
    INTO call_name_prefix
    FROM funding_calls
    WHERE id = NEW.call_id;

    -- Get year
    year_part := TO_CHAR(NOW(), 'YYYY');

    -- Get next sequence number for this call
    SELECT COALESCE(MAX(
        CAST(NULLIF(REGEXP_REPLACE(reference_number, '^[A-Z0-9]+-[0-9]+-', ''), '') AS INTEGER)
    ), 0) + 1
    INTO seq_num
    FROM applications
    WHERE call_id = NEW.call_id;

    NEW.reference_number := call_name_prefix || '-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_application_reference
    BEFORE INSERT ON applications
    FOR EACH ROW
    WHEN (NEW.reference_number IS NULL)
    EXECUTE FUNCTION generate_application_reference();

-- =============================================================================
-- APPLICATION FILES TABLE
-- =============================================================================

CREATE TABLE application_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    -- File metadata
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_hash VARCHAR(64), -- SHA-256 hash for integrity

    -- Virus scan status
    scan_status file_scan_status NOT NULL DEFAULT 'pending',
    scanned_at TIMESTAMPTZ,
    scan_result TEXT, -- Detailed scan result if infected

    -- File category (main application form vs supporting document)
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    category VARCHAR(50), -- e.g., 'application_form', 'pitch_deck', 'support_letter'

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_by_ip INET,

    CONSTRAINT application_files_size_check CHECK (file_size > 0 AND file_size <= 52428800) -- 50MB max
);

COMMENT ON TABLE application_files IS 'Files uploaded as part of applications';
COMMENT ON COLUMN application_files.file_path IS 'Path in object storage (S3/Azure Blob)';
COMMENT ON COLUMN application_files.file_hash IS 'SHA-256 hash for file integrity verification';
COMMENT ON COLUMN application_files.is_primary IS 'TRUE for main application form, FALSE for supporting docs';

-- =============================================================================
-- CONFIRMATIONS TABLE
-- =============================================================================

CREATE TABLE confirmations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,

    type confirmation_type NOT NULL,
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,

    CONSTRAINT confirmations_unique UNIQUE (application_id, type)
);

COMMENT ON TABLE confirmations IS 'Applicant confirmations (guidance read, EDI, data consent)';
COMMENT ON COLUMN confirmations.ip_address IS 'IP address when confirmation was made for audit';

-- =============================================================================
-- ASSESSORS TABLE
-- =============================================================================

CREATE TABLE assessors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),

    -- Assessor details (may not have user account)
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    organisation VARCHAR(255),

    -- Expertise tags for matching
    expertise_tags JSONB DEFAULT '[]'::jsonb,

    -- Assessor status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    invited_at TIMESTAMPTZ,
    invitation_accepted_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT assessors_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

COMMENT ON TABLE assessors IS 'External reviewers who score applications';
COMMENT ON COLUMN assessors.expertise_tags IS 'JSON array of expertise areas for matching, e.g., ["technology", "finance"]';
COMMENT ON COLUMN assessors.user_id IS 'Links to users table if assessor has platform account';

-- =============================================================================
-- ASSESSOR POOL (Many-to-Many: Calls to Assessors)
-- =============================================================================

CREATE TABLE call_assessor_pool (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID NOT NULL REFERENCES funding_calls(id) ON DELETE CASCADE,
    assessor_id UUID NOT NULL REFERENCES assessors(id) ON DELETE CASCADE,

    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    added_by UUID REFERENCES users(id),

    CONSTRAINT call_assessor_pool_unique UNIQUE (call_id, assessor_id)
);

COMMENT ON TABLE call_assessor_pool IS 'Pool of assessors available for each funding call';

-- =============================================================================
-- ASSIGNMENTS TABLE
-- =============================================================================

CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    assessor_id UUID NOT NULL REFERENCES assessors(id) ON DELETE RESTRICT,

    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    due_at TIMESTAMPTZ,

    status assignment_status NOT NULL DEFAULT 'assigned',

    -- Track if assessor has viewed the application
    first_viewed_at TIMESTAMPTZ,
    last_viewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT assignments_unique UNIQUE (application_id, assessor_id)
);

COMMENT ON TABLE assignments IS 'Links applications to their assigned assessors';
COMMENT ON COLUMN assignments.due_at IS 'Optional deadline for this specific assignment';

-- =============================================================================
-- ASSESSMENTS TABLE
-- =============================================================================

CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL UNIQUE REFERENCES assignments(id) ON DELETE CASCADE,

    -- Scores stored as JSON
    -- Structure: { "criterion_id": { "score": 8, "comment": "..." }, ... }
    scores_json JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- Calculated overall score (sum or weighted sum)
    overall_score DECIMAL(10, 2),

    -- General comments
    comments TEXT,

    -- Conflict of interest declaration
    coi_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    coi_details TEXT, -- If COI declared, details here

    status assessment_status NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,

    -- For returned assessments
    returned_at TIMESTAMPTZ,
    returned_by UUID REFERENCES users(id),
    return_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT assessments_submitted_check CHECK (
        (status = 'submitted' AND submitted_at IS NOT NULL AND coi_confirmed = TRUE) OR
        (status != 'submitted')
    )
);

COMMENT ON TABLE assessments IS 'Assessor evaluations with scores and comments';
COMMENT ON COLUMN assessments.scores_json IS 'JSON object mapping criterion IDs to scores and comments';
COMMENT ON COLUMN assessments.coi_confirmed IS 'Assessor must confirm COI status before submission';

-- =============================================================================
-- AUDIT LOGS TABLE
-- =============================================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Actor information
    actor_id UUID REFERENCES users(id),
    actor_role user_role,
    actor_email VARCHAR(255), -- Store email in case user is deleted

    -- Action details
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL, -- e.g., 'application', 'assessment', 'funding_call'
    target_id UUID,

    -- Additional context
    details JSONB DEFAULT '{}'::jsonb,

    -- Request context
    ip_address INET,
    user_agent TEXT,
    request_id VARCHAR(100), -- For correlating multiple log entries

    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS 'Immutable audit trail of all significant actions';
COMMENT ON COLUMN audit_logs.details IS 'JSON object with action-specific details (old values, new values, etc.)';
COMMENT ON COLUMN audit_logs.request_id IS 'UUID or correlation ID for tracing requests across services';

-- Make audit_logs append-only (no updates or deletes)
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- =============================================================================
-- NOTIFICATION LOGS TABLE (for email tracking)
-- =============================================================================

CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    recipient_email VARCHAR(255) NOT NULL,
    recipient_id UUID REFERENCES users(id),

    notification_type VARCHAR(50) NOT NULL, -- 'submission_receipt', 'assignment', 'reminder'
    subject VARCHAR(255),

    -- Related entities
    call_id UUID REFERENCES funding_calls(id),
    application_id UUID REFERENCES applications(id),
    assignment_id UUID REFERENCES assignments(id),

    -- Email service response
    external_message_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, sent, delivered, bounced, failed

    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    error_message TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE notification_logs IS 'Log of all email notifications sent';

-- =============================================================================
-- SESSIONS TABLE (for session management)
-- =============================================================================

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of session token

    ip_address INET,
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    revoked_at TIMESTAMPTZ
);

COMMENT ON TABLE sessions IS 'User session management for authentication';
COMMENT ON COLUMN sessions.token_hash IS 'Hashed session token (never store raw tokens)';

-- =============================================================================
-- UPDATED_AT TRIGGER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_funding_calls_updated_at
    BEFORE UPDATE ON funding_calls
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assessors_updated_at
    BEFORE UPDATE ON assessors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assignments_updated_at
    BEFORE UPDATE ON assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assessments_updated_at
    BEFORE UPDATE ON assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
