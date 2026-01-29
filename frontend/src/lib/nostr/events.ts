// =============================================================================
// Nostr Events - Event Creation, Signing, and Verification (NIP-01)
// =============================================================================

import {
  NostrEvent,
  UnsignedNostrEvent,
  NostrEventKind,
  NostrTag,
  NostrWindowExtension,
} from './types';
import {
  hexToBytes,
  bytesToHex,
  getNostrExtension,
  hasNostrExtension,
  importSecp256k1,
} from './keys';

// -----------------------------------------------------------------------------
// Event ID Calculation
// -----------------------------------------------------------------------------

/**
 * Calculate event ID (sha256 of serialized event)
 * Event ID = sha256([0, pubkey, created_at, kind, tags, content])
 */
export async function calculateEventId(event: UnsignedNostrEvent & { pubkey: string }): Promise<string> {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);

  const encoder = new TextEncoder();
  const data = encoder.encode(serialized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);

  return bytesToHex(hashArray);
}

/**
 * Verify event ID is correctly calculated
 */
export async function verifyEventId(event: NostrEvent): Promise<boolean> {
  const calculatedId = await calculateEventId({
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
  });

  return calculatedId === event.id;
}

// -----------------------------------------------------------------------------
// Event Signing
// -----------------------------------------------------------------------------

/**
 * Sign an event with a private key
 */
export async function signEvent(
  event: UnsignedNostrEvent & { pubkey: string },
  privateKey: string
): Promise<NostrEvent> {
  const id = await calculateEventId(event);
  const { sign } = await importSecp256k1();

  const idBytes = hexToBytes(id);
  const signature = await sign(idBytes, privateKey);

  return {
    ...event,
    id,
    sig: bytesToHex(signature),
  };
}

/**
 * Sign an event using NIP-07 browser extension
 */
export async function signEventWithExtension(
  event: UnsignedNostrEvent
): Promise<NostrEvent> {
  const nostr = getNostrExtension();
  if (!nostr) {
    throw new Error('Nostr extension not found');
  }

  return nostr.signEvent(event);
}

/**
 * Sign an event using either extension or private key
 */
export async function signEventAuto(
  event: UnsignedNostrEvent,
  privateKey?: string
): Promise<NostrEvent> {
  if (privateKey) {
    if (!event.pubkey) {
      throw new Error('Event must have pubkey when signing with private key');
    }
    return signEvent(event as UnsignedNostrEvent & { pubkey: string }, privateKey);
  }

  if (hasNostrExtension()) {
    return signEventWithExtension(event);
  }

  throw new Error('No signing method available');
}

// -----------------------------------------------------------------------------
// Signature Verification
// -----------------------------------------------------------------------------

/**
 * Verify event signature
 */
export async function verifyEventSignature(event: NostrEvent): Promise<boolean> {
  try {
    // First verify the ID
    const idValid = await verifyEventId(event);
    if (!idValid) {
      return false;
    }

    // Then verify the signature
    const { verify } = await importSecp256k1();
    const idBytes = hexToBytes(event.id);
    const sigBytes = hexToBytes(event.sig);

    return verify(sigBytes, idBytes, event.pubkey);
  } catch {
    return false;
  }
}

/**
 * Verify event is valid (ID, signature, and basic structure)
 */
export async function verifyEvent(event: NostrEvent): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];

  // Check required fields
  if (!event.id || typeof event.id !== 'string' || event.id.length !== 64) {
    errors.push('Invalid event ID');
  }
  if (!event.pubkey || typeof event.pubkey !== 'string' || event.pubkey.length !== 64) {
    errors.push('Invalid pubkey');
  }
  if (typeof event.created_at !== 'number' || event.created_at < 0) {
    errors.push('Invalid created_at');
  }
  if (typeof event.kind !== 'number' || event.kind < 0) {
    errors.push('Invalid kind');
  }
  if (!Array.isArray(event.tags)) {
    errors.push('Invalid tags');
  }
  if (typeof event.content !== 'string') {
    errors.push('Invalid content');
  }
  if (!event.sig || typeof event.sig !== 'string' || event.sig.length !== 128) {
    errors.push('Invalid signature');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Verify ID
  const idValid = await verifyEventId(event);
  if (!idValid) {
    errors.push('Event ID does not match content');
  }

  // Verify signature
  const sigValid = await verifyEventSignature(event);
  if (!sigValid) {
    errors.push('Invalid signature');
  }

  return { valid: errors.length === 0, errors };
}

// -----------------------------------------------------------------------------
// Event Creation Helpers
// -----------------------------------------------------------------------------

/**
 * Create an unsigned event template
 */
export function createUnsignedEvent(
  kind: NostrEventKind | number,
  content: string,
  tags: NostrTag[] = [],
  pubkey?: string
): UnsignedNostrEvent {
  return {
    kind,
    content,
    tags,
    created_at: Math.floor(Date.now() / 1000),
    pubkey,
  };
}

/**
 * Create a metadata event (kind:0)
 */
