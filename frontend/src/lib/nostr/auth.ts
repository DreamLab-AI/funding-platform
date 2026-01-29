// =============================================================================
// Nostr Authentication - NIP-98 HTTP Auth and Challenge-Response
// =============================================================================

import {
  NostrEvent,
  UnsignedNostrEvent,
  NostrEventKind,
  Nip98AuthPayload,
  NostrAuthChallenge,
  NostrLoginRequest,
  NostrLoginResponse,
} from './types';
import {
  createUnsignedEvent,
  signEventAuto,
  signEventWithExtension,
  verifyEvent,
  getEventTagValue,
  isEventInTimeWindow,
} from './events';
import { hasNostrExtension, getPublicKeyFromExtension, bytesToHex, hexToBytes } from './keys';
import { verifyNip05 } from './nip05';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const AUTH_EVENT_WINDOW_SECONDS = 60; // Events must be within 60 seconds
const CHALLENGE_EXPIRY_SECONDS = 300; // 5 minutes

// -----------------------------------------------------------------------------
// NIP-98 HTTP Authentication
// -----------------------------------------------------------------------------

/**
 * Create a NIP-98 HTTP Auth event for authenticating API requests
 * This event proves the user controls the private key
 */
export function createNip98AuthEvent(
  url: string,
  method: string,
  payload?: string,
  pubkey?: string
): UnsignedNostrEvent {
  const tags: [string, string][] = [
    ['u', url],
    ['method', method.toUpperCase()],
  ];

  // Add payload hash if present
  if (payload) {
    tags.push(['payload', payload]);
  }

  return createUnsignedEvent(NostrEventKind.HTTP_AUTH, '', tags, pubkey);
}

/**
 * Sign and create a NIP-98 auth header value
 */
export async function createNip98AuthHeader(
  url: string,
  method: string,
  payload?: string,
  privateKey?: string
): Promise<string> {
  let event = createNip98AuthEvent(url, method, payload);

  // If using extension, get pubkey first
  if (!privateKey && hasNostrExtension()) {
    const pubkey = await getPublicKeyFromExtension();
    event = { ...event, pubkey };
  }

  const signedEvent = await signEventAuto(event, privateKey);

  // Base64 encode the event for the Authorization header
  const eventJson = JSON.stringify(signedEvent);
  const encoded = btoa(eventJson);

  return `Nostr ${encoded}`;
}

/**
 * Parse NIP-98 Authorization header
 */
export function parseNip98AuthHeader(header: string): NostrEvent | null {
  if (!header.startsWith('Nostr ')) {
    return null;
  }

  try {
    const encoded = header.slice(6); // Remove "Nostr " prefix
    const decoded = atob(encoded);
    const event = JSON.parse(decoded);
    return event as NostrEvent;
  } catch {
    return null;
  }
}

/**
 * Verify a NIP-98 auth event
 */
export async function verifyNip98AuthEvent(
  event: NostrEvent,
  expectedUrl: string,
  expectedMethod: string
): Promise<{ valid: boolean; pubkey?: string; error?: string }> {
  // Check event kind
  if (event.kind !== NostrEventKind.HTTP_AUTH) {
    return { valid: false, error: 'Invalid event kind' };
  }

  // Check timestamp window
  if (!isEventInTimeWindow(event, AUTH_EVENT_WINDOW_SECONDS)) {
    return { valid: false, error: 'Event timestamp out of range' };
  }

  // Verify event signature
  const verification = await verifyEvent(event);
  if (!verification.valid) {
    return { valid: false, error: verification.errors.join(', ') };
  }

  // Check URL
  const eventUrl = getEventTagValue(event, 'u');
  if (!eventUrl) {
    return { valid: false, error: 'Missing URL tag' };
  }

  // Normalize URLs for comparison
  const normalizedExpected = new URL(expectedUrl).toString();
  const normalizedEvent = new URL(eventUrl).toString();
  if (normalizedExpected !== normalizedEvent) {
    return { valid: false, error: 'URL mismatch' };
  }

  // Check method
  const eventMethod = getEventTagValue(event, 'method');
  if (!eventMethod || eventMethod.toUpperCase() !== expectedMethod.toUpperCase()) {
    return { valid: false, error: 'Method mismatch' };
  }

  return { valid: true, pubkey: event.pubkey };
}

