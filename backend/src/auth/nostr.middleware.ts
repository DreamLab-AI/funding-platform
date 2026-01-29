// =============================================================================
// Nostr Authentication Middleware - Express Middleware for Nostr Auth
// =============================================================================

import { Response, NextFunction } from 'express';
import { AuthRequest, AuthenticatedUser, UserRole } from '../types';
import { AuthenticationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { UserModel } from '../models/user.model';
import { createTokenPair } from '../middleware/auth.middleware';
import { createAuditLog } from '../middleware/audit.middleware';
import { AuditAction } from '../types';
import NostrService, { NostrEvent, NostrAuthChallenge } from './nostr.service';
import DIDService from './did.service';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NostrAuthRequest extends AuthRequest {
  nostrPubkey?: string;
  nostrIdentity?: {
    pubkey: string;
    did: string;
    nip05?: string;
    nip05Verified?: boolean;
  };
}

interface ChallengeResponse {
  success: boolean;
  data?: NostrAuthChallenge;
  error?: { code: string; message: string };
}

interface LoginResponse {
  success: boolean;
  data?: {
    user: Record<string, unknown>;
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  error?: { code: string; message: string };
}

// -----------------------------------------------------------------------------
// Middleware Functions
// -----------------------------------------------------------------------------

/**
 * Middleware to authenticate requests using NIP-98 HTTP Auth header
 */
export async function authenticateNostr(
  req: NostrAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Nostr ')) {
      // No Nostr auth, continue to next middleware (might use JWT)
      return next();
    }

    // Parse the NIP-98 event from header
    const event = NostrService.parseNip98Header(authHeader);
    if (!event) {
      throw new AuthenticationError('Invalid Nostr authorization header');
    }

    // Get request URL for verification
    const protocol = req.protocol;
    const host = req.get('host');
    const originalUrl = req.originalUrl;
    const fullUrl = `${protocol}://${host}${originalUrl}`;

    // Verify the NIP-98 auth event
    const verification = await NostrService.verifyNip98Auth(
      event,
      fullUrl,
      req.method
    );

    if (!verification.valid || !verification.pubkey) {
      throw new AuthenticationError(verification.error || 'Nostr authentication failed');
    }

    // Look up user by Nostr pubkey
    const identity = await NostrService.findIdentityByPubkey(verification.pubkey);
    if (!identity) {
      throw new AuthenticationError('No user linked to this Nostr identity');
    }

    // Get user details
    const user = await UserModel.findById(identity.user_id);
    if (!user || !user.is_active) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Set request user
    req.user = {
      user_id: user.user_id,
      id: user.user_id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    // Set Nostr identity info
    req.nostrPubkey = verification.pubkey;
    req.nostrIdentity = {
      pubkey: identity.nostr_pubkey,
      did: identity.did,
      nip05: identity.nip05_identifier || undefined,
      nip05Verified: identity.nip05_verified,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Optional Nostr authentication - doesn't fail if no auth present
 */
export async function optionalNostrAuth(
  req: NostrAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Nostr ')) {
      await authenticateNostr(req, res, next);
    } else {
      next();
    }
  } catch (error) {
    // Log but don't fail
    logger.debug('Optional Nostr auth failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    next();
  }
}

// -----------------------------------------------------------------------------
// Route Handlers
// -----------------------------------------------------------------------------

/**
 * Generate authentication challenge
 * POST /api/v1/auth/nostr/challenge
 */
export async function getChallenge(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const relay = req.body.relay || `${req.protocol}://${req.get('host')}`;
    const challenge = NostrService.generateAuthChallenge(relay);

    const response: ChallengeResponse = {
      success: true,
      data: challenge,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Login with Nostr signed challenge
 * POST /api/v1/auth/nostr/login
 */
export async function loginWithNostr(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { pubkey, signedEvent, nip05 } = req.body as {
      pubkey: string;
      signedEvent: NostrEvent;
      nip05?: string;
    };

    if (!pubkey || !signedEvent) {
      throw new AuthenticationError('Missing pubkey or signed event');
    }

    // Verify the signed event
    const verification = await NostrService.verifyChallengeResponse(signedEvent);
    if (!verification.valid || !verification.pubkey) {
      throw new AuthenticationError(verification.error || 'Challenge verification failed');
    }

    // Verify pubkey matches
    if (verification.pubkey.toLowerCase() !== pubkey.toLowerCase()) {
      throw new AuthenticationError('Public key mismatch');
    }

    // Verify NIP-05 if provided
    let nip05Verified = false;
    if (nip05) {
      const nip05Result = await DIDService.verifyNip05(nip05, pubkey);
      nip05Verified = nip05Result.verified;

      if (!nip05Verified) {
        logger.warn('NIP-05 verification failed during login', {
          nip05,
          pubkey: pubkey.substring(0, 16) + '...',
        });
      }
    }

    // Look up existing identity
    let identity = await NostrService.findIdentityByPubkey(pubkey);

    if (!identity) {
      // No existing identity - could auto-create or require linking
      // For this implementation, we'll require explicit linking
      throw new AuthenticationError(
        'No account linked to this Nostr identity. Please link your identity first.'
      );
    }

    // Get user
    const user = await UserModel.findById(identity.user_id);
    if (!user || !user.is_active) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Update NIP-05 verification if provided and changed
    if (nip05 && (nip05 !== identity.nip05_identifier || nip05Verified !== identity.nip05_verified)) {
      await NostrService.updateIdentityNip05(identity.identity_id, nip05, nip05Verified);
    }

    // Update last login and identity auth tracking
    await UserModel.updateLastLogin(user.user_id);
    await NostrService.updateIdentityLastAuth(identity.identity_id);

    // Create audit log
    await createAuditLog(
      req,
      AuditAction.USER_LOGIN,
      'user',
      user.user_id,
      {
        method: 'nostr',
        pubkey: pubkey.substring(0, 16) + '...',
        nip05,
        nip05Verified,
      }
    );

    // Generate tokens
    const authUser: AuthenticatedUser = {
      user_id: user.user_id,
      id: user.user_id,
      email: user.email,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
    };

    const tokens = createTokenPair(authUser);

    const response: LoginResponse = {
      success: true,
      data: {
        user: { ...UserModel.toPublic(user) } as Record<string, unknown>,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_in: tokens.expiresIn,
      },
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

/**
 * Get challenge for linking Nostr identity
 * POST /api/v1/auth/nostr/link-challenge
 * Requires: JWT authentication
 */
export async function getLinkChallenge(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AuthenticationError();
    }

    const relay = req.body.relay || `${req.protocol}://${req.get('host')}`;
    const challenge = NostrService.generateAuthChallenge(relay);

    res.json({
      success: true,
      data: challenge,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Link Nostr identity to existing account
 * POST /api/v1/auth/nostr/link
 * Requires: JWT authentication
 */
export async function linkNostrIdentity(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AuthenticationError();
    }

    const { pubkey, signedEvent, nip05 } = req.body as {
      pubkey: string;
      signedEvent: NostrEvent;
      nip05?: string;
    };

    if (!pubkey || !signedEvent) {
      throw new AuthenticationError('Missing pubkey or signed event');
    }

    // Verify the signed event
    const verification = await NostrService.verifyChallengeResponse(signedEvent);
    if (!verification.valid || !verification.pubkey) {
      throw new AuthenticationError(verification.error || 'Challenge verification failed');
    }

    // Verify pubkey matches
    if (verification.pubkey.toLowerCase() !== pubkey.toLowerCase()) {
      throw new AuthenticationError('Public key mismatch');
    }

    // Check if user already has a linked identity
    const existingIdentity = await NostrService.findIdentityByUserId(req.user.user_id);
    if (existingIdentity) {
      throw new AuthenticationError('Account already has a linked Nostr identity');
    }

    // Check if pubkey is already linked to another user
    const isLinked = await NostrService.isPubkeyLinked(pubkey, req.user.user_id);
    if (isLinked) {
      throw new AuthenticationError('This Nostr identity is already linked to another account');
    }

    // Verify NIP-05 if provided
    let nip05Verified = false;
    if (nip05) {
      const nip05Result = await DIDService.verifyNip05(nip05, pubkey);
      nip05Verified = nip05Result.verified;
    }

    // Create identity link
    const identity = await NostrService.createUserIdentity(
      req.user.user_id,
      pubkey,
      nip05,
      nip05Verified
    );

    // Create audit log
    await createAuditLog(
      req,
      AuditAction.USER_UPDATED,
      'user',
      req.user.user_id,
      {
        action: 'nostr_identity_linked',
        pubkey: pubkey.substring(0, 16) + '...',
        nip05,
        nip05Verified,
      }
    );

    res.json({
      success: true,
      data: {
        identity_id: identity.identity_id,
        did: identity.did,
        nip05: identity.nip05_identifier,
        nip05_verified: identity.nip05_verified,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Unlink Nostr identity from account
 * DELETE /api/v1/auth/nostr/unlink
 * Requires: JWT authentication
 */
export async function unlinkNostrIdentity(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AuthenticationError();
    }

    // Check if user has a linked identity
    const identity = await NostrService.findIdentityByUserId(req.user.user_id);
    if (!identity) {
      throw new AuthenticationError('No Nostr identity linked to this account');
    }

    // Delete identity link
    await NostrService.deleteUserIdentity(req.user.user_id);

    // Create audit log
    await createAuditLog(
      req,
      AuditAction.USER_UPDATED,
      'user',
      req.user.user_id,
      {
        action: 'nostr_identity_unlinked',
        pubkey: identity.nostr_pubkey.substring(0, 16) + '...',
      }
    );

    res.json({
      success: true,
      data: { message: 'Nostr identity unlinked successfully' },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user's Nostr identity
 * GET /api/v1/auth/nostr/identity
 * Requires: JWT authentication
 */
export async function getNostrIdentity(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AuthenticationError();
    }

    const identity = await NostrService.findIdentityByUserId(req.user.user_id);

    if (!identity) {
      res.json({
        success: true,
        data: null,
      });
      return;
    }

    // Generate DID document
    const nip05Result = identity.nip05_identifier
      ? await DIDService.verifyNip05(identity.nip05_identifier, identity.nostr_pubkey)
      : undefined;

    const didDocument = DIDService.generateDIDDocument(identity.nostr_pubkey, {
      nip05: nip05Result,
    });

    res.json({
      success: true,
      data: {
        identity_id: identity.identity_id,
        pubkey: identity.nostr_pubkey,
        did: identity.did,
        nip05: identity.nip05_identifier,
        nip05_verified: identity.nip05_verified,
        did_document: didDocument,
        created_at: identity.created_at,
        updated_at: identity.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Resolve a DID document
 * GET /api/v1/did/:did
 */
export async function resolveDid(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { did } = req.params;

    if (!did) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_DID', message: 'DID parameter required' },
      });
      return;
    }

    const result = await DIDService.resolveNostrDid(did);

    if (result.didResolutionMetadata.error) {
      res.status(404).json({
        success: false,
        error: {
          code: result.didResolutionMetadata.error,
          message: result.didResolutionMetadata.errorMessage,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

// -----------------------------------------------------------------------------
// Export all handlers
// -----------------------------------------------------------------------------

export const NostrMiddleware = {
  authenticateNostr,
  optionalNostrAuth,
  getChallenge,
  loginWithNostr,
  getLinkChallenge,
  linkNostrIdentity,
  unlinkNostrIdentity,
  getNostrIdentity,
  resolveDid,
};

export default NostrMiddleware;
