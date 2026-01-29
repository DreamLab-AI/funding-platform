// =============================================================================
// DID Service - Resolve and Cache DID Documents
// =============================================================================

import { logger } from '../utils/logger';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface DIDVerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyHex?: string;
  publicKeyMultibase?: string;
}

export interface DIDService {
  id: string;
  type: string;
  serviceEndpoint: string | Record<string, string>;
}

export interface NostrDIDDocument {
  '@context': string[];
  id: string;
  alsoKnownAs?: string[];
  verificationMethod: DIDVerificationMethod[];
  authentication: (string | DIDVerificationMethod)[];
  assertionMethod?: (string | DIDVerificationMethod)[];
  keyAgreement?: (string | DIDVerificationMethod)[];
  capabilityInvocation?: (string | DIDVerificationMethod)[];
  capabilityDelegation?: (string | DIDVerificationMethod)[];
  service?: DIDService[];
}

export interface DIDResolutionResult {
  didDocument: NostrDIDDocument | null;
  didDocumentMetadata: {
    created?: string;
    updated?: string;
    deactivated?: boolean;
    versionId?: string;
  };
  didResolutionMetadata: {
    contentType?: string;
    error?: string;
    errorMessage?: string;
  };
}

export interface Nip05VerificationResult {
  verified: boolean;
  pubkey?: string;
  identifier?: string;
  domain?: string;
  relays?: string[];
  error?: string;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DID_METHOD = 'nostr';
const DID_CONTEXT = [
  'https://www.w3.org/ns/did/v1',
  'https://w3id.org/security/suites/secp256k1-2019/v1',
];

const NIP05_TIMEOUT_MS = 10000;
const DID_CACHE_TTL_MS = 300000; // 5 minutes

// Simple in-memory cache (use Redis in production)
const didCache = new Map<string, { document: NostrDIDDocument; timestamp: number }>();
const nip05Cache = new Map<string, { result: Nip05VerificationResult; timestamp: number }>();

// -----------------------------------------------------------------------------
// DID Utilities
// -----------------------------------------------------------------------------

/**
 * Validate a hex public key
 */
export function isValidPubkey(pubkey: string): boolean {
  return typeof pubkey === 'string' && /^[0-9a-f]{64}$/i.test(pubkey);
}

/**
 * Generate DID from Nostr public key
 */
export function pubkeyToDid(pubkey: string): string {
  if (!isValidPubkey(pubkey)) {
    throw new Error('Invalid public key');
  }
  return `did:${DID_METHOD}:${pubkey.toLowerCase()}`;
}

/**
 * Extract public key from Nostr DID
 */
export function didToPubkey(did: string): string {
  const prefix = `did:${DID_METHOD}:`;
  if (!did.startsWith(prefix)) {
    throw new Error('Invalid Nostr DID format');
  }

  const pubkey = did.slice(prefix.length);
  if (!isValidPubkey(pubkey)) {
    throw new Error('Invalid public key in DID');
  }

  return pubkey;
}

/**
 * Check if a string is a valid Nostr DID
 */
export function isValidNostrDid(did: string): boolean {
  try {
    didToPubkey(did);
    return true;
  } catch {
    return false;
  }
}

// -----------------------------------------------------------------------------
// NIP-05 Verification
// -----------------------------------------------------------------------------

/**
 * Parse NIP-05 identifier into local part and domain
 */
export function parseNip05Identifier(identifier: string): {
  localPart: string;
  domain: string;
} | null {
  const trimmed = identifier.trim().toLowerCase();

  if (!trimmed.includes('@')) {
    // Domain-only (implicit "_")
    if (/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(trimmed)) {
      return { localPart: '_', domain: trimmed };
    }
    return null;
  }

  const parts = trimmed.split('@');
  if (parts.length !== 2) {
    return null;
  }

  const [localPart, domain] = parts;

  if (!localPart || !/^[a-z0-9_-]+$/.test(localPart)) {
    return null;
  }

  if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain)) {
    return null;
  }

  return { localPart, domain };
}

/**
 * Verify NIP-05 identifier resolves to expected pubkey
 */
