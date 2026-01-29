// =============================================================================
// Nostr Authentication Service - Signature Verification and NIP-98 Tokens
// =============================================================================

import { createHash, randomBytes } from 'crypto';
import { query } from '../config/database';
import { generateUUID } from '../utils/helpers';
import { logger } from '../utils/logger';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: [string, ...string[]][];
  content: string;
  sig: string;
}

export interface NostrAuthChallenge {
  challenge: string;
  timestamp: number;
  expiresAt: number;
  relay?: string;
}

export interface NostrVerificationResult {
  valid: boolean;
  pubkey?: string;
  error?: string;
}

export interface UserIdentity {
  identity_id: string;
  user_id: string;
  nostr_pubkey: string;
  nip05_identifier?: string;
  nip05_verified: boolean;
  did: string;
  created_at: Date;
  updated_at: Date;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const AUTH_EVENT_KIND = 22242;
const HTTP_AUTH_EVENT_KIND = 27235;
const AUTH_WINDOW_SECONDS = 60;
const CHALLENGE_EXPIRY_SECONDS = 300;

// Challenge storage (in production, use Redis or database)
const pendingChallenges = new Map<string, NostrAuthChallenge>();

// -----------------------------------------------------------------------------
// Event Verification
// -----------------------------------------------------------------------------

/**
 * Calculate Nostr event ID (sha256 of serialized event)
 */
function calculateEventId(event: Omit<NostrEvent, 'id' | 'sig'>): string {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);

  return createHash('sha256').update(serialized).digest('hex');
}

/**
 * Verify Nostr event ID matches content
 */
function verifyEventId(event: NostrEvent): boolean {
  const calculatedId = calculateEventId({
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
  });

  return calculatedId === event.id;
}

/**
 * Verify Nostr event signature using secp256k1
 * Note: This requires @noble/secp256k1 or similar library
 */
async function verifyEventSignature(event: NostrEvent): Promise<boolean> {
  try {
    // Dynamic import to handle optional dependency
    const secp256k1 = await import('@noble/secp256k1');

    const messageHash = Buffer.from(event.id, 'hex');
    const signature = Buffer.from(event.sig, 'hex');
    const publicKey = Buffer.from(event.pubkey, 'hex');

    // secp256k1 schnorr signature verification
    return secp256k1.schnorr.verify(signature, messageHash, publicKey);
  } catch (error) {
    // Fallback: If secp256k1 not available, log warning
    logger.warn('secp256k1 library not available for signature verification');

    // In development, you might want to skip verification
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_NOSTR_SIG_VERIFY === 'true') {
      return true;
    }

    return false;
  }
}

/**
 * Verify a Nostr event (ID and signature)
 */
export async function verifyNostrEvent(event: NostrEvent): Promise<NostrVerificationResult> {
  // Validate basic structure
  if (!event.id || !event.pubkey || !event.sig) {
    return { valid: false, error: 'Missing required event fields' };
  }

  if (event.pubkey.length !== 64 || !/^[0-9a-f]{64}$/i.test(event.pubkey)) {
    return { valid: false, error: 'Invalid public key format' };
  }

  if (event.id.length !== 64 || !/^[0-9a-f]{64}$/i.test(event.id)) {
    return { valid: false, error: 'Invalid event ID format' };
  }

  if (event.sig.length !== 128 || !/^[0-9a-f]{128}$/i.test(event.sig)) {
    return { valid: false, error: 'Invalid signature format' };
  }

  // Verify ID
  if (!verifyEventId(event)) {
    return { valid: false, error: 'Event ID does not match content' };
  }

  // Verify timestamp is within acceptable window
  const now = Math.floor(Date.now() / 1000);
  if (event.created_at > now + 60) {
    return { valid: false, error: 'Event timestamp is in the future' };
  }

  if (event.created_at < now - AUTH_WINDOW_SECONDS) {
    return { valid: false, error: 'Event timestamp expired' };
  }

  // Verify signature
  const sigValid = await verifyEventSignature(event);
  if (!sigValid) {
    return { valid: false, error: 'Invalid signature' };
  }

  return { valid: true, pubkey: event.pubkey };
}

