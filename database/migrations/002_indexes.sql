-- Funding Application Platform - Indexes
-- Migration 002: Performance Indexes
-- Created: 2026-01-29

-- =============================================================================
-- USERS INDEXES
-- =============================================================================

-- Email lookup for authentication
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;

-- Role-based queries
CREATE INDEX idx_users_role ON users(role) WHERE deleted_at IS NULL;

-- Last login tracking
CREATE INDEX idx_users_last_login ON users(last_login_at DESC) WHERE deleted_at IS NULL;

-- =============================================================================
-- FUNDING CALLS INDEXES
-- =============================================================================

-- Status filtering (most common query pattern)
CREATE INDEX idx_funding_calls_status ON funding_calls(status);

-- Open calls lookup (applicant-facing)
CREATE INDEX idx_funding_calls_open ON funding_calls(open_at, close_at)
    WHERE status = 'open';

-- Date-based queries for scheduling
CREATE INDEX idx_funding_calls_close_at ON funding_calls(close_at);
CREATE INDEX idx_funding_calls_open_at ON funding_calls(open_at);

-- Created by coordinator
CREATE INDEX idx_funding_calls_created_by ON funding_calls(created_by);

-- Full-text search on name and description
CREATE INDEX idx_funding_calls_search ON funding_calls
    USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- =============================================================================
-- APPLICATIONS INDEXES
-- =============================================================================

-- Call-based filtering (coordinator view)
CREATE INDEX idx_applications_call_id ON applications(call_id);

-- Status filtering
CREATE INDEX idx_applications_status ON applications(status);

-- Combined call + status (most common coordinator query)
CREATE INDEX idx_applications_call_status ON applications(call_id, status);

-- Applicant lookup
CREATE INDEX idx_applications_applicant_email ON applications(applicant_email);
CREATE INDEX idx_applications_applicant_id ON applications(applicant_id) WHERE applicant_id IS NOT NULL;

-- Reference number lookup
CREATE INDEX idx_applications_reference ON applications(reference_number);

-- Submission date ordering
CREATE INDEX idx_applications_submitted_at ON applications(submitted_at DESC)
    WHERE submitted_at IS NOT NULL;

-- Full-text search on applicant name
CREATE INDEX idx_applications_applicant_search ON applications
    USING gin(to_tsvector('english', applicant_name || ' ' || COALESCE(applicant_organisation, '')));

-- =============================================================================
-- APPLICATION FILES INDEXES
-- =============================================================================

-- Application lookup
CREATE INDEX idx_application_files_application_id ON application_files(application_id);

-- Scan status for processing queue
CREATE INDEX idx_application_files_scan_pending ON application_files(uploaded_at)
    WHERE scan_status = 'pending';

-- Primary files
CREATE INDEX idx_application_files_primary ON application_files(application_id)
    WHERE is_primary = TRUE;

-- Category filtering
CREATE INDEX idx_application_files_category ON application_files(application_id, category);

-- =============================================================================
-- CONFIRMATIONS INDEXES
-- =============================================================================

-- Application lookup
CREATE INDEX idx_confirmations_application_id ON confirmations(application_id);

-- Type filtering
CREATE INDEX idx_confirmations_type ON confirmations(type);

-- =============================================================================
-- ASSESSORS INDEXES
-- =============================================================================

-- Email lookup
CREATE INDEX idx_assessors_email ON assessors(email);

-- User account link
CREATE INDEX idx_assessors_user_id ON assessors(user_id) WHERE user_id IS NOT NULL;

-- Active assessors
CREATE INDEX idx_assessors_active ON assessors(name) WHERE is_active = TRUE;

-- Organisation filtering
CREATE INDEX idx_assessors_organisation ON assessors(organisation) WHERE organisation IS NOT NULL;

-- Expertise tags (GIN index for JSON array searching)
CREATE INDEX idx_assessors_expertise ON assessors USING gin(expertise_tags);

-- =============================================================================
-- CALL ASSESSOR POOL INDEXES
-- =============================================================================

-- Call lookup (get all assessors for a call)
CREATE INDEX idx_call_assessor_pool_call_id ON call_assessor_pool(call_id);

-- Assessor lookup (get all calls for an assessor)
CREATE INDEX idx_call_assessor_pool_assessor_id ON call_assessor_pool(assessor_id);

-- =============================================================================
-- ASSIGNMENTS INDEXES
-- =============================================================================

-- Application lookup
CREATE INDEX idx_assignments_application_id ON assignments(application_id);

