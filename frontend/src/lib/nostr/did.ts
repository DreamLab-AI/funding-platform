// =============================================================================
// Nostr DID Document Generation (did:nostr method)
// =============================================================================

import {
  NostrDIDDocument,
  DIDVerificationMethod,
  DIDService,
  DIDResolutionResult,
  NostrIdentity,
  NostrProfileMetadata,
  Nip05Identifier,
} from './types';
import { pubkeyToNpub, isValidPubkey } from './keys';
import { verifyNip05 } from './nip05';

// -----------------------------------------------------------------------------
// DID Method Constants
// -----------------------------------------------------------------------------

const DID_METHOD = 'nostr';
const DID_CONTEXT = [
  'https://www.w3.org/ns/did/v1',
  'https://w3id.org/security/suites/secp256k1-2019/v1',
];

// -----------------------------------------------------------------------------
// DID Generation
// -----------------------------------------------------------------------------

/**
 * Generate DID from Nostr public key
 * Format: did:nostr:<pubkey-hex>
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
// DID Document Creation
// -----------------------------------------------------------------------------

/**
 * Create a basic verification method for the DID
 */
function createVerificationMethod(pubkey: string, did: string): DIDVerificationMethod {
  return {
    id: `${did}#keys-1`,
    type: 'EcdsaSecp256k1VerificationKey2019',
    controller: did,
    publicKeyHex: pubkey,
  };
}

/**
 * Create Nostr relay service endpoint
 */
function createRelayService(did: string, relays: string[]): DIDService {
  return {
    id: `${did}#nostr-relays`,
    type: 'NostrRelayService',
    serviceEndpoint: relays.length === 1 ? relays[0] : relays,
  };
}

/**
 * Create NIP-05 verification service endpoint
 */
function createNip05Service(did: string, nip05: Nip05Identifier): DIDService {
  return {
    id: `${did}#nip05-verification`,
    type: 'Nip05VerificationService',
    serviceEndpoint: `https://${nip05.domain}/.well-known/nostr.json?name=${encodeURIComponent(nip05.localPart)}`,
  };
}

/**
 * Create Lightning payment service endpoint
 */
function createLightningService(did: string, lud16: string): DIDService {
  // Parse lightning address
  const parts = lud16.split('@');
  if (parts.length === 2) {
    return {
      id: `${did}#lightning`,
      type: 'LightningAddressService',
      serviceEndpoint: `https://${parts[1]}/.well-known/lnurlp/${parts[0]}`,
    };
  }

  // Fallback for lud06 (LNURL)
  return {
    id: `${did}#lightning`,
    type: 'LNURLService',
    serviceEndpoint: lud16,
  };
}

/**
 * Generate a DID Document from Nostr public key and optional metadata
 */