// -----------------------------------------------------------------------------
// Challenge-Response Authentication
// -----------------------------------------------------------------------------

/**
 * Generate an authentication challenge
 */
export function generateAuthChallenge(relay?: string): NostrAuthChallenge {
  const challengeBytes = randomBytes(32);
  const timestamp = Math.floor(Date.now() / 1000);

  const challenge: NostrAuthChallenge = {
    challenge: challengeBytes.toString('hex'),
    timestamp,
    expiresAt: timestamp + CHALLENGE_EXPIRY_SECONDS,
    relay,
  };

  // Store challenge for verification
  pendingChallenges.set(challenge.challenge, challenge);

  // Clean up expired challenges
  setTimeout(() => {
    pendingChallenges.delete(challenge.challenge);
  }, CHALLENGE_EXPIRY_SECONDS * 1000);

  return challenge;
}

/**
 * Verify a challenge response event
 */
export async function verifyChallengeResponse(
  event: NostrEvent,
  expectedChallenge?: string
): Promise<NostrVerificationResult> {
  // Verify event kind
  if (event.kind !== AUTH_EVENT_KIND) {
    return { valid: false, error: 'Invalid event kind for authentication' };
  }

  // Verify basic event validity
  const eventVerification = await verifyNostrEvent(event);
  if (!eventVerification.valid) {
    return eventVerification;
  }

  // Extract challenge from tags
  const challengeTag = event.tags.find(([name]) => name === 'challenge');
  if (!challengeTag || !challengeTag[1]) {
    return { valid: false, error: 'Missing challenge tag' };
  }

  const challenge = challengeTag[1];

  // Verify challenge exists and matches
  if (expectedChallenge && challenge !== expectedChallenge) {
    return { valid: false, error: 'Challenge mismatch' };
  }

  // Verify challenge is pending
  const pendingChallenge = pendingChallenges.get(challenge);
  if (!pendingChallenge) {
    return { valid: false, error: 'Challenge not found or expired' };
  }

  // Verify not expired
  const now = Math.floor(Date.now() / 1000);
  if (now > pendingChallenge.expiresAt) {
    pendingChallenges.delete(challenge);
    return { valid: false, error: 'Challenge expired' };
  }

  // Verify relay if specified
  if (pendingChallenge.relay) {
    const relayTag = event.tags.find(([name]) => name === 'relay');
    if (!relayTag || relayTag[1] !== pendingChallenge.relay) {
      return { valid: false, error: 'Relay mismatch' };
    }
  }

  // Clean up used challenge
  pendingChallenges.delete(challenge);

  return { valid: true, pubkey: event.pubkey };
}

// -----------------------------------------------------------------------------
// NIP-98 HTTP Authentication
// -----------------------------------------------------------------------------

/**
 * Parse NIP-98 Authorization header
 */
export function parseNip98Header(header: string): NostrEvent | null {
  if (!header.startsWith('Nostr ')) {
    return null;
  }

  try {
    const encoded = header.slice(6);
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return JSON.parse(decoded) as NostrEvent;
  } catch {
    return null;
  }
}

/**
 * Verify NIP-98 HTTP Auth event
 */
