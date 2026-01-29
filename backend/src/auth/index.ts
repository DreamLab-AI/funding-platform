// =============================================================================
// Auth Module - Barrel Export
// =============================================================================

export * from './nostr.service';
export * from './did.service';
export * from './nostr.middleware';

// Re-export services as named exports
export { NostrService } from './nostr.service';
export { DIDService } from './did.service';
export { NostrMiddleware } from './nostr.middleware';