export async function verifyNip05(
  identifier: string,
  expectedPubkey?: string,
  useCache: boolean = true
): Promise<Nip05VerificationResult> {
  // Check cache
  if (useCache) {
    const cached = nip05Cache.get(identifier);
    if (cached && Date.now() - cached.timestamp < DID_CACHE_TTL_MS) {
      return cached.result;
    }
  }

  // Parse identifier
  const parsed = parseNip05Identifier(identifier);
  if (!parsed) {
    return { verified: false, error: 'Invalid NIP-05 identifier format' };
  }

  const { localPart, domain } = parsed;
  const url = `https://${domain}/.well-known/nostr.json?name=${encodeURIComponent(localPart)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), NIP05_TIMEOUT_MS);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const result: Nip05VerificationResult = {
        verified: false,
        error: `HTTP ${response.status}`,
      };
      if (useCache) {
        nip05Cache.set(identifier, { result, timestamp: Date.now() });
      }
      return result;
    }

    const data = await response.json();

    if (!data || typeof data !== 'object' || !data.names || typeof data.names !== 'object') {
      const result: Nip05VerificationResult = {
        verified: false,
        error: 'Invalid NIP-05 response format',
      };
      if (useCache) {
        nip05Cache.set(identifier, { result, timestamp: Date.now() });
      }
      return result;
    }

    const pubkey = data.names[localPart];
    if (!pubkey || !isValidPubkey(pubkey)) {
      const result: Nip05VerificationResult = {
        verified: false,
        error: 'Name not found in NIP-05 response',
      };
      if (useCache) {
        nip05Cache.set(identifier, { result, timestamp: Date.now() });
      }
      return result;
    }

    // If expected pubkey provided, verify it matches
    if (expectedPubkey && pubkey.toLowerCase() !== expectedPubkey.toLowerCase()) {
      const result: Nip05VerificationResult = {
        verified: false,
        error: 'Pubkey mismatch',
      };
      if (useCache) {
        nip05Cache.set(identifier, { result, timestamp: Date.now() });
      }
      return result;
    }

    const relays = data.relays?.[pubkey];

    const result: Nip05VerificationResult = {
      verified: true,
      pubkey: pubkey.toLowerCase(),
      identifier: localPart === '_' ? domain : `${localPart}@${domain}`,
      domain,
      relays: relays || undefined,
    };

    if (useCache) {
      nip05Cache.set(identifier, { result, timestamp: Date.now() });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Network error';
    const result: Nip05VerificationResult = {
      verified: false,
      error: errorMessage,
    };
    if (useCache) {
      nip05Cache.set(identifier, { result, timestamp: Date.now() });
    }
    return result;
  }
}

// -----------------------------------------------------------------------------
// DID Document Generation
// -----------------------------------------------------------------------------

/**
 * Generate a DID Document from Nostr public key
 */
export function generateDIDDocument(
  pubkey: string,
  options?: {
    nip05?: Nip05VerificationResult;
    relays?: string[];
  }
): NostrDIDDocument {
  if (!isValidPubkey(pubkey)) {
    throw new Error('Invalid public key');
  }

  const did = pubkeyToDid(pubkey);

  const verificationMethod: DIDVerificationMethod = {
    id: `${did}#keys-1`,
    type: 'EcdsaSecp256k1VerificationKey2019',
    controller: did,
    publicKeyHex: pubkey.toLowerCase(),
  };

  const document: NostrDIDDocument = {
    '@context': DID_CONTEXT,
    id: did,
    verificationMethod: [verificationMethod],
    authentication: [`${did}#keys-1`],
    assertionMethod: [`${did}#keys-1`],
  };

  // Add alsoKnownAs
  const alsoKnownAs: string[] = [];

  // Add npub format
  // Note: This would require bech32 encoding - simplified here
  alsoKnownAs.push(`nostr:npub...${pubkey.substring(0, 8)}`);

  if (options?.nip05?.verified && options.nip05.identifier) {
    alsoKnownAs.push(`nip05:${options.nip05.identifier}`);
  }

  if (alsoKnownAs.length > 0) {
    document.alsoKnownAs = alsoKnownAs;
  }

  // Add services
  const services: DIDService[] = [];

  if (options?.relays && options.relays.length > 0) {
    services.push({
      id: `${did}#nostr-relays`,
      type: 'NostrRelayService',
      serviceEndpoint: options.relays.length === 1 ? options.relays[0] : options.relays,
    });
  }

  if (options?.nip05?.verified && options.nip05.domain) {
    services.push({
      id: `${did}#nip05-verification`,
      type: 'Nip05VerificationService',
      serviceEndpoint: `https://${options.nip05.domain}/.well-known/nostr.json`,
    });
  }

  if (services.length > 0) {
    document.service = services;
  }

  return document;
}