export async function verifyNip98Auth(
  event: NostrEvent,
  expectedUrl: string,
  expectedMethod: string
): Promise<NostrVerificationResult> {
  // Verify event kind
  if (event.kind !== HTTP_AUTH_EVENT_KIND) {
    return { valid: false, error: 'Invalid event kind for HTTP auth' };
  }

  // Verify basic event validity
  const eventVerification = await verifyNostrEvent(event);
  if (!eventVerification.valid) {
    return eventVerification;
  }

  // Extract URL from tags
  const urlTag = event.tags.find(([name]) => name === 'u');
  if (!urlTag || !urlTag[1]) {
    return { valid: false, error: 'Missing URL tag' };
  }

  // Normalize and compare URLs
  try {
    const eventUrl = new URL(urlTag[1]).toString();
    const expected = new URL(expectedUrl).toString();

    if (eventUrl !== expected) {
      return { valid: false, error: 'URL mismatch' };
    }
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Extract and verify method
  const methodTag = event.tags.find(([name]) => name === 'method');
  if (!methodTag || !methodTag[1]) {
    return { valid: false, error: 'Missing method tag' };
  }

  if (methodTag[1].toUpperCase() !== expectedMethod.toUpperCase()) {
    return { valid: false, error: 'Method mismatch' };
  }

  return { valid: true, pubkey: event.pubkey };
}

// -----------------------------------------------------------------------------
// User Identity Management
// -----------------------------------------------------------------------------

/**
 * Find user identity by Nostr pubkey
 */
export async function findIdentityByPubkey(pubkey: string): Promise<UserIdentity | null> {
  const result = await query<UserIdentity>(
    'SELECT * FROM user_identities WHERE nostr_pubkey = $1',
    [pubkey.toLowerCase()]
  );
  return result.rows[0] || null;
}

/**
 * Find user identity by user ID
 */
export async function findIdentityByUserId(userId: string): Promise<UserIdentity | null> {
  const result = await query<UserIdentity>(
    'SELECT * FROM user_identities WHERE user_id = $1',
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Create user identity link
 */
export async function createUserIdentity(
  userId: string,
  pubkey: string,
  nip05?: string,
  nip05Verified: boolean = false
): Promise<UserIdentity> {
  const identityId = generateUUID();
  const did = `did:nostr:${pubkey.toLowerCase()}`;

  const result = await query<UserIdentity>(
    `INSERT INTO user_identities (
      identity_id, user_id, nostr_pubkey, nip05_identifier, nip05_verified, did
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [identityId, userId, pubkey.toLowerCase(), nip05 || null, nip05Verified, did]
  );

  logger.info('Created Nostr identity link', { userId, pubkey: pubkey.substring(0, 16) + '...' });

  return result.rows[0];
}

/**
 * Update user identity NIP-05 verification
 */
export async function updateIdentityNip05(
  identityId: string,
  nip05: string,
  verified: boolean
): Promise<UserIdentity | null> {
  const result = await query<UserIdentity>(
    `UPDATE user_identities
     SET nip05_identifier = $2, nip05_verified = $3,
         nip05_verified_at = CASE WHEN $3 = TRUE THEN NOW() ELSE nip05_verified_at END,
         updated_at = NOW()
     WHERE identity_id = $1
     RETURNING *`,
    [identityId, nip05, verified]
  );
  return result.rows[0] || null;
}

/**
 * Update identity last auth timestamp (triggers auth_count increment via DB trigger)
 */
export async function updateIdentityLastAuth(identityId: string): Promise<void> {
  await query(
    `UPDATE user_identities SET last_auth_at = NOW() WHERE identity_id = $1`,
    [identityId]
  );
}

/**
 * Delete user identity link
 */
export async function deleteUserIdentity(userId: string): Promise<void> {
  await query('DELETE FROM user_identities WHERE user_id = $1', [userId]);
  logger.info('Deleted Nostr identity link', { userId });
}

/**
 * Check if pubkey is already linked to another user
 */
export async function isPubkeyLinked(pubkey: string, excludeUserId?: string): Promise<boolean> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) FROM user_identities
     WHERE nostr_pubkey = $1 ${excludeUserId ? 'AND user_id != $2' : ''}`,
    excludeUserId ? [pubkey.toLowerCase(), excludeUserId] : [pubkey.toLowerCase()]
  );
  return parseInt(result.rows[0].count, 10) > 0;
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export const NostrService = {
  verifyNostrEvent,
  generateAuthChallenge,
  verifyChallengeResponse,
  parseNip98Header,
  verifyNip98Auth,
  findIdentityByPubkey,
  findIdentityByUserId,
  createUserIdentity,
  updateIdentityNip05,
  updateIdentityLastAuth,
  deleteUserIdentity,
  isPubkeyLinked,
};

export default NostrService;