-- Assessor lookup (assessor's workload)
CREATE INDEX idx_assignments_assessor_id ON assignments(assessor_id);

-- Status filtering
CREATE INDEX idx_assignments_status ON assignments(status);

-- Assessor + status (assessor's pending work)
CREATE INDEX idx_assignments_assessor_status ON assignments(assessor_id, status);

-- Due date ordering (deadline tracking)
CREATE INDEX idx_assignments_due_at ON assignments(due_at)
    WHERE due_at IS NOT NULL AND status IN ('assigned', 'in_progress');

-- Progress tracking (coordinator view)
CREATE INDEX idx_assignments_progress ON assignments(application_id, status);

-- =============================================================================
-- ASSESSMENTS INDEXES
-- =============================================================================

-- Assignment lookup
CREATE INDEX idx_assessments_assignment_id ON assessments(assignment_id);

-- Status filtering
CREATE INDEX idx_assessments_status ON assessments(status);

-- Submission date ordering
CREATE INDEX idx_assessments_submitted_at ON assessments(submitted_at DESC)
    WHERE submitted_at IS NOT NULL;

-- Overall score for ranking
CREATE INDEX idx_assessments_overall_score ON assessments(overall_score DESC)
    WHERE status = 'submitted';

-- Scores JSON indexing (for criterion-specific queries)
CREATE INDEX idx_assessments_scores ON assessments USING gin(scores_json);

-- =============================================================================
-- AUDIT LOGS INDEXES
-- =============================================================================

-- Time-based queries (most recent first)
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Actor filtering
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id) WHERE actor_id IS NOT NULL;

-- Action type filtering
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- Target filtering
CREATE INDEX idx_audit_logs_target ON audit_logs(target_type, target_id);

-- Combined time + action (common audit query pattern)
CREATE INDEX idx_audit_logs_action_time ON audit_logs(action, timestamp DESC);

-- Request correlation
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id) WHERE request_id IS NOT NULL;

-- IP address for security investigations
CREATE INDEX idx_audit_logs_ip ON audit_logs(ip_address) WHERE ip_address IS NOT NULL;

-- =============================================================================
-- NOTIFICATION LOGS INDEXES
-- =============================================================================

-- Recipient lookup
CREATE INDEX idx_notification_logs_recipient ON notification_logs(recipient_email);

-- Status tracking
CREATE INDEX idx_notification_logs_status ON notification_logs(status);

-- Type filtering
CREATE INDEX idx_notification_logs_type ON notification_logs(notification_type);

-- Application-related notifications
CREATE INDEX idx_notification_logs_application ON notification_logs(application_id)
    WHERE application_id IS NOT NULL;

-- Call-related notifications
CREATE INDEX idx_notification_logs_call ON notification_logs(call_id)
    WHERE call_id IS NOT NULL;

-- Time-based queries
CREATE INDEX idx_notification_logs_created ON notification_logs(created_at DESC);

-- =============================================================================
-- SESSIONS INDEXES
-- =============================================================================

-- User sessions
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Token lookup (authentication)
CREATE INDEX idx_sessions_token ON sessions(token_hash);

-- Active sessions cleanup
CREATE INDEX idx_sessions_expires ON sessions(expires_at)
    WHERE revoked_at IS NULL;

-- =============================================================================
-- COMPOSITE INDEXES FOR COMMON QUERIES
-- =============================================================================

-- Coordinator: Applications for a call with files and assignments count
CREATE INDEX idx_applications_coordinator_view ON applications(call_id, status, submitted_at DESC);

-- Assessor: My assignments with application info
CREATE INDEX idx_assignments_assessor_view ON assignments(assessor_id, status, assigned_at DESC);

-- Results: Submitted assessments with scores for aggregation
CREATE INDEX idx_assessments_results_view ON assessments(status, overall_score DESC)
    WHERE status = 'submitted';

-- =============================================================================
-- PARTIAL INDEXES FOR PERFORMANCE
-- =============================================================================

-- Only draft applications (for cleanup/reminder queries)
CREATE INDEX idx_applications_draft ON applications(call_id, updated_at)
    WHERE status = 'draft';

-- Only pending file scans (for scanner queue)
CREATE INDEX idx_files_pending_scan ON application_files(uploaded_at ASC)
    WHERE scan_status = 'pending';

-- Only active assessors (for assignment UI)
CREATE INDEX idx_assessors_active_list ON assessors(name, email)
    WHERE is_active = TRUE;

-- Outstanding assignments (for reminder emails)
CREATE INDEX idx_assignments_outstanding ON assignments(assessor_id, due_at)
    WHERE status IN ('assigned', 'in_progress');
