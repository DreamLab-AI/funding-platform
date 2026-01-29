// =============================================================================
// NIP-05 - DNS-Based Nostr Identifier Verification
// =============================================================================

import { Nip05Response, Nip05Identifier } from './types';
import { isValidPubkey } from './keys';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const NIP05_TIMEOUT_MS = 10000;
const NIP05_CACHE_TTL_MS = 300000; // 5 minutes

// Simple in-memory cache
const nip05Cache = new Map<string, { result: Nip05Identifier | null; timestamp: number }>();

// -----------------------------------------------------------------------------
// NIP-05 Identifier Parsing
// -----------------------------------------------------------------------------

/**
 * Parse a NIP-05 identifier into local part and domain
 * Formats: "name@domain.com" or "_@domain.com" (for domain-only)
 */
export function parseNip05Identifier(identifier: string): {
  localPart: string;
  domain: string;
} | null {
  const trimmed = identifier.trim().toLowerCase();

  // Handle special case: domain-only (implicit "_")
  if (!trimmed.includes('@')) {
    // Check if it's a valid domain
    if (isValidDomain(trimmed)) {
      return { localPart: '_', domain: trimmed };
    }
    return null;
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return null;
  }

  const [localPart, domain] = parts;

  // Validate local part (alphanumeric, underscore, hyphen)
  if (!localPart || !/^[a-z0-9_-]+$/.test(localPart)) {
    return null;
  }

  // Validate domain
  if (!isValidDomain(domain)) {
    return null;
  }

  return { localPart, domain };
}

/**
 * Basic domain validation
 */
function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > 253) {
    return false;
  }

  // Simple domain pattern check
  const domainPattern = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/;
  return domainPattern.test(domain);
}

/**
 * Format a NIP-05 identifier
 */
export function formatNip05Identifier(localPart: string, domain: string): string {
  if (localPart === '_') {
    return domain;
  }
  return `${localPart}@${domain}`;
}

// -----------------------------------------------------------------------------
// NIP-05 Verification
// -----------------------------------------------------------------------------

/**
 * Construct the .well-known URL for NIP-05 verification
 */
export function getNip05Url(localPart: string, domain: string): string {
  return `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(localPart)}`;
}

/**
 * Fetch NIP-05 verification data from a domain
 */
export async function fetchNip05(
  localPart: string,
  domain: string
): Promise<Nip05Response | null> {
  const url = getNip05Url(localPart, domain);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NIP05_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // Validate response structure
    if (!data || typeof data !== 'object' || !data.names || typeof data.names !== 'object') {
      return null;
    }

    return data as Nip05Response;
  } catch (error) {
    // Network error, timeout, or invalid JSON
    return null;
  }
}

/**
 * Verify a NIP-05 identifier resolves to a specific pubkey
 */
export async function verifyNip05(
  identifier: string,
  expectedPubkey?: string,
  useCache: boolean = true
): Promise<Nip05Identifier | null> {
  // Check cache first
  if (useCache) {
    const cached = nip05Cache.get(identifier);
    if (cached && Date.now() - cached.timestamp < NIP05_CACHE_TTL_MS) {
      return cached.result;
    }
  }

  // Parse identifier
  const parsed = parseNip05Identifier(identifier);
  if (!parsed) {
    return null;
  }

  const { localPart, domain } = parsed;

  // Fetch NIP-05 data
  const nip05Data = await fetchNip05(localPart, domain);
  if (!nip05Data) {
    // Cache negative result
    if (useCache) {
      nip05Cache.set(identifier, { result: null, timestamp: Date.now() });
    }
    return null;
  }

  // Look up the pubkey for this name
  const pubkey = nip05Data.names[localPart];
  if (!pubkey || !isValidPubkey(pubkey)) {
    if (useCache) {
      nip05Cache.set(identifier, { result: null, timestamp: Date.now() });
    }
    return null;
  }

  // If expected pubkey provided, verify it matches
  if (expectedPubkey && pubkey.toLowerCase() !== expectedPubkey.toLowerCase()) {
    if (useCache) {
      nip05Cache.set(identifier, { result: null, timestamp: Date.now() });
    }
    return null;
  }

  // Get relays for this pubkey
  const relays = nip05Data.relays?.[pubkey];

  const result: Nip05Identifier = {
    identifier: formatNip05Identifier(localPart, domain),
    localPart,
    domain,
    pubkey: pubkey.toLowerCase(),
    relays: relays || undefined,
    verified: true,
    verifiedAt: Date.now(),
  };

  // Cache positive result
  if (useCache) {
    nip05Cache.set(identifier, { result, timestamp: Date.now() });
  }

  return result;
}

/**
 * Lookup pubkey by NIP-05 identifier (reverse lookup)
 */
export async function lookupPubkeyByNip05(identifier: string): Promise<string | null> {
  const result = await verifyNip05(identifier);
  return result?.pubkey || null;
}

/**
 * Get relays for a pubkey from NIP-05 verification
 */
export async function getNip05Relays(identifier: string): Promise<string[] | null> {
  const result = await verifyNip05(identifier);
  return result?.relays || null;
}

// -----------------------------------------------------------------------------
// NIP-05 Discovery
// -----------------------------------------------------------------------------

/**
 * Search for NIP-05 identifiers by domain
 * Note: Most domains only expose individual names, not full lists
 */
export async function discoverNip05ByDomain(domain: string): Promise<Nip05Response | null> {
  // Try fetching with the "_" wildcard name
  return fetchNip05('_', domain);
}

/**
 * Check if a domain supports NIP-05
 */
export async function domainSupportsNip05(domain: string): Promise<boolean> {
  try {
    const url = `https://${domain}/.well-known/nostr.json`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NIP05_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// Cache Management
// -----------------------------------------------------------------------------

/**
 * Clear the NIP-05 verification cache
 */
export function clearNip05Cache(): void {
  nip05Cache.clear();
}

/**
 * Remove a specific entry from the cache
 */
export function removeFromNip05Cache(identifier: string): void {
  nip05Cache.delete(identifier);
}

/**
 * Get cache statistics
 */
export function getNip05CacheStats(): {
  size: number;
  entries: { identifier: string; age: number; verified: boolean }[];
} {
  const now = Date.now();
  const entries: { identifier: string; age: number; verified: boolean }[] = [];

  for (const [identifier, cached] of nip05Cache.entries()) {
    entries.push({
      identifier,
      age: now - cached.timestamp,
      verified: cached.result?.verified || false,
    });
  }

  return {
    size: nip05Cache.size,
    entries,
  };
}

// -----------------------------------------------------------------------------
// Validation Helpers
// -----------------------------------------------------------------------------

/**
 * Check if a string looks like a NIP-05 identifier
 */
export function looksLikeNip05(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();

  // Could be domain-only or name@domain
  if (trimmed.includes('@')) {
    const parts = trimmed.split('@');
    return parts.length === 2 && parts[1].includes('.');
  }

  // Check if it's just a domain
  return trimmed.includes('.') && !trimmed.startsWith('npub') && !trimmed.startsWith('nprofile');
}

/**
 * Extract NIP-05 identifier from profile metadata
 */
export function extractNip05FromProfile(profile: Record<string, unknown>): string | null {
  const nip05 = profile.nip05;
  if (typeof nip05 === 'string' && looksLikeNip05(nip05)) {
    return nip05;
  }
  return null;
}

// All functions already exported inline with 'export' keyword
