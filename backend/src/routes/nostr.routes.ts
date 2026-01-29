// =============================================================================
// Nostr Authentication Routes - API Endpoints for Nostr DID Authentication
// =============================================================================

import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import {
  NostrMiddleware,
} from '../auth';

const router = Router();

// -----------------------------------------------------------------------------
// Public Routes (No Authentication Required)
// -----------------------------------------------------------------------------

/**
 * POST /api/v1/auth/nostr/challenge
 * Generate authentication challenge for Nostr login
 *
 * Request Body:
 *   - relay?: string - Optional relay URL for NIP-42 compatibility
 *
 * Response:
 *   - challenge: string - 64-character hex challenge
 *   - timestamp: number - Unix timestamp
 *   - expiresAt: number - Challenge expiration timestamp
 *   - relay?: string - Relay URL if provided
 */
router.post(
  '/challenge',
  body('relay').optional().isURL(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors.array() },
      });
    }
    next();
  },
  NostrMiddleware.getChallenge
);

/**
 * POST /api/v1/auth/nostr/login
 * Login with Nostr signed challenge
 *
 * Request Body:
 *   - pubkey: string - 64-character hex public key
 *   - signedEvent: object - Nostr event with challenge response (kind 22242)
 *   - nip05?: string - Optional NIP-05 identifier for verification
 *
 * Response:
 *   - user: object - User profile
 *   - access_token: string - JWT access token
 *   - refresh_token: string - JWT refresh token
 *   - expires_in: number - Token expiration in seconds
 */
router.post(
  '/login',
  body('pubkey')
    .isString()
    .isLength({ min: 64, max: 64 })
    .matches(/^[0-9a-f]{64}$/i)
    .withMessage('Invalid public key format'),
  body('signedEvent').isObject().withMessage('Signed event required'),
  body('signedEvent.id')
    .isString()
    .isLength({ min: 64, max: 64 })
    .matches(/^[0-9a-f]{64}$/i),
  body('signedEvent.pubkey')
    .isString()
    .isLength({ min: 64, max: 64 })
    .matches(/^[0-9a-f]{64}$/i),
  body('signedEvent.created_at').isInt({ min: 0 }),
  body('signedEvent.kind').isInt(),
  body('signedEvent.tags').isArray(),
  body('signedEvent.content').isString(),
  body('signedEvent.sig')
    .isString()
    .isLength({ min: 128, max: 128 })
    .matches(/^[0-9a-f]{128}$/i),
  body('nip05').optional().isString(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors.array() },
      });
    }
    next();
  },
  NostrMiddleware.loginWithNostr
);

/**
 * GET /api/v1/did/:did
 * Resolve a DID document
 *
 * Parameters:
 *   - did: string - DID to resolve (format: did:nostr:<pubkey>)
 *
 * Response:
 *   - didDocument: object - W3C DID Document
 *   - didDocumentMetadata: object - Resolution metadata
 *   - didResolutionMetadata: object - Resolution status
 */
router.get(
  '/did/:did',
  param('did')
    .isString()
    .matches(/^did:nostr:[0-9a-f]{64}$/i)
    .withMessage('Invalid DID format'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid DID format', details: errors.array() },
      });
    }
    next();
  },
  NostrMiddleware.resolveDid
);

// -----------------------------------------------------------------------------
// Protected Routes (JWT Authentication Required)
// -----------------------------------------------------------------------------

// All routes below require authentication
router.use(authenticate);

/**
 * POST /api/v1/auth/nostr/link-challenge
 * Generate challenge for linking Nostr identity to existing account
 *
 * Requires: JWT authentication
 *
 * Request Body:
 *   - relay?: string - Optional relay URL
 *
 * Response:
 *   - challenge: string - 64-character hex challenge
 *   - timestamp: number - Unix timestamp
 *   - expiresAt: number - Challenge expiration timestamp
 */
router.post(
  '/link-challenge',
  body('relay').optional().isURL(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors.array() },
      });
    }
    next();
  },
  NostrMiddleware.getLinkChallenge
);

/**
 * POST /api/v1/auth/nostr/link
 * Link Nostr identity to existing account
 *
 * Requires: JWT authentication
 *
 * Request Body:
 *   - pubkey: string - 64-character hex public key
 *   - signedEvent: object - Nostr event with challenge response
 *   - nip05?: string - Optional NIP-05 identifier
 *
 * Response:
 *   - identity_id: string - Created identity ID
 *   - did: string - DID for the identity
 *   - nip05?: string - NIP-05 identifier if provided
 *   - nip05_verified: boolean - Whether NIP-05 was verified
 */
router.post(
  '/link',
  body('pubkey')
    .isString()
    .isLength({ min: 64, max: 64 })
    .matches(/^[0-9a-f]{64}$/i)
    .withMessage('Invalid public key format'),
  body('signedEvent').isObject().withMessage('Signed event required'),
  body('signedEvent.id')
    .isString()
    .isLength({ min: 64, max: 64 })
    .matches(/^[0-9a-f]{64}$/i),
  body('signedEvent.pubkey')
    .isString()
    .isLength({ min: 64, max: 64 })
    .matches(/^[0-9a-f]{64}$/i),
  body('signedEvent.created_at').isInt({ min: 0 }),
  body('signedEvent.kind').isInt(),
  body('signedEvent.tags').isArray(),
  body('signedEvent.content').isString(),
  body('signedEvent.sig')
    .isString()
    .isLength({ min: 128, max: 128 })
    .matches(/^[0-9a-f]{128}$/i),
  body('nip05').optional().isString(),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: errors.array() },
      });
    }
    next();
  },
  NostrMiddleware.linkNostrIdentity
);

/**
 * DELETE /api/v1/auth/nostr/unlink
 * Unlink Nostr identity from account
 *
 * Requires: JWT authentication
 *
 * Response:
 *   - message: string - Success message
 */
router.delete('/unlink', NostrMiddleware.unlinkNostrIdentity);

/**
 * GET /api/v1/auth/nostr/identity
 * Get current user's Nostr identity
 *
 * Requires: JWT authentication
 *
 * Response:
 *   - identity_id: string - Identity ID
 *   - pubkey: string - Nostr public key
 *   - did: string - DID for the identity
 *   - nip05?: string - NIP-05 identifier
 *   - nip05_verified: boolean - Whether NIP-05 is verified
 *   - did_document: object - W3C DID Document
 *   - created_at: string - Creation timestamp
 *   - updated_at: string - Last update timestamp
 */
router.get('/identity', NostrMiddleware.getNostrIdentity);

export { router as nostrRouter };
export default router;