export function generateDIDDocument(
  pubkey: string,
  options?: {
    profile?: NostrProfileMetadata;
    nip05?: Nip05Identifier;
    relays?: string[];
  }
): NostrDIDDocument {
  if (!isValidPubkey(pubkey)) {
    throw new Error('Invalid public key');
  }

  const did = pubkeyToDid(pubkey);
  const verificationMethod = createVerificationMethod(pubkey, did);

  const document: NostrDIDDocument = {
    '@context': DID_CONTEXT,
    id: did,
    verificationMethod: [verificationMethod],
    authentication: [`${did}#keys-1`],
    assertionMethod: [`${did}#keys-1`],
  };

  // Add alsoKnownAs from NIP-05 and npub
  const alsoKnownAs: string[] = [];
  const npub = pubkeyToNpub(pubkey);
  alsoKnownAs.push(`nostr:${npub}`);

  if (options?.nip05?.verified) {
    alsoKnownAs.push(`nip05:${options.nip05.identifier}`);
  }

  if (alsoKnownAs.length > 0) {
    document.alsoKnownAs = alsoKnownAs;
  }

  // Add services
  const services: DIDService[] = [];

  if (options?.relays && options.relays.length > 0) {
    services.push(createRelayService(did, options.relays));
  }

  if (options?.nip05?.verified) {
    services.push(createNip05Service(did, options.nip05));
  }

  const profile = options?.profile;
  if (profile) {
    // Lightning address service
    if (profile.lud16) {
      services.push(createLightningService(did, profile.lud16));
    } else if (profile.lud06) {
      services.push(createLightningService(did, profile.lud06));
    }

    // Website service
    if (profile.website) {
      services.push({
        id: `${did}#website`,
        type: 'LinkedDomains',
        serviceEndpoint: profile.website,
      });
    }
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
    fetchProfile?: boolean;
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

  try {
    // For basic resolution, we can generate the document directly
    // More advanced resolution would fetch the profile from relays

    let profile: NostrProfileMetadata | undefined;
    let nip05: Nip05Identifier | undefined;

    // If we have relays and want to fetch the profile, we'd do that here
    // For now, we generate a basic document

    const document = generateDIDDocument(pubkey, {
      profile,
      nip05,
      relays: options?.relays,
    });

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

// -----------------------------------------------------------------------------
// Nostr Identity Creation
// -----------------------------------------------------------------------------

/**
 * Create a NostrIdentity object from a public key
 */
export async function createNostrIdentity(
  pubkey: string,
  options?: {
    profile?: NostrProfileMetadata;
    nip05Identifier?: string;
    relays?: string[];
  }
): Promise<NostrIdentity> {
  if (!isValidPubkey(pubkey)) {
    throw new Error('Invalid public key');
  }

  const npub = pubkeyToNpub(pubkey);
  const did = pubkeyToDid(pubkey);

  let nip05: Nip05Identifier | undefined;

  // Verify NIP-05 if provided
  if (options?.nip05Identifier) {
    nip05 = await verifyNip05(options.nip05Identifier, pubkey) || undefined;
  }

  // Also check profile for NIP-05
  if (!nip05 && options?.profile?.nip05) {
    nip05 = await verifyNip05(options.profile.nip05, pubkey) || undefined;
  }

  // Generate DID document
  const didDocument = generateDIDDocument(pubkey, {
    profile: options?.profile,
    nip05,
    relays: options?.relays,
  });

  return {
    pubkey,
    npub,
    profile: options?.profile,
    nip05,
    did,
    didDocument,
    createdAt: Date.now(),
  };
}

/**
 * Update a NostrIdentity with new profile data
 */
export async function updateNostrIdentity(
  identity: NostrIdentity,
  updates: {
    profile?: NostrProfileMetadata;
    relays?: string[];
  }
): Promise<NostrIdentity> {
  const profile = updates.profile || identity.profile;

  // Re-verify NIP-05 if profile changed
  let nip05 = identity.nip05;
  if (updates.profile?.nip05 && updates.profile.nip05 !== identity.profile?.nip05) {
    nip05 = await verifyNip05(updates.profile.nip05, identity.pubkey) || undefined;
  }

  // Regenerate DID document
  const didDocument = generateDIDDocument(identity.pubkey, {
    profile,
    nip05,
    relays: updates.relays,
  });

  return {
    ...identity,
    profile,
    nip05,
    didDocument,
    updatedAt: Date.now(),
  };
}

// -----------------------------------------------------------------------------
// DID Document Verification
// -----------------------------------------------------------------------------

/**
 * Verify that a DID Document is valid for a given public key
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
      (vm) => vm.publicKeyHex === expectedPubkey
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

/**
 * Extract the public key from a DID Document
 */
export function extractPubkeyFromDIDDocument(document: NostrDIDDocument): string | null {
  // First, try to get it from the DID itself
  try {
    return didToPubkey(document.id);
  } catch {
    // Fall through
  }

  // Try to get it from verification methods
  for (const vm of document.verificationMethod || []) {
    if (vm.publicKeyHex && isValidPubkey(vm.publicKeyHex)) {
      return vm.publicKeyHex;
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export {
  DID_METHOD,
  DID_CONTEXT,
  pubkeyToDid,
  didToPubkey,
  isValidNostrDid,
  generateDIDDocument,
  resolveNostrDid,
  createNostrIdentity,
  updateNostrIdentity,
  verifyDIDDocument,
  extractPubkeyFromDIDDocument,
};
