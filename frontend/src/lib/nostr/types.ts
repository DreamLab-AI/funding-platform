// =============================================================================
// Nostr Types - NIP-01 Event Types and DID Document Interfaces
// =============================================================================

// -----------------------------------------------------------------------------
// Nostr Core Types (NIP-01)
// -----------------------------------------------------------------------------

/**
 * Nostr event kinds as defined in NIPs
 */
export enum NostrEventKind {
  METADATA = 0,           // NIP-01: User metadata
  TEXT_NOTE = 1,          // NIP-01: Plain text note
  RECOMMEND_RELAY = 2,    // NIP-01: Recommend relay
  CONTACTS = 3,           // NIP-02: Contact list
  ENCRYPTED_DM = 4,       // NIP-04: Encrypted direct message
  DELETE = 5,             // NIP-09: Event deletion
  REPOST = 6,             // NIP-18: Repost
  REACTION = 7,           // NIP-25: Reaction
  AUTH = 22242,           // NIP-42: Client authentication
  HTTP_AUTH = 27235,      // NIP-98: HTTP Auth
  ZAP_REQUEST = 9734,     // NIP-57: Lightning Zaps
  ZAP_RECEIPT = 9735,     // NIP-57: Zap receipt
}

/**
 * Nostr event tag tuple
 * Common formats:
 * - ['e', <event-id>, <relay-url>, <marker>]
 * - ['p', <pubkey>, <relay-url>]
 * - ['a', <kind>:<pubkey>:<d-tag>, <relay-url>]
 */
export type NostrTag = [string, ...string[]];

/**
 * Unsigned Nostr event (before signing)
 */
export interface UnsignedNostrEvent {
  kind: NostrEventKind | number;
  content: string;
  tags: NostrTag[];
  created_at: number;
  pubkey?: string;
}

/**
 * Signed Nostr event (NIP-01)
 */
export interface NostrEvent extends UnsignedNostrEvent {
  id: string;
  pubkey: string;
  sig: string;
}

/**
 * Nostr filter for querying events (NIP-01)
 */
export interface NostrFilter {
  ids?: string[];
  authors?: string[];
  kinds?: number[];
  '#e'?: string[];
  '#p'?: string[];
  '#a'?: string[];
  '#d'?: string[];
  since?: number;
  until?: number;
  limit?: number;
  search?: string;
}

/**
 * Relay message types
 */
export type NostrRelayMessage =
  | ['EVENT', string, NostrEvent]
  | ['OK', string, boolean, string]
  | ['EOSE', string]
  | ['CLOSED', string, string]
  | ['NOTICE', string]
  | ['AUTH', string];

/**
 * Client message types
 */
export type NostrClientMessage =
  | ['EVENT', NostrEvent]
  | ['REQ', string, ...NostrFilter[]]
  | ['CLOSE', string]
  | ['AUTH', NostrEvent];

// -----------------------------------------------------------------------------
// Nostr Profile Metadata (NIP-01 kind:0)
// -----------------------------------------------------------------------------

/**
 * User profile metadata stored in kind:0 events
 */
export interface NostrProfileMetadata {
  name?: string;
  about?: string;
  picture?: string;
  banner?: string;
  nip05?: string;
  lud06?: string;
  lud16?: string;
  website?: string;
  display_name?: string;
  [key: string]: string | undefined;
}

// -----------------------------------------------------------------------------
// NIP-05 Identifier
// -----------------------------------------------------------------------------

/**
 * NIP-05 DNS-based verification response
 */
export interface Nip05Response {
  names: {
    [name: string]: string; // name -> pubkey hex
  };
  relays?: {
    [pubkey: string]: string[]; // pubkey -> relay URLs
  };
}

/**
 * Verified NIP-05 identifier
 */
export interface Nip05Identifier {
  identifier: string;        // e.g., "alice@example.com"
  localPart: string;         // e.g., "alice"
  domain: string;            // e.g., "example.com"
  pubkey: string;            // hex pubkey
  relays?: string[];
  verified: boolean;
  verifiedAt?: number;
}

// -----------------------------------------------------------------------------
// NIP-98 HTTP Auth
// -----------------------------------------------------------------------------

/**
 * NIP-98 HTTP Auth event payload
 */