// -----------------------------------------------------------------------------
// Challenge-Response Authentication
// -----------------------------------------------------------------------------

/**
 * Generate an authentication challenge
 */
export async function generateAuthChallenge(relay?: string): Promise<NostrAuthChallenge> {
  const challengeBytes = new Uint8Array(32);
  crypto.getRandomValues(challengeBytes);

  const timestamp = Math.floor(Date.now() / 1000);

  return {
    challenge: bytesToHex(challengeBytes),
    timestamp,
    expiresAt: timestamp + CHALLENGE_EXPIRY_SECONDS,
    relay,
  };
}

/**
 * Create a challenge response event (kind:22242 AUTH event)
 */
export function createChallengeResponseEvent(
  challenge: string,
  relay: string,
  pubkey?: string
): UnsignedNostrEvent {
  return createUnsignedEvent(
    NostrEventKind.AUTH,
    '',
    [
      ['relay', relay],
      ['challenge', challenge],
    ],
    pubkey
  );
}

/**
 * Sign a challenge response
 */
export async function signChallengeResponse(
  challenge: NostrAuthChallenge,
  privateKey?: string
): Promise<NostrEvent> {
  let event = createChallengeResponseEvent(
    challenge.challenge,
    challenge.relay || 'https://auth.example.com'
  );

  if (!privateKey && hasNostrExtension()) {
    const pubkey = await getPublicKeyFromExtension();
    event = { ...event, pubkey };
  }

  return signEventAuto(event, privateKey);
}

/**
 * Verify a challenge response
 */
export async function verifyChallengeResponse(
  event: NostrEvent,
  challenge: NostrAuthChallenge
): Promise<{ valid: boolean; pubkey?: string; error?: string }> {
  // Check if challenge has expired
  const now = Math.floor(Date.now() / 1000);
  if (now > challenge.expiresAt) {
    return { valid: false, error: 'Challenge expired' };
  }

  // Check event kind
  if (event.kind !== NostrEventKind.AUTH) {
    return { valid: false, error: 'Invalid event kind' };
  }

  // Verify event signature
  const verification = await verifyEvent(event);
  if (!verification.valid) {
    return { valid: false, error: verification.errors.join(', ') };
  }

  // Check challenge tag
  const eventChallenge = getEventTagValue(event, 'challenge');
  if (eventChallenge !== challenge.challenge) {
    return { valid: false, error: 'Challenge mismatch' };
  }

  // Check relay tag if specified
  if (challenge.relay) {
    const eventRelay = getEventTagValue(event, 'relay');
    if (eventRelay !== challenge.relay) {
      return { valid: false, error: 'Relay mismatch' };
    }
  }

  // Check timestamp is reasonable
  if (!isEventInTimeWindow(event, CHALLENGE_EXPIRY_SECONDS)) {
    return { valid: false, error: 'Event timestamp out of range' };
  }

  return { valid: true, pubkey: event.pubkey };
}

// -----------------------------------------------------------------------------
// Login Flow
// -----------------------------------------------------------------------------

/**
 * Initiate Nostr login flow
 * Returns the challenge that needs to be signed
 */
export async function initiateNostrLogin(
  apiEndpoint: string
): Promise<NostrAuthChallenge> {
  const response = await fetch(`${apiEndpoint}/nostr/challenge`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get authentication challenge');
  }

  const data = await response.json();
  return data.data as NostrAuthChallenge;
}

/**
 * Complete Nostr login by submitting signed challenge
 */
