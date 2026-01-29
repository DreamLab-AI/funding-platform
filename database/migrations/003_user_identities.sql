-- Funding Application Platform - User Identities (Nostr DID)
-- Migration 003: Nostr-based Decentralized Identity Integration
-- Created: 2026-01-29

-- =============================================================================
-- USER IDENTITIES TABLE
-- =============================================================================
-- Links users to their Nostr decentralized identities
-- Supports:
--   - NIP-01: Basic event types and signing
--   - NIP-05: DNS-based identity verification
--   - NIP-07: Browser extension integration
--   - NIP-19: Bech32 encoding (npub, nsec)
--   - NIP-98: HTTP Auth headers
--   - DID method: did:nostr:<pubkey>

CREATE TABLE user_identities (
    identity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Nostr public key (64-character hex string, secp256k1)
    nostr_pubkey VARCHAR(64) NOT NULL,

    -- NIP-05 identifier (e.g., "user@domain.com" or "_@domain.com")
    nip05_identifier VARCHAR(255),
    nip05_verified BOOLEAN NOT NULL DEFAULT FALSE,
    nip05_verified_at TIMESTAMPTZ,

    -- DID (Decentralized Identifier) - format: did:nostr:<pubkey>
    did VARCHAR(80) NOT NULL,

    -- Metadata (optional profile info from Nostr)
    display_name VARCHAR(255),
    profile_picture_url VARCHAR(500),
    banner_url VARCHAR(500),
    about TEXT,

    -- Relay preferences (JSON array of relay URLs)
    relays JSONB DEFAULT '[]'::jsonb,

    -- Security: Track key usage
    first_auth_at TIMESTAMPTZ,
    last_auth_at TIMESTAMPTZ,
    auth_count INTEGER NOT NULL DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT user_identities_pubkey_check CHECK (
        nostr_pubkey ~* '^[0-9a-f]{64}$'
    ),
    CONSTRAINT user_identities_did_check CHECK (
        did ~* '^did:nostr:[0-9a-f]{64}$'
    ),
    CONSTRAINT user_identities_nip05_check CHECK (
        nip05_identifier IS NULL OR
        nip05_identifier ~* '^[a-z0-9_-]+@[a-z0-9.-]+\.[a-z]{2,}$' OR
        nip05_identifier ~* '^_@[a-z0-9.-]+\.[a-z]{2,}$' OR
        nip05_identifier ~* '^[a-z0-9.-]+\.[a-z]{2,}$'
    ),

    -- Each user can only have one Nostr identity
    CONSTRAINT user_identities_user_unique UNIQUE (user_id),

    -- Each pubkey can only be linked to one user
    CONSTRAINT user_identities_pubkey_unique UNIQUE (nostr_pubkey),

    -- DID must be unique (derived from pubkey, but enforced separately)
    CONSTRAINT user_identities_did_unique UNIQUE (did)
);

COMMENT ON TABLE user_identities IS 'Links platform users to Nostr decentralized identities';
COMMENT ON COLUMN user_identities.nostr_pubkey IS '64-character hex secp256k1 public key (lowercase)';
COMMENT ON COLUMN user_identities.nip05_identifier IS 'NIP-05 DNS-based identifier (user@domain.com)';
COMMENT ON COLUMN user_identities.nip05_verified IS 'Whether NIP-05 identifier has been verified via DNS';
COMMENT ON COLUMN user_identities.did IS 'W3C DID in format did:nostr:<pubkey>';
COMMENT ON COLUMN user_identities.relays IS 'JSON array of preferred Nostr relay URLs';
COMMENT ON COLUMN user_identities.auth_count IS 'Number of times this identity was used for authentication';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- User lookup
CREATE INDEX idx_user_identities_user_id ON user_identities(user_id);

-- Public key lookup (for authentication)
CREATE INDEX idx_user_identities_pubkey ON user_identities(nostr_pubkey);

-- DID resolution
CREATE INDEX idx_user_identities_did ON user_identities(did);

-- NIP-05 lookup (case-insensitive)
CREATE INDEX idx_user_identities_nip05 ON user_identities(LOWER(nip05_identifier))
    WHERE nip05_identifier IS NOT NULL;

-- Verified NIP-05 identities
CREATE INDEX idx_user_identities_nip05_verified ON user_identities(nip05_identifier)
    WHERE nip05_verified = TRUE;

-- Recent authentication activity
CREATE INDEX idx_user_identities_last_auth ON user_identities(last_auth_at DESC)
    WHERE last_auth_at IS NOT NULL;