export interface Nip98AuthPayload {
  url: string;
  method: string;
  payload?: string;
}

/**
 * NIP-98 HTTP Auth event (kind:27235)
 */
export interface Nip98AuthEvent extends NostrEvent {
  kind: NostrEventKind.HTTP_AUTH;
}

// -----------------------------------------------------------------------------
// DID Document Types (did:nostr method)
// -----------------------------------------------------------------------------

/**
 * DID verification method
 */
export interface DIDVerificationMethod {
  id: string;
  type: string;
  controller: string;
  publicKeyMultibase?: string;
  publicKeyHex?: string;
}

/**
 * DID service endpoint
 */
export interface DIDService {
  id: string;
  type: string;
  serviceEndpoint: string | string[] | Record<string, string>;
}

/**
 * DID Document for Nostr-based identity (did:nostr:pubkey)
 */
export interface NostrDIDDocument {
  '@context': string[];
  id: string;                              // did:nostr:<pubkey-hex>
  alsoKnownAs?: string[];                  // NIP-05 identifiers
  verificationMethod: DIDVerificationMethod[];
  authentication: (string | DIDVerificationMethod)[];
  assertionMethod?: (string | DIDVerificationMethod)[];
  keyAgreement?: (string | DIDVerificationMethod)[];
  capabilityInvocation?: (string | DIDVerificationMethod)[];
  capabilityDelegation?: (string | DIDVerificationMethod)[];
  service?: DIDService[];
}

/**
 * DID resolution result
 */
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

// -----------------------------------------------------------------------------
// Nostr Identity Types
// -----------------------------------------------------------------------------

/**
 * Nostr keypair
 */
export interface NostrKeypair {
  privateKey: string;  // hex
  publicKey: string;   // hex
  nsec?: string;       // bech32 encoded private key
  npub?: string;       // bech32 encoded public key
}

/**
 * Nostr identity with optional verification
 */
export interface NostrIdentity {
  pubkey: string;
  npub: string;
  profile?: NostrProfileMetadata;
  nip05?: Nip05Identifier;
  did: string;
  didDocument?: NostrDIDDocument;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Browser extension window interface (NIP-07)
 */
export interface NostrWindowExtension {
  getPublicKey(): Promise<string>;
  signEvent(event: UnsignedNostrEvent): Promise<NostrEvent>;
  getRelays?(): Promise<Record<string, { read: boolean; write: boolean }>>;
  nip04?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
  nip44?: {
    encrypt(pubkey: string, plaintext: string): Promise<string>;
    decrypt(pubkey: string, ciphertext: string): Promise<string>;
  };
}

// Extend Window interface for NIP-07
declare global {
  interface Window {
    nostr?: NostrWindowExtension;
  }
}

// -----------------------------------------------------------------------------
// Authentication Types
// -----------------------------------------------------------------------------

/**
 * Nostr authentication challenge
 */
export interface NostrAuthChallenge {
  challenge: string;
  timestamp: number;
  expiresAt: number;
  relay?: string;
}

/**
 * Nostr login request
 */
export interface NostrLoginRequest {
  pubkey: string;
  signedEvent: NostrEvent;
  nip05?: string;
}

/**
 * Nostr login response
 */
export interface NostrLoginResponse {
  success: boolean;
  user?: {
    id: string;
    email?: string;
    name?: string;
    nostrPubkey: string;
    nip05?: string;
    did: string;
  };
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

/**
 * Link Nostr identity to existing account
 */
export interface LinkNostrRequest {
  pubkey: string;
  signedEvent: NostrEvent;
  nip05?: string;
}

// -----------------------------------------------------------------------------
// Relay Connection Types
// -----------------------------------------------------------------------------

/**
 * Relay connection status
 */
export enum RelayConnectionStatus {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

/**
 * Relay connection info
 */
export interface RelayConnection {
  url: string;
  status: RelayConnectionStatus;
  socket?: WebSocket;
  subscriptions: Map<string, NostrFilter[]>;
  lastError?: string;
  connectedAt?: number;
  disconnectedAt?: number;
}

/**
 * Relay pool configuration
 */
export interface RelayPoolConfig {
  relays: string[];
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

// -----------------------------------------------------------------------------
// Export all types
// -----------------------------------------------------------------------------

// All types and enums already exported inline with 'export' keyword