export function createMetadataEvent(
  metadata: Record<string, string | undefined>,
  pubkey?: string
): UnsignedNostrEvent {
  // Filter out undefined values
  const cleanMetadata: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) {
      cleanMetadata[key] = value;
    }
  }

  return createUnsignedEvent(
    NostrEventKind.METADATA,
    JSON.stringify(cleanMetadata),
    [],
    pubkey
  );
}

/**
 * Create a text note event (kind:1)
 */
export function createTextNoteEvent(
  content: string,
  replyTo?: { eventId: string; pubkey: string; relay?: string },
  mentions?: { pubkey: string; relay?: string }[],
  pubkey?: string
): UnsignedNostrEvent {
  const tags: NostrTag[] = [];

  if (replyTo) {
    tags.push(['e', replyTo.eventId, replyTo.relay || '', 'reply']);
    tags.push(['p', replyTo.pubkey, replyTo.relay || '']);
  }

  if (mentions) {
    for (const mention of mentions) {
      tags.push(['p', mention.pubkey, mention.relay || '']);
    }
  }

  return createUnsignedEvent(NostrEventKind.TEXT_NOTE, content, tags, pubkey);
}

/**
 * Create an authentication event (kind:22242) for NIP-42
 */
export function createAuthEvent(
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

// -----------------------------------------------------------------------------
// Tag Helpers
// -----------------------------------------------------------------------------

/**
 * Get tags of a specific type from an event
 */
export function getEventTags(event: NostrEvent | UnsignedNostrEvent, tagName: string): NostrTag[] {
  return event.tags.filter((tag) => tag[0] === tagName);
}

/**
 * Get first tag value of a specific type
 */
export function getEventTagValue(
  event: NostrEvent | UnsignedNostrEvent,
  tagName: string
): string | undefined {
  const tag = event.tags.find((t) => t[0] === tagName);
  return tag?.[1];
}

/**
 * Get all tag values of a specific type
 */
export function getEventTagValues(
  event: NostrEvent | UnsignedNostrEvent,
  tagName: string
): string[] {
  return event.tags
    .filter((tag) => tag[0] === tagName)
    .map((tag) => tag[1])
    .filter((v): v is string => v !== undefined);
}

/**
 * Check if event has a specific tag
 */
export function hasEventTag(
  event: NostrEvent | UnsignedNostrEvent,
  tagName: string,
  tagValue?: string
): boolean {
  if (tagValue === undefined) {
    return event.tags.some((tag) => tag[0] === tagName);
  }
  return event.tags.some((tag) => tag[0] === tagName && tag[1] === tagValue);
}

/**
 * Add a tag to an event (returns new event, doesn't mutate)
 */
export function addEventTag(
  event: UnsignedNostrEvent,
  tag: NostrTag
): UnsignedNostrEvent {
  return {
    ...event,
    tags: [...event.tags, tag],
  };
}

/**
 * Remove tags of a specific type from an event
 */
export function removeEventTags(
  event: UnsignedNostrEvent,
  tagName: string
): UnsignedNostrEvent {
  return {
    ...event,
    tags: event.tags.filter((tag) => tag[0] !== tagName),
  };
}

// -----------------------------------------------------------------------------
// Event Validation
// -----------------------------------------------------------------------------

/**
 * Check if event is expired (has expiration tag)
 */
export function isEventExpired(event: NostrEvent | UnsignedNostrEvent): boolean {
  const expiration = getEventTagValue(event, 'expiration');
  if (!expiration) {
    return false;
  }

  const expirationTime = parseInt(expiration, 10);
  return !isNaN(expirationTime) && expirationTime < Math.floor(Date.now() / 1000);
}

/**
 * Check if event timestamp is reasonable (not too far in future)
 */
export function isEventTimestampValid(
  event: NostrEvent | UnsignedNostrEvent,
  maxFutureSeconds: number = 60
): boolean {
  const now = Math.floor(Date.now() / 1000);
  return event.created_at <= now + maxFutureSeconds;
}

/**
 * Check if event is within a time window
 */
export function isEventInTimeWindow(
  event: NostrEvent | UnsignedNostrEvent,
  windowSeconds: number
): boolean {
  const now = Math.floor(Date.now() / 1000);
  return event.created_at >= now - windowSeconds && event.created_at <= now + 60;
}

// -----------------------------------------------------------------------------
// Event Serialization
// -----------------------------------------------------------------------------

/**
 * Serialize event for transmission
 */
export function serializeEvent(event: NostrEvent): string {
  return JSON.stringify(event);
}

/**
 * Deserialize event from JSON
 */
export function deserializeEvent(json: string): NostrEvent {
  const event = JSON.parse(json);

  if (!event || typeof event !== 'object') {
    throw new Error('Invalid event JSON');
  }

  return event as NostrEvent;
}

/**
 * Clone an event (deep copy)
 */
export function cloneEvent<T extends NostrEvent | UnsignedNostrEvent>(event: T): T {
  return JSON.parse(JSON.stringify(event));
}

// All functions already exported inline with 'export' keyword
