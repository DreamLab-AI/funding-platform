/**
 * DID Service Unit Tests
 * Tests DID resolution, NIP-05 verification, and document generation
 */

import {
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
} from '../../../src/auth/did.service';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DID Service', () => {
  // Valid 64-character hex pubkey
  const validPubkey = 'a'.repeat(64);
  const validDid = `did:nostr:${'a'.repeat(64)}`;

  beforeEach(() => {
    jest.clearAllMocks();
    clearDIDCaches();
    mockFetch.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('isValidPubkey', () => {
    it('should return true for valid 64-char hex pubkey', () => {
      expect(isValidPubkey(validPubkey)).toBe(true);
    });

    it('should return true for uppercase hex', () => {
      expect(isValidPubkey('A'.repeat(64))).toBe(true);
    });

    it('should return true for mixed case hex', () => {
      expect(isValidPubkey('aAbBcCdDeEfF' + 'a'.repeat(52))).toBe(true);
    });

    it('should return false for too short', () => {
      expect(isValidPubkey('a'.repeat(63))).toBe(false);
    });

    it('should return false for too long', () => {
      expect(isValidPubkey('a'.repeat(65))).toBe(false);
    });

    it('should return false for non-hex characters', () => {
      expect(isValidPubkey('g'.repeat(64))).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidPubkey('')).toBe(false);
    });

    it('should return false for non-string types', () => {
      expect(isValidPubkey(null as any)).toBe(false);
      expect(isValidPubkey(undefined as any)).toBe(false);
      expect(isValidPubkey(123 as any)).toBe(false);
    });
  });

  describe('pubkeyToDid', () => {
    it('should convert valid pubkey to DID', () => {
      expect(pubkeyToDid(validPubkey)).toBe(validDid);
    });

    it('should normalize to lowercase', () => {
      expect(pubkeyToDid('A'.repeat(64))).toBe(validDid);
    });

    it('should throw for invalid pubkey', () => {
      expect(() => pubkeyToDid('invalid')).toThrow('Invalid public key');
    });
  });

  describe('didToPubkey', () => {
    it('should extract pubkey from valid DID', () => {
      expect(didToPubkey(validDid)).toBe(validPubkey);
    });

    it('should throw for non-nostr DID', () => {
      expect(() => didToPubkey('did:key:123')).toThrow(
        'Invalid Nostr DID format'
      );
    });

    it('should throw for invalid pubkey in DID', () => {
      expect(() => didToPubkey('did:nostr:invalid')).toThrow(
        'Invalid public key in DID'
      );
    });

    it('should throw for empty DID', () => {
      expect(() => didToPubkey('')).toThrow('Invalid Nostr DID format');
    });
  });

  describe('isValidNostrDid', () => {
    it('should return true for valid Nostr DID', () => {
      expect(isValidNostrDid(validDid)).toBe(true);
    });

    it('should return false for invalid DID', () => {
      expect(isValidNostrDid('did:key:123')).toBe(false);
      expect(isValidNostrDid('invalid')).toBe(false);
      expect(isValidNostrDid('')).toBe(false);
    });
  });

  describe('parseNip05Identifier', () => {
    it('should parse standard user@domain format', () => {
      const result = parseNip05Identifier('user@example.com');

      expect(result).toEqual({
        localPart: 'user',
        domain: 'example.com',
      });
    });

    it('should parse domain-only format with implicit _', () => {
      const result = parseNip05Identifier('example.com');

      expect(result).toEqual({
        localPart: '_',
        domain: 'example.com',
      });
    });

    it('should normalize to lowercase', () => {
      const result = parseNip05Identifier('User@Example.COM');

      expect(result).toEqual({
        localPart: 'user',
        domain: 'example.com',
      });
    });

    it('should allow hyphens in local part', () => {
      const result = parseNip05Identifier('user-name@example.com');

      expect(result).toEqual({
        localPart: 'user-name',
        domain: 'example.com',
      });
    });

    it('should allow underscores in local part', () => {
      const result = parseNip05Identifier('user_name@example.com');

      expect(result).toEqual({
        localPart: 'user_name',
        domain: 'example.com',
      });
    });

    it('should handle subdomains', () => {
      const result = parseNip05Identifier('user@sub.example.com');

      expect(result).toEqual({
        localPart: 'user',
        domain: 'sub.example.com',
      });
    });

    it('should return null for empty string', () => {
      expect(parseNip05Identifier('')).toBeNull();
    });

    it('should return null for multiple @ signs', () => {
      expect(parseNip05Identifier('user@@example.com')).toBeNull();
      expect(parseNip05Identifier('user@domain@example.com')).toBeNull();
    });

    it('should return null for invalid characters in local part', () => {
      expect(parseNip05Identifier('user.name@example.com')).toBeNull();
      expect(parseNip05Identifier('user+name@example.com')).toBeNull();
    });

    it('should return null for invalid domain', () => {
      expect(parseNip05Identifier('user@.com')).toBeNull();
      expect(parseNip05Identifier('user@example')).toBeNull();
      expect(parseNip05Identifier('user@-example.com')).toBeNull();
    });
  });

  describe('verifyNip05', () => {
    it('should verify valid NIP-05 identifier', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          names: { user: validPubkey },
          relays: { [validPubkey]: ['wss://relay.example.com'] },
        }),
      });

      const result = await verifyNip05('user@example.com', undefined, false);

      expect(result.verified).toBe(true);
      expect(result.pubkey).toBe(validPubkey);
      expect(result.identifier).toBe('user@example.com');
      expect(result.domain).toBe('example.com');
      expect(result.relays).toContain('wss://relay.example.com');
    });

    it('should verify with expected pubkey match', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          names: { user: validPubkey },
        }),
      });

      const result = await verifyNip05('user@example.com', validPubkey, false);

      expect(result.verified).toBe(true);
    });

    it('should fail when pubkey mismatch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          names: { user: validPubkey },
        }),
      });

      const result = await verifyNip05('user@example.com', 'b'.repeat(64), false);

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Pubkey mismatch');
    });

    it('should return error for invalid identifier format', async () => {
      const result = await verifyNip05('invalid@@format', undefined, false);

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Invalid NIP-05 identifier format');
    });

    it('should return error for HTTP failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      const result = await verifyNip05('user@example.com', undefined, false);

      expect(result.verified).toBe(false);
      expect(result.error).toBe('HTTP 404');
    });

    it('should return error for invalid response format', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ invalid: 'response' }),
      });

      const result = await verifyNip05('user@example.com', undefined, false);

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Invalid NIP-05 response format');
    });

    it('should return error when name not found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          names: { otheruser: validPubkey },
        }),
      });

      const result = await verifyNip05('user@example.com', undefined, false);

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Name not found in NIP-05 response');
    });

    it('should return error on network failure', async () => {
      jest.useFakeTimers();
      mockFetch.mockRejectedValue(new Error('Network error'));

      const resultPromise = verifyNip05('user@example.com', undefined, false);
      jest.runAllTimers();
      const result = await resultPromise;

      expect(result.verified).toBe(false);
      expect(result.error).toBe('Network error');
    });

    it('should handle abort timeout', async () => {
      jest.useFakeTimers();

      mockFetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          const id = setTimeout(() => reject(new DOMException('Aborted', 'AbortError')), 10000);
          return () => clearTimeout(id);
        });
      });

      const resultPromise = verifyNip05('user@example.com', undefined, false);

      // Fast-forward timers
      jest.advanceTimersByTime(10000);
      jest.runAllTimers();

      const result = await resultPromise;

      expect(result.verified).toBe(false);
    });

    it('should use cache when enabled', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          names: { user: validPubkey },
        }),
      });

      // First call
      await verifyNip05('user@example.com', undefined, true);

      // Second call should use cache
      await verifyNip05('user@example.com', undefined, true);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle domain-only identifier', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          names: { _: validPubkey },
        }),
      });

      const result = await verifyNip05('example.com', undefined, false);

      expect(result.verified).toBe(true);
      expect(result.identifier).toBe('example.com');
    });
  });

  describe('generateDIDDocument', () => {
    it('should generate valid DID document', () => {
      const doc = generateDIDDocument(validPubkey);

      expect(doc).toMatchObject({
        '@context': expect.any(Array),
        id: validDid,
        verificationMethod: expect.any(Array),
        authentication: expect.any(Array),
      });
    });

    it('should include verification method with pubkey', () => {
      const doc = generateDIDDocument(validPubkey);

      expect(doc.verificationMethod[0]).toMatchObject({
        id: `${validDid}#keys-1`,
        type: 'EcdsaSecp256k1VerificationKey2019',
        controller: validDid,
        publicKeyHex: validPubkey,
      });
    });

    it('should include authentication reference', () => {
      const doc = generateDIDDocument(validPubkey);

      expect(doc.authentication).toContain(`${validDid}#keys-1`);
    });

    it('should include assertionMethod', () => {
      const doc = generateDIDDocument(validPubkey);

      expect(doc.assertionMethod).toContain(`${validDid}#keys-1`);
    });

    it('should include alsoKnownAs', () => {
      const doc = generateDIDDocument(validPubkey);

      expect(doc.alsoKnownAs).toBeDefined();
      expect(doc.alsoKnownAs!.length).toBeGreaterThan(0);
    });

    it('should include verified NIP-05 in alsoKnownAs', () => {
      const doc = generateDIDDocument(validPubkey, {
        nip05: { verified: true, identifier: 'user@example.com' },
      });

      expect(doc.alsoKnownAs).toContain('nip05:user@example.com');
    });

    it('should not include unverified NIP-05', () => {
      const doc = generateDIDDocument(validPubkey, {
        nip05: { verified: false },
      });

      expect(doc.alsoKnownAs?.find((a) => a.startsWith('nip05:'))).toBeUndefined();
    });

    it('should include relay service when provided', () => {
      const doc = generateDIDDocument(validPubkey, {
        relays: ['wss://relay.example.com'],
      });

      expect(doc.service).toBeDefined();
      expect(doc.service!.find((s) => s.type === 'NostrRelayService')).toBeDefined();
    });

    it('should include NIP-05 verification service', () => {
      const doc = generateDIDDocument(validPubkey, {
        nip05: { verified: true, domain: 'example.com' },
      });

      expect(
        doc.service!.find((s) => s.type === 'Nip05VerificationService')
      ).toBeDefined();
    });

    it('should throw for invalid pubkey', () => {
      expect(() => generateDIDDocument('invalid')).toThrow(
        'Invalid public key'
      );
    });
  });

  describe('resolveNostrDid', () => {
    it('should resolve valid Nostr DID', async () => {
      const result = await resolveNostrDid(validDid);

      expect(result.didDocument).toBeDefined();
      expect(result.didDocument!.id).toBe(validDid);
      expect(result.didResolutionMetadata.contentType).toBe(
        'application/did+ld+json'
      );
    });

    it('should return error for invalid DID format', async () => {
      const result = await resolveNostrDid('did:key:invalid');

      expect(result.didDocument).toBeNull();
      expect(result.didResolutionMetadata.error).toBe('invalidDid');
    });

    it('should return error for invalid pubkey in DID', async () => {
      const result = await resolveNostrDid('did:nostr:invalid');

      expect(result.didDocument).toBeNull();
      expect(result.didResolutionMetadata.error).toBe('invalidDid');
    });

    it('should include relays in document when provided', async () => {
      const result = await resolveNostrDid(validDid, {
        relays: ['wss://relay.example.com'],
      });

      expect(result.didDocument!.service).toBeDefined();
    });

    it('should use cache for repeated resolutions', async () => {
      // First resolution
      await resolveNostrDid(validDid);

      // Get cache stats
      const stats = getDIDCacheStats();
      expect(stats.didCacheSize).toBe(1);

      // Second resolution should use cache
      await resolveNostrDid(validDid);
    });
  });

  describe('verifyDIDDocument', () => {
    it('should verify valid document', () => {
      const doc = generateDIDDocument(validPubkey);
      const result = verifyDIDDocument(doc, validPubkey);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for DID mismatch', () => {
      const doc = generateDIDDocument(validPubkey);
      const result = verifyDIDDocument(doc, 'b'.repeat(64));

      expect(result.valid).toBe(false);
      expect(result.errors.some((e: string) => e.includes('DID mismatch'))).toBe(true);
    });

    it('should fail for missing context', () => {
      const doc = generateDIDDocument(validPubkey);
      (doc as any)['@context'] = [];

      const result = verifyDIDDocument(doc, validPubkey);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing @context');
    });

    it('should fail for missing verification methods', () => {
      const doc = generateDIDDocument(validPubkey);
      doc.verificationMethod = [];

      const result = verifyDIDDocument(doc, validPubkey);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No verification methods');
    });

    it('should fail when verification method has wrong key', () => {
      const doc = generateDIDDocument(validPubkey);
      doc.verificationMethod[0].publicKeyHex = 'b'.repeat(64);

      const result = verifyDIDDocument(doc, validPubkey);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'No verification method matches the expected public key'
      );
    });

    it('should fail for missing authentication', () => {
      const doc = generateDIDDocument(validPubkey);
      doc.authentication = [];

      const result = verifyDIDDocument(doc, validPubkey);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No authentication methods');
    });
  });

  describe('Cache Management', () => {
    it('should clear all caches', () => {
      // Populate caches
      resolveNostrDid(validDid);

      clearDIDCaches();

      const stats = getDIDCacheStats();
      expect(stats.didCacheSize).toBe(0);
      expect(stats.nip05CacheSize).toBe(0);
    });

    it('should clear specific DID from cache', async () => {
      await resolveNostrDid(validDid);

      clearDIDFromCache(validDid);

      // Resolution should create new cache entry
      await resolveNostrDid(validDid);
    });

    it('should clear specific NIP-05 from cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          names: { user: validPubkey },
        }),
      });

      await verifyNip05('user@example.com', undefined, true);

      clearNip05FromCache('user@example.com');

      await verifyNip05('user@example.com', undefined, true);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should return correct cache stats', async () => {
      await resolveNostrDid(validDid);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          names: { user: validPubkey },
        }),
      });
      await verifyNip05('user@example.com', undefined, true);

      const stats = getDIDCacheStats();

      expect(stats.didCacheSize).toBe(1);
      expect(stats.nip05CacheSize).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid pubkey with special characters', () => {
      expect(isValidPubkey('!@#$%^&*()'.repeat(7))).toBe(false);
    });

    it('should handle very long domain names', async () => {
      const longDomain = 'a'.repeat(255) + '.com';
      const result = await verifyNip05(`user@${longDomain}`, undefined, false);

      expect(result.verified).toBe(false);
    });

    it('should handle unicode in identifier', () => {
      const result = parseNip05Identifier('user\u{1F600}@example.com');
      expect(result).toBeNull();
    });

    it('should handle empty relays array', () => {
      const doc = generateDIDDocument(validPubkey, { relays: [] });

      expect(doc.service).toBeUndefined();
    });

    it('should handle null in NIP-05 response names', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          names: null,
        }),
      });

      const result = await verifyNip05('user@example.com', undefined, false);

      expect(result.verified).toBe(false);
    });
  });
});
