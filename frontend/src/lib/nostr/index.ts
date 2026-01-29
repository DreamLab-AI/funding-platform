// =============================================================================
// Nostr Library - Main Export
// =============================================================================

// Types
export * from './types';

// Key management
export {
  bech32Encode,
  bech32Decode,
  hexToBytes,
  bytesToHex,
  pubkeyToNpub,
  npubToPubkey,
  privkeyToNsec,
  nsecToPrivkey,
  eventIdToNote,
  noteToEventId,
  generatePrivateKey,
  derivePublicKey,
  generateKeypair,
  importKeypair,
  hasNostrExtension,
  getNostrExtension,
  getPublicKeyFromExtension,
  getRelaysFromExtension,
  isValidPubkey,
  isValidNpub,
  isValidPrivkey,
  isValidNsec,
  parseToHexPubkey,
  HRP,
} from './keys';

// Events
export {
  calculateEventId,
  verifyEventId,
  signEvent,
  signEventWithExtension,
  signEventAuto,
  verifyEventSignature,
  verifyEvent,
  createUnsignedEvent,
  createMetadataEvent,
  createTextNoteEvent,
  createAuthEvent,
  getEventTags,
  getEventTagValue,
  getEventTagValues,
  hasEventTag,
  addEventTag,
  removeEventTags,
  isEventExpired,
  isEventTimestampValid,
  isEventInTimeWindow,
  serializeEvent,
  deserializeEvent,
  cloneEvent,
} from './events';

// NIP-05
export {
  parseNip05Identifier,
  formatNip05Identifier,
  getNip05Url,
  fetchNip05,
  verifyNip05,
  lookupPubkeyByNip05,
  getNip05Relays,
  discoverNip05ByDomain,
  domainSupportsNip05,
  clearNip05Cache,
  removeFromNip05Cache,
  getNip05CacheStats,
  looksLikeNip05,
  extractNip05FromProfile,
} from './nip05';

// DID
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
} from './did';

// Authentication
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
} from './auth';
