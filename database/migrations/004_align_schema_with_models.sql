-- Migration 004: Align database schema with application model layer
-- Fixes critical schema-model mismatch that prevents all write operations
-- Created: 2026-02-15

BEGIN;

-- =============================================================================
-- 0. DROP DEPENDENT VIEWS (will recreate after schema changes)
-- =============================================================================

DROP VIEW IF EXISTS users_with_nostr CASCADE;

-- =============================================================================
-- 1. USERS TABLE: Rename id, split name, add missing columns
-- =============================================================================

ALTER TABLE users RENAME COLUMN id TO user_id;

-- Split single 'name' column into first_name + last_name
ALTER TABLE users ADD COLUMN first_name VARCHAR(255);
ALTER TABLE users ADD COLUMN last_name VARCHAR(255);

UPDATE users SET
  first_name = CASE
    WHEN position(' ' IN name) > 0 THEN substring(name from 1 for position(' ' IN name) - 1)
    ELSE name
  END,
  last_name = CASE
    WHEN position(' ' IN name) > 0 THEN substring(name from position(' ' IN name) + 1)
    ELSE ''
  END;

ALTER TABLE users ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE users ALTER COLUMN last_name SET NOT NULL;
ALTER TABLE users DROP COLUMN name;

-- Add missing columns
ALTER TABLE users ADD COLUMN organisation VARCHAR(255);
ALTER TABLE users ADD COLUMN expertise_tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- =============================================================================
-- 2. FUNDING_CALLS TABLE: Rename columns, add missing
-- =============================================================================

ALTER TABLE funding_calls RENAME COLUMN id TO call_id;
ALTER TABLE funding_calls RENAME COLUMN requirements TO submission_requirements;
ALTER TABLE funding_calls RENAME COLUMN criteria_config TO criteria;
ALTER TABLE funding_calls RENAME COLUMN retention_policy TO retention_years;

ALTER TABLE funding_calls ADD COLUMN required_assessors_per_application INTEGER NOT NULL DEFAULT 2;
ALTER TABLE funding_calls ADD COLUMN variance_threshold DECIMAL(5,2);

-- =============================================================================
-- 3. APPLICATIONS TABLE
-- =============================================================================

ALTER TABLE applications RENAME COLUMN id TO application_id;

-- =============================================================================
-- 4. APPLICATION_FILES TABLE
-- =============================================================================

ALTER TABLE application_files RENAME COLUMN id TO file_id;

-- =============================================================================
-- 5. CONFIRMATIONS TABLE
-- =============================================================================

ALTER TABLE confirmations RENAME COLUMN id TO confirmation_id;

-- =============================================================================
-- 6. ASSIGNMENTS TABLE
-- =============================================================================

ALTER TABLE assignments RENAME COLUMN id TO assignment_id;
ALTER TABLE assignments ADD COLUMN started_at TIMESTAMPTZ;
ALTER TABLE assignments ADD COLUMN completed_at TIMESTAMPTZ;

-- =============================================================================
-- 7. ASSESSMENTS TABLE
-- =============================================================================

ALTER TABLE assessments RENAME COLUMN id TO assessment_id;
ALTER TABLE assessments RENAME COLUMN scores_json TO scores;
ALTER TABLE assessments RENAME COLUMN comments TO overall_comment;
-- coi_details already exists in initial schema

-- =============================================================================
-- 8. RENAME call_assessor_pool → assessor_pool
-- =============================================================================

ALTER TABLE call_assessor_pool RENAME TO assessor_pool;
ALTER TABLE assessor_pool RENAME COLUMN id TO pool_id;

-- =============================================================================
-- 9. OTHER TABLES
-- =============================================================================

ALTER TABLE notification_logs RENAME COLUMN id TO notification_id;
ALTER TABLE sessions RENAME COLUMN id TO session_id;
-- nostr_auth_challenges already uses challenge_id

-- =============================================================================
-- 10. RECREATE VIEW with new column names
-- =============================================================================

CREATE VIEW users_with_nostr AS
SELECT
  u.user_id,
  u.email,
  u.first_name,
  u.last_name,
  u.role,
  u.is_active,
  ui.identity_id,
  ui.nostr_pubkey,
  ui.nip05_identifier,
  ui.nip05_verified,
  ui.did,
  ui.display_name AS nostr_display_name,
  ui.last_auth_at AS nostr_last_auth,
  ui.auth_count AS nostr_auth_count,
  ui.created_at AS identity_linked_at
FROM users u
LEFT JOIN user_identities ui ON u.user_id = ui.user_id
WHERE u.deleted_at IS NULL;

COMMENT ON VIEW users_with_nostr IS 'Users joined with Nostr identity information';

-- =============================================================================
-- 11. UPDATE FUNCTIONS
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_application_reference()
RETURNS TRIGGER AS $$
DECLARE
    call_name_prefix VARCHAR(10);
    year_part VARCHAR(4);
    seq_num INTEGER;
BEGIN
    SELECT UPPER(REGEXP_REPLACE(SUBSTRING(name FROM 1 FOR 4), '[^A-Z0-9]', '', 'g'))
    INTO call_name_prefix
    FROM funding_calls
    WHERE call_id = NEW.call_id;

    year_part := TO_CHAR(NOW(), 'YYYY');

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

COMMIT;