export async function completeNostrLogin(
  apiEndpoint: string,
  signedEvent: NostrEvent,
  nip05?: string
): Promise<NostrLoginResponse> {
  const request: NostrLoginRequest = {
    pubkey: signedEvent.pubkey,
    signedEvent,
    nip05,
  };

  const response = await fetch(`${apiEndpoint}/nostr/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      error: data.error?.message || 'Login failed',
    };
  }

  return {
    success: true,
    user: data.data.user,
    accessToken: data.data.access_token,
    refreshToken: data.data.refresh_token,
  };
}

/**
 * Full Nostr login flow using browser extension
 */
export async function nostrLogin(
  apiEndpoint: string,
  nip05?: string
): Promise<NostrLoginResponse> {
  if (!hasNostrExtension()) {
    return {
      success: false,
      error: 'Nostr extension not found. Please install nos2x, Alby, or another NIP-07 extension.',
    };
  }

  try {
    // Get public key from extension
    const pubkey = await getPublicKeyFromExtension();

    // Verify NIP-05 if provided
    if (nip05) {
      const verified = await verifyNip05(nip05, pubkey);
      if (!verified) {
        return {
          success: false,
          error: 'NIP-05 verification failed',
        };
      }
    }

    // Get challenge from server
    const challenge = await initiateNostrLogin(apiEndpoint);

    // Create and sign the challenge response
    const event = createChallengeResponseEvent(
      challenge.challenge,
      challenge.relay || apiEndpoint,
      pubkey
    );

    const signedEvent = await signEventWithExtension(event);

    // Complete login
    return completeNostrLogin(apiEndpoint, signedEvent, nip05);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
    };
  }
}

// -----------------------------------------------------------------------------
// Link Nostr Identity to Existing Account
// -----------------------------------------------------------------------------

/**
 * Link Nostr identity to an existing account
 * Requires the user to be already authenticated
 */
export async function linkNostrIdentity(
  apiEndpoint: string,
  accessToken: string,
  nip05?: string
): Promise<{ success: boolean; error?: string }> {
  if (!hasNostrExtension()) {
    return {
      success: false,
      error: 'Nostr extension not found',
    };
  }

  try {
    const pubkey = await getPublicKeyFromExtension();

    // Get a challenge
    const challengeResponse = await fetch(`${apiEndpoint}/nostr/link-challenge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!challengeResponse.ok) {
      throw new Error('Failed to get link challenge');
    }

    const challenge = (await challengeResponse.json()).data as NostrAuthChallenge;

    // Sign the challenge
    const event = createChallengeResponseEvent(
      challenge.challenge,
      challenge.relay || apiEndpoint,
      pubkey
    );

    const signedEvent = await signEventWithExtension(event);

    // Submit the link request
    const linkResponse = await fetch(`${apiEndpoint}/nostr/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        pubkey,
        signedEvent,
        nip05,
      }),
    });

    const result = await linkResponse.json();

    if (!linkResponse.ok) {
      return {
        success: false,
        error: result.error?.message || 'Failed to link Nostr identity',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to link identity',
    };
  }
}

/**
 * Unlink Nostr identity from account
 */
export async function unlinkNostrIdentity(
  apiEndpoint: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${apiEndpoint}/nostr/unlink`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const result = await response.json();
      return {
        success: false,
        error: result.error?.message || 'Failed to unlink Nostr identity',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unlink identity',
    };
  }
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export {
  AUTH_EVENT_WINDOW_SECONDS,
  CHALLENGE_EXPIRY_SECONDS,
  createNip98AuthEvent,
  createNip98AuthHeader,
  parseNip98AuthHeader,
  verifyNip98AuthEvent,
  generateAuthChallenge,
  createChallengeResponseEvent,
  signChallengeResponse,
  verifyChallengeResponse,
  initiateNostrLogin,
  completeNostrLogin,
  nostrLogin,
  linkNostrIdentity,
  unlinkNostrIdentity,
};