// -----------------------------------------------------------------------------
// DID Resolution
// -----------------------------------------------------------------------------

/**
 * Resolve a Nostr DID to its DID Document
 */
export async function resolveNostrDid(
  did: string,
  options?: {
    verifyNip05?: boolean;
    relays?: string[];
  }
): Promise<DIDResolutionResult> {
  // Parse and validate the DID
  let pubkey: string;
  try {
    pubkey = didToPubkey(did);
  } catch (error) {
    return {
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: {
        error: 'invalidDid',
        errorMessage: error instanceof Error ? error.message : 'Invalid DID format',
      },
    };
  }

  // Check cache
  const cached = didCache.get(did);
  if (cached && Date.now() - cached.timestamp < DID_CACHE_TTL_MS) {
    return {
      didDocument: cached.document,
      didDocumentMetadata: {
        created: new Date(cached.timestamp).toISOString(),
      },
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    };
  }

  try {
    // Generate document
    const document = generateDIDDocument(pubkey, {
      relays: options?.relays,
    });

    // Cache the result
    didCache.set(did, { document, timestamp: Date.now() });

    return {
      didDocument: document,
      didDocumentMetadata: {
        created: new Date().toISOString(),
      },
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    };
  } catch (error) {
    return {
      didDocument: null,
      didDocumentMetadata: {},
      didResolutionMetadata: {
        error: 'notFound',
        errorMessage: error instanceof Error ? error.message : 'Resolution failed',
      },
    };
  }
}

/**
 * Verify a DID Document matches expected public key
 */
export function verifyDIDDocument(
  document: NostrDIDDocument,
  expectedPubkey: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check DID format
  const expectedDid = pubkeyToDid(expectedPubkey);
  if (document.id !== expectedDid) {
    errors.push(`DID mismatch: expected ${expectedDid}, got ${document.id}`);
  }

  // Check context
  if (!Array.isArray(document['@context']) || document['@context'].length === 0) {
    errors.push('Missing @context');
  }

  // Check verification methods
  if (!document.verificationMethod || document.verificationMethod.length === 0) {
    errors.push('No verification methods');
  } else {
    const hasMatchingKey = document.verificationMethod.some(
      (vm) => vm.publicKeyHex?.toLowerCase() === expectedPubkey.toLowerCase()
    );
    if (!hasMatchingKey) {
      errors.push('No verification method matches the expected public key');
    }
  }

  // Check authentication
  if (!document.authentication || document.authentication.length === 0) {
    errors.push('No authentication methods');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// -----------------------------------------------------------------------------
// Cache Management
// -----------------------------------------------------------------------------

/**
 * Clear all DID caches
 */
export function clearDIDCaches(): void {
  didCache.clear();
  nip05Cache.clear();
  logger.debug('Cleared DID caches');
}

/**
 * Clear specific DID from cache
 */
export function clearDIDFromCache(did: string): void {
  didCache.delete(did);
}

/**
 * Clear specific NIP-05 from cache
 */
export function clearNip05FromCache(identifier: string): void {
  nip05Cache.delete(identifier);
}

/**
 * Get cache statistics
 */
export function getDIDCacheStats(): {
  didCacheSize: number;
  nip05CacheSize: number;
} {
  return {
    didCacheSize: didCache.size,
    nip05CacheSize: nip05Cache.size,
  };
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export const DIDService = {
  isValidPubkey,
  pubkeyToDid,
  didToPubkey,
  isValidNostrDid,
  parseNip05Identifier,
  verifyNip05,
  generateDIDDocument,
  resolveNostrDid,
  verifyDIDDocument,
  clearDIDCaches,
  clearDIDFromCache,
  clearNip05FromCache,
  getDIDCacheStats,
};

export default DIDService;