-- =============================================================================
-- TRIGGER: Updated At
-- =============================================================================

CREATE TRIGGER update_user_identities_updated_at
    BEFORE UPDATE ON user_identities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TRIGGER: Ensure DID matches pubkey
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_user_identity_did()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure DID is derived from pubkey
    IF NEW.did != 'did:nostr:' || LOWER(NEW.nostr_pubkey) THEN
        RAISE EXCEPTION 'DID must match format did:nostr:<pubkey>';
    END IF;

    -- Ensure pubkey is lowercase
    NEW.nostr_pubkey := LOWER(NEW.nostr_pubkey);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_user_identity_did
    BEFORE INSERT OR UPDATE ON user_identities
    FOR EACH ROW
    EXECUTE FUNCTION validate_user_identity_did();

-- =============================================================================
-- FUNCTION: Update auth tracking
-- =============================================================================

CREATE OR REPLACE FUNCTION update_identity_auth_tracking()
RETURNS TRIGGER AS $$
BEGIN
    -- Update auth tracking on authentication
    IF TG_OP = 'UPDATE' AND NEW.last_auth_at IS DISTINCT FROM OLD.last_auth_at THEN
        -- Set first_auth_at if not set
        IF NEW.first_auth_at IS NULL AND NEW.last_auth_at IS NOT NULL THEN
            NEW.first_auth_at := NEW.last_auth_at;
        END IF;

        -- Increment auth count
        NEW.auth_count := COALESCE(OLD.auth_count, 0) + 1;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_identity_auth_tracking
    BEFORE UPDATE ON user_identities
    FOR EACH ROW
    EXECUTE FUNCTION update_identity_auth_tracking();

-- =============================================================================
-- NOSTR AUTH CHALLENGES TABLE
-- =============================================================================
-- Stores pending authentication challenges for Nostr login flow
-- Challenges expire after 5 minutes (300 seconds)

CREATE TABLE nostr_auth_challenges (
    challenge_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Challenge string (64-character hex)
    challenge VARCHAR(64) NOT NULL UNIQUE,

    -- Optional relay for NIP-42 compatibility
    relay VARCHAR(500),

    -- Expiration
    expires_at TIMESTAMPTZ NOT NULL,

    -- Tracking
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    used_by_pubkey VARCHAR(64),

    -- IP tracking for security
    created_ip INET,

    CONSTRAINT nostr_auth_challenges_check CHECK (
        challenge ~* '^[0-9a-f]{64}$'
    )
);

COMMENT ON TABLE nostr_auth_challenges IS 'Pending Nostr authentication challenges (short-lived)';
COMMENT ON COLUMN nostr_auth_challenges.challenge IS '64-character hex challenge string';
COMMENT ON COLUMN nostr_auth_challenges.relay IS 'Optional relay URL for NIP-42 verification';
COMMENT ON COLUMN nostr_auth_challenges.expires_at IS 'Challenge expiration (typically 5 minutes)';

-- Index for challenge lookup
CREATE INDEX idx_nostr_challenges_challenge ON nostr_auth_challenges(challenge);

-- Index for cleanup of expired challenges
CREATE INDEX idx_nostr_challenges_expires ON nostr_auth_challenges(expires_at)
    WHERE used_at IS NULL;

-- =============================================================================
-- CLEANUP: Remove expired challenges
-- =============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_nostr_challenges()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM nostr_auth_challenges
    WHERE expires_at < NOW() - INTERVAL '1 hour'
    OR (used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 day');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_nostr_challenges() IS 'Removes expired or used Nostr auth challenges';

-- =============================================================================
-- VIEW: Users with Nostr identities
-- =============================================================================

CREATE OR REPLACE VIEW users_with_nostr AS
SELECT
    u.id AS user_id,
    u.email,
    u.name,
    u.role,
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
LEFT JOIN user_identities ui ON u.id = ui.user_id
WHERE u.deleted_at IS NULL;

COMMENT ON VIEW users_with_nostr IS 'Combines user data with Nostr identity information';

-- =============================================================================
-- AUDIT LOG: Extend actions for Nostr
-- =============================================================================
-- Note: No schema changes needed, just documenting expected audit actions:
--   - 'nostr_identity_linked': User linked a Nostr identity
--   - 'nostr_identity_unlinked': User unlinked their Nostr identity
--   - 'nostr_login': User logged in via Nostr signature
--   - 'nostr_nip05_verified': NIP-05 verification completed
--   - 'nostr_challenge_created': Auth challenge generated
--   - 'nostr_challenge_verified': Auth challenge verified

