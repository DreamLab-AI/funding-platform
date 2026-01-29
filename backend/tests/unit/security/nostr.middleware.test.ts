/**
 * Nostr Middleware Unit Tests
 * Tests NIP-98 HTTP authentication, challenge generation, and identity linking
 */

import { Response, NextFunction } from 'express';
import {
  authenticateNostr,
  optionalNostrAuth,
  getChallenge,
  loginWithNostr,
  getLinkChallenge,
  linkNostrIdentity,
  unlinkNostrIdentity,
  getNostrIdentity,
  resolveDid,
} from '../../../src/auth/nostr.middleware';
import { AuthRequest, UserRole, AuditAction } from '../../../src/types';
import { AuthenticationError } from '../../../src/utils/errors';
import { UserModel } from '../../../src/models/user.model';
import NostrService from '../../../src/auth/nostr.service';
import DIDService from '../../../src/auth/did.service';
import { createTokenPair } from '../../../src/middleware/auth.middleware';
import { createAuditLog } from '../../../src/middleware/audit.middleware';

// Mock dependencies
jest.mock('../../../src/models/user.model');
jest.mock('../../../src/auth/nostr.service');
jest.mock('../../../src/auth/did.service');
jest.mock('../../../src/middleware/auth.middleware');
jest.mock('../../../src/middleware/audit.middleware');
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Nostr Middleware', () => {
  let mockRequest: Partial<AuthRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      body: {},
      params: {},
      protocol: 'https',
      method: 'GET',
      originalUrl: '/api/test',
      get: jest.fn((header: string) => {
        if (header === 'host') return 'example.com';
        return undefined;
      }),
    };
    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  // Test fixtures
  const validPubkey = 'a'.repeat(64);
  const mockNostrEvent = {
    id: 'event-123',
    pubkey: validPubkey,
    created_at: Math.floor(Date.now() / 1000),
    kind: 27235,
    tags: [
      ['u', 'https://example.com/api/test'],
      ['method', 'GET'],
    ],
    content: '',
    sig: 'valid-signature',
  };

  const mockIdentity = {
    identity_id: 'identity-123',
    user_id: 'user-123',
    nostr_pubkey: validPubkey,
    did: `did:nostr:${validPubkey}`,
    nip05_identifier: 'user@example.com',
    nip05_verified: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockUser = {
    user_id: 'user-123',
    email: 'test@example.com',
    role: UserRole.APPLICANT,
    first_name: 'Test',
    last_name: 'User',
    is_active: true,
  };

  describe('authenticateNostr', () => {
    it('should call next when no Nostr auth header', async () => {
      mockRequest.headers = {};

      await authenticateNostr(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next when authorization is not Nostr type', async () => {
      mockRequest.headers = { authorization: 'Bearer jwt-token' };

      await authenticateNostr(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next with error for invalid Nostr header format', async () => {
      mockRequest.headers = { authorization: 'Nostr invalid-base64!' };

      (NostrService.parseNip98Header as jest.Mock).mockReturnValue(null);

      await authenticateNostr(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should authenticate with valid NIP-98 event', async () => {
      const base64Event = Buffer.from(JSON.stringify(mockNostrEvent)).toString(
        'base64'
      );
      mockRequest.headers = { authorization: `Nostr ${base64Event}` };

      (NostrService.parseNip98Header as jest.Mock).mockReturnValue(
        mockNostrEvent
      );
      (NostrService.verifyNip98Auth as jest.Mock).mockResolvedValue({
        valid: true,
        pubkey: validPubkey,
      });
      (NostrService.findIdentityByPubkey as jest.Mock).mockResolvedValue(
        mockIdentity
      );
      (UserModel.findById as jest.Mock).mockResolvedValue(mockUser);

      await authenticateNostr(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockRequest as any).user).toBeDefined();
      expect((mockRequest as any).nostrPubkey).toBe(validPubkey);
    });

    it('should call next with error when NIP-98 verification fails', async () => {
      mockRequest.headers = { authorization: 'Nostr base64event' };

      (NostrService.parseNip98Header as jest.Mock).mockReturnValue(
        mockNostrEvent
      );
      (NostrService.verifyNip98Auth as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Signature invalid',
      });

      await authenticateNostr(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should call next with error when no identity linked', async () => {
      mockRequest.headers = { authorization: 'Nostr base64event' };

      (NostrService.parseNip98Header as jest.Mock).mockReturnValue(
        mockNostrEvent
      );
      (NostrService.verifyNip98Auth as jest.Mock).mockResolvedValue({
        valid: true,
        pubkey: validPubkey,
      });
      (NostrService.findIdentityByPubkey as jest.Mock).mockResolvedValue(null);

      await authenticateNostr(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should call next with error when user is inactive', async () => {
      mockRequest.headers = { authorization: 'Nostr base64event' };

      (NostrService.parseNip98Header as jest.Mock).mockReturnValue(
        mockNostrEvent
      );
      (NostrService.verifyNip98Auth as jest.Mock).mockResolvedValue({
        valid: true,
        pubkey: validPubkey,
      });
      (NostrService.findIdentityByPubkey as jest.Mock).mockResolvedValue(
        mockIdentity
      );
      (UserModel.findById as jest.Mock).mockResolvedValue({
        ...mockUser,
        is_active: false,
      });

      await authenticateNostr(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should set nostrIdentity on request', async () => {
      mockRequest.headers = { authorization: 'Nostr base64event' };

      (NostrService.parseNip98Header as jest.Mock).mockReturnValue(
        mockNostrEvent
      );
      (NostrService.verifyNip98Auth as jest.Mock).mockResolvedValue({
        valid: true,
        pubkey: validPubkey,
      });
      (NostrService.findIdentityByPubkey as jest.Mock).mockResolvedValue(
        mockIdentity
      );
      (UserModel.findById as jest.Mock).mockResolvedValue(mockUser);

      await authenticateNostr(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect((mockRequest as any).nostrIdentity).toMatchObject({
        pubkey: validPubkey,
        did: mockIdentity.did,
        nip05: mockIdentity.nip05_identifier,
        nip05Verified: true,
      });
    });
  });

  describe('optionalNostrAuth', () => {
    it('should continue without error when no Nostr auth', async () => {
      mockRequest.headers = {};

      await optionalNostrAuth(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should pass error through when auth fails (delegates to authenticateNostr)', async () => {
      mockRequest.headers = { authorization: 'Nostr invalid' };

      (NostrService.parseNip98Header as jest.Mock).mockReturnValue(null);

      await optionalNostrAuth(
        mockRequest as any,
        mockResponse as Response,
        mockNext
      );

      // optionalNostrAuth delegates to authenticateNostr which returns the error
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getChallenge', () => {
    it('should return authentication challenge', async () => {
      const mockChallenge = {
        challenge: 'challenge-string',
        relay: 'wss://relay.example.com',
        expiresAt: Date.now() + 300000,
      };

      (NostrService.generateAuthChallenge as jest.Mock).mockReturnValue(
        mockChallenge
      );

      await getChallenge(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockChallenge,
      });
    });

    it('should use provided relay if specified', async () => {
      mockRequest.body = { relay: 'wss://custom.relay.com' };

      await getChallenge(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(NostrService.generateAuthChallenge).toHaveBeenCalledWith(
        'wss://custom.relay.com'
      );
    });

    it('should use default relay from request URL', async () => {
      mockRequest.body = {};

      await getChallenge(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(NostrService.generateAuthChallenge).toHaveBeenCalledWith(
        'https://example.com'
      );
    });
  });

  describe('loginWithNostr', () => {
    beforeEach(() => {
      mockRequest.body = {
        pubkey: validPubkey,
        signedEvent: mockNostrEvent,
        nip05: 'user@example.com',
      };
    });

    it('should call next with error when pubkey missing', async () => {
      mockRequest.body = { signedEvent: mockNostrEvent };

      await loginWithNostr(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should call next with error when signed event missing', async () => {
      mockRequest.body = { pubkey: validPubkey };

      await loginWithNostr(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should call next with error when challenge verification fails', async () => {
      (NostrService.verifyChallengeResponse as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Invalid challenge',
      });

      await loginWithNostr(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should call next with error when pubkey mismatch', async () => {
      (NostrService.verifyChallengeResponse as jest.Mock).mockResolvedValue({
        valid: true,
        pubkey: 'b'.repeat(64), // Different pubkey
      });

      await loginWithNostr(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
      const error = mockNext.mock.calls[0][0] as AuthenticationError;
      expect(error.message).toBe('Public key mismatch');
    });

    it('should call next with error when no identity linked', async () => {
      (NostrService.verifyChallengeResponse as jest.Mock).mockResolvedValue({
        valid: true,
        pubkey: validPubkey,
      });
      (DIDService.verifyNip05 as jest.Mock).mockResolvedValue({
        verified: true,
      });
      (NostrService.findIdentityByPubkey as jest.Mock).mockResolvedValue(null);

      await loginWithNostr(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should login successfully with valid credentials', async () => {
      (NostrService.verifyChallengeResponse as jest.Mock).mockResolvedValue({
        valid: true,
        pubkey: validPubkey,
      });
      (DIDService.verifyNip05 as jest.Mock).mockResolvedValue({
        verified: true,
      });
      (NostrService.findIdentityByPubkey as jest.Mock).mockResolvedValue(
        mockIdentity
      );
      (UserModel.findById as jest.Mock).mockResolvedValue(mockUser);
      (UserModel.updateLastLogin as jest.Mock).mockResolvedValue(undefined);
      (NostrService.updateIdentityLastAuth as jest.Mock).mockResolvedValue(
        undefined
      );
      (NostrService.updateIdentityNip05 as jest.Mock).mockResolvedValue(
        undefined
      );
      (createAuditLog as jest.Mock).mockResolvedValue(undefined);
      (createTokenPair as jest.Mock).mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 1800,
      });
      (UserModel.toPublic as jest.Mock).mockReturnValue(mockUser);

      await loginWithNostr(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          access_token: 'access-token',
          refresh_token: 'refresh-token',
          expires_in: 1800,
        }),
      });
    });

    it('should verify NIP-05 when provided', async () => {
      (NostrService.verifyChallengeResponse as jest.Mock).mockResolvedValue({
        valid: true,
        pubkey: validPubkey,
      });
      (DIDService.verifyNip05 as jest.Mock).mockResolvedValue({
        verified: true,
      });
      (NostrService.findIdentityByPubkey as jest.Mock).mockResolvedValue(
        mockIdentity
      );
      (UserModel.findById as jest.Mock).mockResolvedValue(mockUser);
      (UserModel.updateLastLogin as jest.Mock).mockResolvedValue(undefined);
      (NostrService.updateIdentityLastAuth as jest.Mock).mockResolvedValue(
        undefined
      );
      (NostrService.updateIdentityNip05 as jest.Mock).mockResolvedValue(
        undefined
      );
      (createAuditLog as jest.Mock).mockResolvedValue(undefined);
      (createTokenPair as jest.Mock).mockReturnValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 1800,
      });
      (UserModel.toPublic as jest.Mock).mockReturnValue(mockUser);

      await loginWithNostr(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(DIDService.verifyNip05).toHaveBeenCalledWith(
        'user@example.com',
        validPubkey
      );
    });
  });

  describe('getLinkChallenge', () => {
    it('should call next with error when not authenticated', async () => {
      mockRequest.user = undefined;

      await getLinkChallenge(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should return challenge when authenticated', async () => {
      mockRequest.user = {
        user_id: 'user-123',
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        first_name: 'Test',
        last_name: 'User',
      };

      (NostrService.generateAuthChallenge as jest.Mock).mockReturnValue({
        challenge: 'challenge-string',
      });

      await getLinkChallenge(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { challenge: 'challenge-string' },
      });
    });
  });

  describe('linkNostrIdentity', () => {
    beforeEach(() => {
      mockRequest.user = {
        user_id: 'user-123',
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        first_name: 'Test',
        last_name: 'User',
      };
      mockRequest.body = {
        pubkey: validPubkey,
        signedEvent: mockNostrEvent,
        nip05: 'user@example.com',
      };
    });

    it('should call next with error when not authenticated', async () => {
      mockRequest.user = undefined;

      await linkNostrIdentity(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should call next with error when already has identity', async () => {
      (NostrService.verifyChallengeResponse as jest.Mock).mockResolvedValue({
        valid: true,
        pubkey: validPubkey,
      });
      (NostrService.findIdentityByUserId as jest.Mock).mockResolvedValue(
        mockIdentity
      );

      await linkNostrIdentity(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should call next with error when pubkey already linked', async () => {
      (NostrService.verifyChallengeResponse as jest.Mock).mockResolvedValue({
        valid: true,
        pubkey: validPubkey,
      });
      (NostrService.findIdentityByUserId as jest.Mock).mockResolvedValue(null);
      (NostrService.isPubkeyLinked as jest.Mock).mockResolvedValue(true);

      await linkNostrIdentity(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should link identity successfully', async () => {
      (NostrService.verifyChallengeResponse as jest.Mock).mockResolvedValue({
        valid: true,
        pubkey: validPubkey,
      });
      (NostrService.findIdentityByUserId as jest.Mock).mockResolvedValue(null);
      (NostrService.isPubkeyLinked as jest.Mock).mockResolvedValue(false);
      (DIDService.verifyNip05 as jest.Mock).mockResolvedValue({
        verified: true,
      });
      (NostrService.createUserIdentity as jest.Mock).mockResolvedValue(
        mockIdentity
      );
      (createAuditLog as jest.Mock).mockResolvedValue(undefined);

      await linkNostrIdentity(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          identity_id: 'identity-123',
          did: mockIdentity.did,
        }),
      });
    });
  });

  describe('unlinkNostrIdentity', () => {
    beforeEach(() => {
      mockRequest.user = {
        user_id: 'user-123',
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        first_name: 'Test',
        last_name: 'User',
      };
    });

    it('should call next with error when not authenticated', async () => {
      mockRequest.user = undefined;

      await unlinkNostrIdentity(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should call next with error when no identity linked', async () => {
      (NostrService.findIdentityByUserId as jest.Mock).mockResolvedValue(null);

      await unlinkNostrIdentity(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should unlink identity successfully', async () => {
      (NostrService.findIdentityByUserId as jest.Mock).mockResolvedValue(
        mockIdentity
      );
      (NostrService.deleteUserIdentity as jest.Mock).mockResolvedValue(
        undefined
      );
      (createAuditLog as jest.Mock).mockResolvedValue(undefined);

      await unlinkNostrIdentity(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Nostr identity unlinked successfully' },
      });
    });
  });

  describe('getNostrIdentity', () => {
    beforeEach(() => {
      mockRequest.user = {
        user_id: 'user-123',
        id: 'user-123',
        email: 'test@example.com',
        role: UserRole.APPLICANT,
        first_name: 'Test',
        last_name: 'User',
      };
    });

    it('should call next with error when not authenticated', async () => {
      mockRequest.user = undefined;

      await getNostrIdentity(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should return null when no identity linked', async () => {
      (NostrService.findIdentityByUserId as jest.Mock).mockResolvedValue(null);

      await getNostrIdentity(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });

    it('should return identity with DID document', async () => {
      (NostrService.findIdentityByUserId as jest.Mock).mockResolvedValue(
        mockIdentity
      );
      (DIDService.verifyNip05 as jest.Mock).mockResolvedValue({
        verified: true,
      });
      (DIDService.generateDIDDocument as jest.Mock).mockReturnValue({
        id: mockIdentity.did,
        verificationMethod: [],
      });

      await getNostrIdentity(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          identity_id: 'identity-123',
          pubkey: validPubkey,
          did: mockIdentity.did,
        }),
      });
    });
  });

  describe('resolveDid', () => {
    it('should return 400 when DID not provided', async () => {
      mockRequest.params = {};

      await resolveDid(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: { code: 'INVALID_DID', message: 'DID parameter required' },
      });
    });

    it('should return 404 when DID resolution fails', async () => {
      mockRequest.params = { did: 'did:nostr:invalid' };

      (DIDService.resolveNostrDid as jest.Mock).mockResolvedValue({
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'notFound',
          errorMessage: 'DID not found',
        },
      });

      await resolveDid(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('should return DID document on success', async () => {
      mockRequest.params = { did: `did:nostr:${validPubkey}` };

      (DIDService.resolveNostrDid as jest.Mock).mockResolvedValue({
        didDocument: { id: `did:nostr:${validPubkey}` },
        didDocumentMetadata: {},
        didResolutionMetadata: { contentType: 'application/did+ld+json' },
      });

      await resolveDid(
        mockRequest as AuthRequest,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          didDocument: expect.any(Object),
        }),
      });
    });
  });
});
