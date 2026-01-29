/**
 * Test Server Setup
 *
 * Creates an isolated Express app instance for integration testing
 * with mocked route handlers for testing API contracts.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import helmet from 'helmet';
import cors from 'cors';
import multer from 'multer';

import { UserRole } from '../../src/types';

// Multer configuration for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allowed MIME types
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'text/csv',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Test configuration
const TEST_JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing-only';

// In-memory storage for test data
const testStore = {
  users: new Map<string, any>(),
  calls: new Map<string, any>(),
  applications: new Map<string, any>(),
  assignments: new Map<string, any>(),
  assessments: new Map<string, any>(),
  files: new Map<string, any>(),
  nostrChallenges: new Map<string, any>(),
  nostrIdentities: new Map<string, any>(),
  assessorPools: new Map<string, any[]>(),
  gdprRequests: new Map<string, any>(),
  auditLogs: [] as any[],

  clear() {
    this.users.clear();
    this.calls.clear();
    this.applications.clear();
    this.assignments.clear();
    this.assessments.clear();
    this.files.clear();
    this.nostrChallenges.clear();
    this.nostrIdentities.clear();
    this.assessorPools.clear();
    this.gdprRequests.clear();
    this.auditLogs = [];
  }
};

// Server instance for cleanup
let testServer: Server | null = null;

// Create mock Express app with all routes
function createMockApp(): Application {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Auth middleware helper
  const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      (req as any).user = decoded;
      next();
    } catch {
      return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token' } });
    }
  };

  const requireRole = (...roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!roles.includes(user?.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
    }
    next();
  };

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // =============== AUTH ROUTES ===============

  app.post('/api/v1/auth/register', (req, res) => {
    const { email, password, name, role = 'applicant' } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } });
    }

    if (Array.from(testStore.users.values()).some(u => u.email === email)) {
      return res.status(409).json({ success: false, error: { code: 'EMAIL_EXISTS', message: 'Email already registered' } });
    }

    const userId = uuidv4();
    const [firstName, ...lastParts] = name.split(' ');
    const lastName = lastParts.join(' ') || 'User';

    const user = {
      user_id: userId,
      email,
      first_name: firstName,
      last_name: lastName,
      role,
      created_at: new Date().toISOString(),
    };

    testStore.users.set(userId, { ...user, password_hash: password });

    const token = generateTestToken({ user_id: userId, role, email });
    const refreshToken = generateTestRefreshToken(userId);

    res.status(201).json({
      success: true,
      data: {
        user,
        accessToken: token,
        refreshToken,
      }
    });
  });

  app.post('/api/v1/auth/login', (req, res) => {
    const { email, password } = req.body;

    const user = Array.from(testStore.users.values()).find(u => u.email === email);
    if (!user || user.password_hash !== password) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }

    const token = generateTestToken({ user_id: user.user_id, role: user.role, email: user.email });
    const refreshToken = generateTestRefreshToken(user.user_id);

    res.json({
      success: true,
      data: {
        user: { user_id: user.user_id, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name },
        accessToken: token,
        refreshToken,
      }
    });
  });

  app.post('/api/v1/auth/logout', authenticate, (req, res) => {
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  });

  app.post('/api/v1/auth/refresh', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_TOKEN', message: 'Refresh token required' } });
    }

    try {
      const decoded = jwt.verify(refreshToken, TEST_JWT_SECRET) as any;
      if (decoded.type !== 'refresh') {
        return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid token type' } });
      }

      const user = testStore.users.get(decoded.user_id);
      if (!user) {
        return res.status(401).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
      }

      const newToken = generateTestToken({ user_id: user.user_id, role: user.role, email: user.email });
      res.json({ success: true, data: { accessToken: newToken } });
    } catch {
      return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid refresh token' } });
    }
  });

  app.get('/api/v1/auth/me', authenticate, (req, res) => {
    const user = (req as any).user;
    const fullUser = testStore.users.get(user.user_id);
    res.json({
      success: true,
      data: fullUser ? { user_id: fullUser.user_id, email: fullUser.email, role: fullUser.role, first_name: fullUser.first_name, last_name: fullUser.last_name } : user
    });
  });

  app.put('/api/v1/auth/me', authenticate, (req, res) => {
    const user = (req as any).user;
    const updates = req.body;
    const existing = testStore.users.get(user.user_id);

    if (existing) {
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      testStore.users.set(user.user_id, updated);
    }

    res.json({ success: true, data: { message: 'Profile updated' } });
  });

  app.post('/api/v1/auth/change-password', authenticate, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const user = (req as any).user;
    const existing = testStore.users.get(user.user_id);

    if (!existing || existing.password_hash !== currentPassword) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_PASSWORD', message: 'Current password is incorrect' } });
    }

    existing.password_hash = newPassword;
    testStore.users.set(user.user_id, existing);

    res.json({ success: true, data: { message: 'Password changed successfully' } });
  });

  // =============== NOSTR AUTH ROUTES ===============

  app.post('/api/v1/auth/nostr/challenge', (req, res) => {
    const { relay } = req.body;

    if (relay && !relay.startsWith('wss://') && !relay.startsWith('ws://')) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_RELAY', message: 'Invalid relay URL' } });
    }

    const challenge = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    testStore.nostrChallenges.set(challenge, { challenge, relay, expiresAt, created_at: new Date().toISOString() });

    res.json({
      success: true,
      data: { challenge, timestamp: new Date().toISOString(), expiresAt, relay }
    });
  });

  app.post('/api/v1/auth/nostr/login', (req, res) => {
    const { pubkey, signedEvent, nip05 } = req.body;

    if (!pubkey || pubkey.length !== 64 || !/^[0-9a-f]+$/i.test(pubkey)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PUBKEY', message: 'Invalid public key format' } });
    }

    if (!signedEvent) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_EVENT', message: 'Signed event required' } });
    }

    if (signedEvent.pubkey !== pubkey) {
      return res.status(400).json({ success: false, error: { code: 'PUBKEY_MISMATCH', message: 'Public key mismatch' } });
    }

    if (signedEvent.kind !== 22242) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_KIND', message: 'Invalid event kind' } });
    }

    // Check challenge exists and is not expired
    const challengeTag = signedEvent.tags?.find((t: string[]) => t[0] === 'challenge');
    const challenge = challengeTag?.[1];
    const storedChallenge = testStore.nostrChallenges.get(challenge);

    if (!storedChallenge || new Date(storedChallenge.expiresAt) < new Date()) {
      return res.status(401).json({ success: false, error: { code: 'CHALLENGE_EXPIRED', message: 'Challenge expired or invalid' } });
    }

    // Check event timestamp
    const eventTime = signedEvent.created_at * 1000;
    const now = Date.now();
    if (now - eventTime > 5 * 60 * 1000) {
      return res.status(401).json({ success: false, error: { code: 'EVENT_EXPIRED', message: 'Event too old' } });
    }

    // Simplified signature check - in real implementation would verify cryptographically
    if (signedEvent.sig === '0'.repeat(128)) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid signature' } });
    }

    // Find or create user
    let user = Array.from(testStore.users.values()).find(u => {
      const identity = Array.from(testStore.nostrIdentities.values()).find(i => i.user_id === u.user_id && i.pubkey === pubkey);
      return !!identity;
    });

    if (!user) {
      const userId = uuidv4();
      user = {
        user_id: userId,
        email: `${pubkey.slice(0, 8)}@nostr.local`,
        role: 'applicant',
        first_name: 'Nostr',
        last_name: 'User',
        created_at: new Date().toISOString(),
      };
      testStore.users.set(userId, user);

      testStore.nostrIdentities.set(pubkey, {
        identity_id: uuidv4(),
        user_id: userId,
        pubkey,
        did: `did:nostr:${pubkey}`,
        nip05,
        created_at: new Date().toISOString(),
      });
    }

    const token = generateTestToken({ user_id: user.user_id, role: user.role, email: user.email });

    res.json({
      success: true,
      data: {
        user,
        accessToken: token,
        did: `did:nostr:${pubkey}`,
      }
    });
  });

  app.get('/api/v1/auth/nostr/did/:did', (req, res) => {
    const { did } = req.params;

    if (!did.startsWith('did:nostr:')) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DID', message: 'Invalid DID format' } });
    }

    const pubkey = did.replace('did:nostr:', '');
    if (pubkey.length !== 64 || !/^[0-9a-f]+$/i.test(pubkey)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PUBKEY', message: 'Invalid public key in DID' } });
    }

    const identity = testStore.nostrIdentities.get(pubkey);

    if (!identity) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'DID not found' } });
    }

    res.json({
      success: true,
      data: {
        didDocument: {
          '@context': ['https://www.w3.org/ns/did/v1'],
          id: did,
          verificationMethod: [{
            id: `${did}#key-1`,
            type: 'EcdsaSecp256k1VerificationKey2019',
            controller: did,
            publicKeyHex: pubkey,
          }],
        },
        didDocumentMetadata: { created: identity.created_at },
      }
    });
  });

  app.post('/api/v1/auth/nostr/link-challenge', authenticate, (req, res) => {
    const challenge = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    testStore.nostrChallenges.set(challenge, {
      challenge,
      user_id: (req as any).user.user_id,
      expiresAt,
      created_at: new Date().toISOString(),
    });

    res.json({ success: true, data: { challenge, expiresAt } });
  });

  app.post('/api/v1/auth/nostr/link', authenticate, (req, res) => {
    const { pubkey, signedEvent } = req.body;
    const user = (req as any).user;

    if (!pubkey || pubkey.length !== 64 || !/^[0-9a-f]+$/i.test(pubkey)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PUBKEY', message: 'Invalid public key format' } });
    }

    if (testStore.nostrIdentities.has(pubkey)) {
      return res.status(409).json({ success: false, error: { code: 'ALREADY_LINKED', message: 'Pubkey already linked to another account' } });
    }

    testStore.nostrIdentities.set(pubkey, {
      identity_id: uuidv4(),
      user_id: user.user_id,
      pubkey,
      did: `did:nostr:${pubkey}`,
      created_at: new Date().toISOString(),
    });

    res.json({ success: true, data: { did: `did:nostr:${pubkey}` } });
  });

  app.get('/api/v1/auth/nostr/identity', authenticate, (req, res) => {
    const user = (req as any).user;
    const identity = Array.from(testStore.nostrIdentities.values()).find(i => i.user_id === user.user_id);

    if (!identity) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No Nostr identity linked' } });
    }

    res.json({ success: true, data: identity });
  });

  app.delete('/api/v1/auth/nostr/unlink', authenticate, (req, res) => {
    const user = (req as any).user;
    const identity = Array.from(testStore.nostrIdentities.entries()).find(([, i]) => i.user_id === user.user_id);

    if (!identity) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'No Nostr identity linked' } });
    }

    testStore.nostrIdentities.delete(identity[0]);
    res.json({ success: true, data: { message: 'Identity unlinked' } });
  });

  // =============== FUNDING CALLS ROUTES ===============

  app.get('/api/v1/calls/open', (req, res) => {
    const now = new Date();
    const openCalls = Array.from(testStore.calls.values()).filter(
      c => c.status === 'open' && new Date(c.close_at) > now
    );
    res.json({ success: true, data: openCalls });
  });

  app.get('/api/v1/calls', authenticate, (req, res) => {
    const user = (req as any).user;
    let calls = Array.from(testStore.calls.values());

    if (user.role === 'applicant') {
      calls = calls.filter(c => c.status === 'open');
    }

    res.json({ success: true, data: calls });
  });

  app.post('/api/v1/calls', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const user = (req as any).user;
    const { open_at, close_at } = req.body;

    // Validate dates
    if (open_at) {
      const openDate = new Date(open_at);
      if (isNaN(openDate.getTime())) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_DATE', message: 'Invalid open_at date' } });
      }
    }

    if (close_at) {
      const closeDate = new Date(close_at);
      if (isNaN(closeDate.getTime())) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_DATE', message: 'Invalid close_at date' } });
      }
    }

    const callId = uuidv4();

    const call = {
      call_id: callId,
      ...req.body,
      status: 'draft',
      created_by: user.user_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    testStore.calls.set(callId, call);
    testStore.assessorPools.set(callId, []);

    res.status(201).json({ success: true, data: call });
  });

  app.get('/api/v1/calls/:id', authenticate, (req, res) => {
    const user = (req as any).user;
    const call = testStore.calls.get(req.params.id);

    if (!call) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call not found' } });
    }

    // Applicants can only see open calls details
    if (user.role === 'applicant' && call.status !== 'open') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    res.json({ success: true, data: call });
  });

  app.put('/api/v1/calls/:id', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const call = testStore.calls.get(req.params.id);
    if (!call) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call not found' } });
    }

    const updated = { ...call, ...req.body, updated_at: new Date().toISOString() };
    testStore.calls.set(req.params.id, updated);
    res.json({ success: true, data: updated });
  });

  app.post('/api/v1/calls/:id/open', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const call = testStore.calls.get(req.params.id);
    if (!call) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call not found' } });
    }

    if (call.status !== 'draft') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Can only open draft calls' } });
    }

    call.status = 'open';
    call.updated_at = new Date().toISOString();
    testStore.calls.set(req.params.id, call);
    res.json({ success: true, data: call });
  });

  app.post('/api/v1/calls/:id/close', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const call = testStore.calls.get(req.params.id);
    if (!call) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call not found' } });
    }

    call.status = 'closed';
    call.updated_at = new Date().toISOString();
    testStore.calls.set(req.params.id, call);
    res.json({ success: true, data: call });
  });

  app.get('/api/v1/calls/:id/assessors', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const pool = testStore.assessorPools.get(req.params.id) || [];
    res.json({ success: true, data: pool });
  });

  app.post('/api/v1/calls/:id/assessors', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const { user_id, assessorId } = req.body;
    const assessor = user_id || assessorId;
    const pool = testStore.assessorPools.get(req.params.id) || [];

    if (!pool.some((a: any) => a.user_id === assessor)) {
      pool.push({ user_id: assessor, added_at: new Date().toISOString() });
      testStore.assessorPools.set(req.params.id, pool);
    }

    res.json({ success: true, data: pool });
  });

  app.delete('/api/v1/calls/:id/assessors/:assessorId', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const pool = testStore.assessorPools.get(req.params.id) || [];
    const updatedPool = pool.filter((a: any) => a.user_id !== req.params.assessorId);
    testStore.assessorPools.set(req.params.id, updatedPool);
    res.json({ success: true, data: updatedPool });
  });

  app.get('/api/v1/calls/:id/criteria', authenticate, (req, res) => {
    const call = testStore.calls.get(req.params.id);
    if (!call) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call not found' } });
    }
    res.json({ success: true, data: call.criteria_config || [] });
  });

  app.put('/api/v1/calls/:id/criteria', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const call = testStore.calls.get(req.params.id);
    if (!call) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call not found' } });
    }

    call.criteria_config = req.body.criteria;
    call.updated_at = new Date().toISOString();
    testStore.calls.set(req.params.id, call);

    res.json({ success: true, data: call.criteria_config });
  });

  app.post('/api/v1/calls/:id/clone', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const sourceCall = testStore.calls.get(req.params.id);
    if (!sourceCall) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call not found' } });
    }

    const newCallId = uuidv4();
    const clonedCall = {
      ...sourceCall,
      call_id: newCallId,
      name: req.body.name || `${sourceCall.name} (Copy)`,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    testStore.calls.set(newCallId, clonedCall);
    testStore.assessorPools.set(newCallId, []);

    res.status(201).json({ success: true, data: clonedCall });
  });

  app.delete('/api/v1/calls/:id', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const call = testStore.calls.get(req.params.id);
    if (!call) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Call not found' } });
    }

    // Only draft calls can be deleted
    if (call.status !== 'draft') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Only draft calls can be deleted' } });
    }

    testStore.calls.delete(req.params.id);
    testStore.assessorPools.delete(req.params.id);

    res.json({ success: true, data: { message: 'Call deleted' } });
  });

  app.get('/api/v1/calls/:id/applications', authenticate, (req, res) => {
    const applications = Array.from(testStore.applications.values()).filter(a => a.call_id === req.params.id);
    res.json({ success: true, data: { applications, total: applications.length } });
  });

  // =============== APPLICATIONS ROUTES ===============

  app.get('/api/v1/applications', authenticate, (req, res) => {
    const user = (req as any).user;
    let apps = Array.from(testStore.applications.values());

    if (user.role === 'applicant') {
      apps = apps.filter(a => a.applicant_id === user.user_id);
    }

    res.json({ success: true, data: apps });
  });

  app.get('/api/v1/applications/my', authenticate, (req, res) => {
    const user = (req as any).user;
    const apps = Array.from(testStore.applications.values()).filter(a => a.applicant_id === user.user_id);
    res.json({ success: true, data: apps });
  });

  app.get('/api/v1/applications/call/:callId', authenticate, (req, res) => {
    const applications = Array.from(testStore.applications.values()).filter(a => a.call_id === req.params.callId);
    res.json({ success: true, data: { applications, total: applications.length } });
  });

  app.get('/api/v1/applications/export/:callId', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const applications = Array.from(testStore.applications.values()).filter(a => a.call_id === req.params.callId);
    res.json({ success: true, data: { applications, exported_at: new Date().toISOString() } });
  });

  app.get('/api/v1/applications/download/:callId', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    res.json({ success: true, data: { download_url: `/downloads/${req.params.callId}.zip`, expires_at: new Date(Date.now() + 3600000).toISOString() } });
  });

  app.post('/api/v1/applications', authenticate, (req, res) => {
    const user = (req as any).user;
    const applicationId = uuidv4();
    const refNumber = `APP-${Date.now()}-${applicationId.slice(0, 4).toUpperCase()}`;

    const app = {
      application_id: applicationId,
      reference_number: refNumber,
      ...req.body,
      applicant_id: user.user_id,
      applicant_email: user.email,
      applicant_name: `${user.first_name || 'Test'} ${user.last_name || 'User'}`,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    testStore.applications.set(applicationId, app);
    res.status(201).json({ success: true, data: app });
  });

  app.get('/api/v1/applications/:id', authenticate, (req, res) => {
    const app = testStore.applications.get(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }
    res.json({ success: true, data: app });
  });

  app.put('/api/v1/applications/:id', authenticate, (req, res) => {
    const app = testStore.applications.get(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    const updated = { ...app, ...req.body, updated_at: new Date().toISOString() };
    testStore.applications.set(req.params.id, updated);
    res.json({ success: true, data: updated });
  });

  app.post('/api/v1/applications/:id/submit', authenticate, (req, res) => {
    const app = testStore.applications.get(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    app.status = 'submitted';
    app.submitted_at = new Date().toISOString();
    app.updated_at = new Date().toISOString();
    testStore.applications.set(req.params.id, app);
    res.json({ success: true, data: app });
  });

  app.post('/api/v1/applications/:id/withdraw', authenticate, (req, res) => {
    const app = testStore.applications.get(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    app.status = 'withdrawn';
    app.withdrawn_at = new Date().toISOString();
    app.updated_at = new Date().toISOString();
    testStore.applications.set(req.params.id, app);
    res.json({ success: true, data: app });
  });

  app.post('/api/v1/applications/:id/reopen', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const app = testStore.applications.get(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    app.status = 'reopened';
    app.updated_at = new Date().toISOString();
    testStore.applications.set(req.params.id, app);
    res.json({ success: true, data: app });
  });

  app.post('/api/v1/applications/:id/confirmations', authenticate, (req, res) => {
    const { type } = req.body;
    const app = testStore.applications.get(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    const confirmation = {
      type,
      confirmed_at: new Date().toISOString(),
      ip_address: req.ip || '127.0.0.1',
    };

    if (!app.confirmations) app.confirmations = [];
    app.confirmations.push(confirmation);
    testStore.applications.set(req.params.id, app);
    res.json({ success: true, data: confirmation });
  });

  app.get('/api/v1/applications/:id/confirmations', authenticate, (req, res) => {
    const app = testStore.applications.get(req.params.id);
    if (!app) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }
    res.json({ success: true, data: app.confirmations || [] });
  });

  // File upload with multer
  app.post('/api/v1/applications/:id/files', authenticate, (req, res, next) => {
    upload.array('files', 10)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: 'File size exceeds limit' } });
          }
        }
        if (err.message === 'Invalid file type') {
          return res.status(415).json({ success: false, error: { code: 'INVALID_FILE_TYPE', message: 'File type not allowed' } });
        }
        return res.status(400).json({ success: false, error: { code: 'UPLOAD_ERROR', message: err.message } });
      }

      const user = (req as any).user;
      const app = testStore.applications.get(req.params.id);

      if (!app) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
      }

      // Check if user owns the application
      if (app.applicant_id !== user.user_id && !['coordinator', 'scheme_owner', 'admin'].includes(user.role)) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
      }

      // Check if application is submitted - can't add files to submitted applications
      if (app.status === 'submitted') {
        return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Cannot modify submitted application' } });
      }

      // Check if files were uploaded
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'NO_FILES', message: 'No files attached' } });
      }

      const uploadedFiles = files.map(f => {
        const fileId = uuidv4();
        const file = {
          file_id: fileId,
          application_id: req.params.id,
          filename: `${fileId}-${f.originalname}`,
          original_filename: f.originalname,
          file_size: f.size,
          mime_type: f.mimetype,
          scan_status: 'pending',
          uploaded_at: new Date().toISOString(),
        };

        testStore.files.set(fileId, file);

        // Also attach to application
        if (!app.files) app.files = [];
        app.files.push(file);

        return file;
      });

      testStore.applications.set(req.params.id, app);

      res.json({ success: true, data: uploadedFiles });
    });
  });

  app.get('/api/v1/applications/:id/files', authenticate, (req, res) => {
    const files = Array.from(testStore.files.values()).filter(f => f.application_id === req.params.id);
    res.json({ success: true, data: files });
  });

  app.get('/api/v1/files/:fileId', authenticate, (req, res) => {
    const file = testStore.files.get(req.params.fileId);
    if (!file) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
    }
    res.json({ success: true, data: file });
  });

  app.delete('/api/v1/files/:fileId', authenticate, (req, res) => {
    if (!testStore.files.has(req.params.fileId)) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
    }
    testStore.files.delete(req.params.fileId);
    res.json({ success: true, data: { message: 'File deleted' } });
  });

  app.get('/api/v1/applications/:id/files/:fileId/download', authenticate, (req, res) => {
    const user = (req as any).user;
    const app = testStore.applications.get(req.params.id);

    if (!app) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    const file = testStore.files.get(req.params.fileId);
    if (!file || file.application_id !== req.params.id) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
    }

    // Return a mock presigned URL
    res.json({
      success: true,
      data: {
        download_url: `https://storage.example.com/files/${req.params.fileId}`,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }
    });
  });

  app.delete('/api/v1/applications/:id/files/:fileId', authenticate, (req, res) => {
    const user = (req as any).user;
    const app = testStore.applications.get(req.params.id);

    if (!app) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    // Check ownership
    if (app.applicant_id !== user.user_id && !['coordinator', 'scheme_owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    // Check if application is submitted
    if (app.status === 'submitted') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Cannot modify submitted application' } });
    }

    const file = testStore.files.get(req.params.fileId);
    if (!file || file.application_id !== req.params.id) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'File not found' } });
    }

    testStore.files.delete(req.params.fileId);

    // Remove from application files array
    if (app.files) {
      app.files = app.files.filter((f: any) => f.file_id !== req.params.fileId);
      testStore.applications.set(req.params.id, app);
    }

    res.json({ success: true, data: { message: 'File deleted' } });
  });

  app.delete('/api/v1/applications/:id', authenticate, (req, res) => {
    const user = (req as any).user;
    const app = testStore.applications.get(req.params.id);

    if (!app) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    // Check ownership
    if (app.applicant_id !== user.user_id && !['coordinator', 'scheme_owner', 'admin'].includes(user.role)) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } });
    }

    // Mark as withdrawn (soft delete)
    app.status = 'withdrawn';
    app.withdrawn_at = new Date().toISOString();
    app.updated_at = new Date().toISOString();
    testStore.applications.set(req.params.id, app);

    res.json({ success: true, data: app });
  });

  app.delete('/api/v1/auth/me', authenticate, (req, res) => {
    const user = (req as any).user;
    const { confirm } = req.body;

    if (!confirm) {
      return res.status(400).json({ success: false, error: { code: 'CONFIRMATION_REQUIRED', message: 'Confirmation required for account deletion' } });
    }

    // In production, this would schedule deletion
    // For tests, we'll mark the request as accepted
    res.status(202).json({
      success: true,
      data: {
        message: 'Account deletion request accepted',
        scheduled_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }
    });
  });

  // =============== ASSIGNMENTS ROUTES ===============

  app.get('/api/v1/assignments', authenticate, (req, res) => {
    const user = (req as any).user;
    let assignments = Array.from(testStore.assignments.values());

    if (user.role === 'assessor') {
      assignments = assignments.filter(a => a.assessor_id === user.user_id);
    }

    res.json({ success: true, data: assignments });
  });

  app.post('/api/v1/assignments', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const user = (req as any).user;
    const { application_id, applicationId, assessor_id, assessorId, dueAt } = req.body;
    const appId = application_id || applicationId;
    const assId = assessor_id || assessorId;
    const assignmentId = uuidv4();

    const assignment = {
      assignment_id: assignmentId,
      application_id: appId,
      assessor_id: assId,
      assigned_by: user.user_id,
      due_at: dueAt,
      status: 'pending',
      assigned_at: new Date().toISOString(),
    };

    testStore.assignments.set(assignmentId, assignment);
    res.status(201).json({ success: true, data: assignment });
  });

  app.post('/api/v1/assignments/bulk', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const user = (req as any).user;
    const { call_id, applicationIds, assessorIds, strategy = 'round_robin', assessorsPerApplication = 2 } = req.body;

    const assignments: any[] = [];

    if (applicationIds && assessorIds) {
      // Use provided arrays
      applicationIds.forEach((appId: string, i: number) => {
        for (let j = 0; j < Math.min(assessorsPerApplication, assessorIds.length); j++) {
          const assessorIdx = (i + j) % assessorIds.length; // Round-robin
          const assignmentId = uuidv4();
          const assignment = {
            assignment_id: assignmentId,
            application_id: appId,
            assessor_id: assessorIds[assessorIdx],
            assigned_by: user.user_id,
            status: 'pending',
            assigned_at: new Date().toISOString(),
          };
          testStore.assignments.set(assignmentId, assignment);
          assignments.push(assignment);
        }
      });
    } else if (call_id) {
      // Use call_id to find applications and assessor pool
      const apps = Array.from(testStore.applications.values()).filter(a => a.call_id === call_id && a.status === 'submitted');
      const pool = testStore.assessorPools.get(call_id) || [];

      apps.forEach((app, i) => {
        pool.slice(0, assessorsPerApplication).forEach((assessor: any, j: number) => {
          const assignmentId = uuidv4();
          const assignment = {
            assignment_id: assignmentId,
            application_id: app.application_id,
            assessor_id: assessor.user_id,
            assigned_by: user.user_id,
            status: 'pending',
            assigned_at: new Date().toISOString(),
          };
          testStore.assignments.set(assignmentId, assignment);
          assignments.push(assignment);
        });
      });
    }

    res.json({ success: true, data: { created: assignments.length, assignments } });
  });

  app.get('/api/v1/assignments/:id', authenticate, (req, res) => {
    const assignment = testStore.assignments.get(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }
    res.json({ success: true, data: assignment });
  });

  app.get('/api/v1/assignments/application/:applicationId', authenticate, (req, res) => {
    const assignments = Array.from(testStore.assignments.values()).filter(
      a => a.application_id === req.params.applicationId
    );
    res.json({ success: true, data: assignments });
  });

  app.post('/api/v1/assignments/:id/start', authenticate, (req, res) => {
    const assignment = testStore.assignments.get(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }

    assignment.status = 'in_progress';
    assignment.started_at = new Date().toISOString();
    testStore.assignments.set(req.params.id, assignment);
    res.json({ success: true, data: assignment });
  });

  app.get('/api/v1/calls/:callId/assignments/progress', authenticate, (req, res) => {
    const assignments = Array.from(testStore.assignments.values()).filter(a => {
      const app = testStore.applications.get(a.application_id);
      return app?.call_id === req.params.callId;
    });

    res.json({
      success: true,
      data: {
        total: assignments.length,
        completed: assignments.filter(a => a.status === 'completed').length,
        in_progress: assignments.filter(a => a.status === 'in_progress').length,
        pending: assignments.filter(a => a.status === 'pending').length,
      }
    });
  });

  app.get('/api/v1/assignments/progress/:callId', authenticate, (req, res) => {
    const assignments = Array.from(testStore.assignments.values()).filter(a => {
      const app = testStore.applications.get(a.application_id);
      return app?.call_id === req.params.callId;
    });

    res.json({
      success: true,
      data: {
        total: assignments.length,
        completed: assignments.filter(a => a.status === 'completed').length,
        in_progress: assignments.filter(a => a.status === 'in_progress').length,
        pending: assignments.filter(a => a.status === 'pending').length,
      }
    });
  });

  app.get('/api/v1/assignments/progress/:callId/assessors', authenticate, (req, res) => {
    const pool = testStore.assessorPools.get(req.params.callId) || [];
    const progress = pool.map((assessor: any) => {
      const assignments = Array.from(testStore.assignments.values()).filter(a => {
        const app = testStore.applications.get(a.application_id);
        return app?.call_id === req.params.callId && a.assessor_id === assessor.user_id;
      });

      return {
        assessor_id: assessor.user_id,
        total: assignments.length,
        completed: assignments.filter(a => a.status === 'completed').length,
        pending: assignments.filter(a => a.status === 'pending').length,
      };
    });

    res.json({ success: true, data: progress });
  });

  // =============== ASSESSMENTS ROUTES ===============

  app.get('/api/v1/assessments', authenticate, (req, res) => {
    const user = (req as any).user;
    let assessments = Array.from(testStore.assessments.values());

    if (user.role === 'assessor') {
      const myAssignments = Array.from(testStore.assignments.values())
        .filter(a => a.assessor_id === user.user_id)
        .map(a => a.assignment_id);
      assessments = assessments.filter(a => myAssignments.includes(a.assignment_id));
    }

    res.json({ success: true, data: assessments });
  });

  app.get('/api/v1/assessments/my', authenticate, (req, res) => {
    const user = (req as any).user;
    const myAssignments = Array.from(testStore.assignments.values())
      .filter(a => a.assessor_id === user.user_id);
    res.json({ success: true, data: myAssignments });
  });

  app.get('/api/v1/assessments/assignment/:assignmentId', authenticate, (req, res) => {
    const assignment = testStore.assignments.get(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }

    const assessment = Array.from(testStore.assessments.values()).find(a => a.assignment_id === req.params.assignmentId);
    const application = testStore.applications.get(assignment.application_id);

    res.json({ success: true, data: { assignment, assessment, application } });
  });

  app.put('/api/v1/assessments/assignment/:assignmentId', authenticate, (req, res) => {
    const assignment = testStore.assignments.get(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }

    const { scores, overallComment, coiConfirmed } = req.body;

    // Find existing assessment or create new
    let assessment = Array.from(testStore.assessments.values()).find(
      a => a.assignment_id === req.params.assignmentId
    );

    if (assessment) {
      assessment.scores = scores || assessment.scores;
      assessment.overall_comment = overallComment || assessment.overall_comment;
      assessment.coi_confirmed = coiConfirmed ?? assessment.coi_confirmed;
      assessment.overall_score = assessment.scores.length > 0
        ? assessment.scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / assessment.scores.length
        : 0;
      assessment.updated_at = new Date().toISOString();
      testStore.assessments.set(assessment.assessment_id, assessment);
    } else {
      const assessmentId = uuidv4();
      assessment = {
        assessment_id: assessmentId,
        assignment_id: req.params.assignmentId,
        scores: scores || [],
        overall_score: scores ? scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / scores.length : 0,
        overall_comment: overallComment,
        coi_confirmed: coiConfirmed || false,
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      testStore.assessments.set(assessmentId, assessment);
    }

    res.json({ success: true, data: assessment });
  });

  app.post('/api/v1/assessments/assignment/:assignmentId', authenticate, (req, res) => {
    const assignment = testStore.assignments.get(req.params.assignmentId);
    if (!assignment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assignment not found' } });
    }

    const { scores, overallComment, coiConfirmed } = req.body;
    const assessmentId = uuidv4();

    const assessment = {
      assessment_id: assessmentId,
      assignment_id: req.params.assignmentId,
      scores: scores || [],
      overall_score: scores ? scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / scores.length : 0,
      overall_comment: overallComment,
      coi_confirmed: coiConfirmed || false,
      status: 'submitted',
      created_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    testStore.assessments.set(assessmentId, assessment);

    // Mark assignment as completed
    assignment.status = 'completed';
    assignment.completed_at = new Date().toISOString();
    testStore.assignments.set(req.params.assignmentId, assignment);

    res.json({ success: true, data: assessment });
  });

  app.post('/api/v1/assessments', authenticate, (req, res) => {
    const { assignment_id, scores, overall_comment, coi_confirmed } = req.body;
    const assessmentId = uuidv4();

    const assessment = {
      assessment_id: assessmentId,
      assignment_id,
      scores: scores || [],
      overall_score: scores ? scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / scores.length : 0,
      overall_comment,
      coi_confirmed: coi_confirmed || false,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    testStore.assessments.set(assessmentId, assessment);
    res.status(201).json({ success: true, data: assessment });
  });

  app.get('/api/v1/assessments/:id', authenticate, (req, res) => {
    const assessment = testStore.assessments.get(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assessment not found' } });
    }
    res.json({ success: true, data: assessment });
  });

  app.put('/api/v1/assessments/:id', authenticate, (req, res) => {
    const assessment = testStore.assessments.get(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assessment not found' } });
    }

    const updated = {
      ...assessment,
      ...req.body,
      updated_at: new Date().toISOString(),
    };

    if (req.body.scores) {
      updated.overall_score = req.body.scores.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / req.body.scores.length;
    }

    testStore.assessments.set(req.params.id, updated);
    res.json({ success: true, data: updated });
  });

  app.post('/api/v1/assessments/:id/submit', authenticate, (req, res) => {
    const assessment = testStore.assessments.get(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assessment not found' } });
    }

    assessment.status = 'submitted';
    assessment.submitted_at = new Date().toISOString();
    assessment.updated_at = new Date().toISOString();
    testStore.assessments.set(req.params.id, assessment);

    // Also mark assignment as completed
    const assignment = testStore.assignments.get(assessment.assignment_id);
    if (assignment) {
      assignment.status = 'completed';
      assignment.completed_at = new Date().toISOString();
      testStore.assignments.set(assessment.assignment_id, assignment);
    }

    res.json({ success: true, data: assessment });
  });

  app.post('/api/v1/assessments/:id/return', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const assessment = testStore.assessments.get(req.params.id);
    if (!assessment) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Assessment not found' } });
    }

    assessment.status = 'returned';
    assessment.return_reason = req.body.reason;
    assessment.updated_at = new Date().toISOString();
    testStore.assessments.set(req.params.id, assessment);
    res.json({ success: true, data: assessment });
  });

  // =============== RESULTS ROUTES ===============

  app.get('/api/v1/results/call/:callId', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const apps = Array.from(testStore.applications.values()).filter(a => a.call_id === req.params.callId);

    const results = apps.map(app => {
      const assignments = Array.from(testStore.assignments.values()).filter(a => a.application_id === app.application_id);
      const assessments = assignments.map(a => testStore.assessments.get(
        Array.from(testStore.assessments.values()).find(as => as.assignment_id === a.assignment_id)?.assessment_id
      )).filter(Boolean);

      const avgScore = assessments.length > 0
        ? assessments.reduce((sum, a) => sum + (a?.overall_score || 0), 0) / assessments.length
        : 0;

      return {
        application_id: app.application_id,
        reference_number: app.reference_number,
        applicant_name: app.applicant_name,
        assessments_completed: assessments.filter(a => a?.status === 'submitted').length,
        assessments_total: assignments.length,
        average_score: avgScore,
        status: app.status,
      };
    });

    res.json({ success: true, data: { results, total: results.length } });
  });

  app.get('/api/v1/results/call/:callId/summary', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const apps = Array.from(testStore.applications.values()).filter(a => a.call_id === req.params.callId);
    const allAssessments = Array.from(testStore.assessments.values());

    res.json({
      success: true,
      data: {
        total_applications: apps.length,
        submitted: apps.filter(a => a.status === 'submitted').length,
        assessments_completed: allAssessments.filter(a => a.status === 'submitted').length,
        average_score: allAssessments.length > 0
          ? allAssessments.reduce((sum, a) => sum + (a.overall_score || 0), 0) / allAssessments.length
          : 0,
      }
    });
  });

  app.get('/api/v1/results/call/:callId/ranking', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const apps = Array.from(testStore.applications.values()).filter(a => a.call_id === req.params.callId);

    const ranked = apps.map(app => {
      const assignments = Array.from(testStore.assignments.values()).filter(a => a.application_id === app.application_id);
      const assessments = assignments.map(a =>
        Array.from(testStore.assessments.values()).find(as => as.assignment_id === a.assignment_id)
      ).filter(Boolean);

      const avgScore = assessments.length > 0
        ? assessments.reduce((sum, a) => sum + (a?.overall_score || 0), 0) / assessments.length
        : 0;

      return { ...app, average_score: avgScore };
    }).sort((a, b) => b.average_score - a.average_score).map((app, i) => ({ ...app, rank: i + 1 }));

    res.json({ success: true, data: ranked });
  });

  app.get('/api/v1/results/call/:callId/export', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    res.json({
      success: true,
      data: {
        download_url: `/api/v1/results/call/${req.params.callId}/download`,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }
    });
  });

  app.get('/api/v1/results/call/:callId/export/detailed', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    res.json({
      success: true,
      data: {
        download_url: `/api/v1/results/call/${req.params.callId}/download/detailed`,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      }
    });
  });

  app.get('/api/v1/results/call/:callId/variance', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const apps = Array.from(testStore.applications.values()).filter(a => a.call_id === req.params.callId);

    const varianceData = apps.map(app => {
      const assignments = Array.from(testStore.assignments.values()).filter(a => a.application_id === app.application_id);
      const assessments = assignments.map(a =>
        Array.from(testStore.assessments.values()).find(as => as.assignment_id === a.assignment_id)
      ).filter(Boolean);

      const scores = assessments.map(a => a?.overall_score || 0);
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const variance = scores.length > 1
        ? scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length
        : 0;

      return {
        application_id: app.application_id,
        reference_number: app.reference_number,
        scores,
        average: avg,
        variance,
        high_variance: variance > 25,
      };
    });

    res.json({ success: true, data: varianceData });
  });

  app.get('/api/v1/results/call/:callId/analytics', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const apps = Array.from(testStore.applications.values()).filter(a => a.call_id === req.params.callId);
    const allAssessments = Array.from(testStore.assessments.values());

    res.json({
      success: true,
      data: {
        total_applications: apps.length,
        total_assessments: allAssessments.length,
        completion_rate: apps.length > 0 ? allAssessments.length / (apps.length * 2) : 0,
        score_statistics: {
          min: Math.min(...allAssessments.map(a => a.overall_score || 0)),
          max: Math.max(...allAssessments.map(a => a.overall_score || 0)),
          average: allAssessments.length > 0
            ? allAssessments.reduce((sum, a) => sum + (a.overall_score || 0), 0) / allAssessments.length
            : 0,
        },
      }
    });
  });

  app.get('/api/v1/results/call/:callId/distribution', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const allAssessments = Array.from(testStore.assessments.values());

    // Create score distribution buckets
    const distribution = {
      '0-20': 0,
      '21-40': 0,
      '41-60': 0,
      '61-80': 0,
      '81-100': 0,
    };

    allAssessments.forEach(a => {
      const score = a.overall_score || 0;
      if (score <= 20) distribution['0-20']++;
      else if (score <= 40) distribution['21-40']++;
      else if (score <= 60) distribution['41-60']++;
      else if (score <= 80) distribution['61-80']++;
      else distribution['81-100']++;
    });

    res.json({ success: true, data: distribution });
  });

  app.get('/api/v1/results/application/:appId/breakdown', authenticate, (req, res) => {
    const app = testStore.applications.get(req.params.appId);
    if (!app) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    const assignments = Array.from(testStore.assignments.values()).filter(a => a.application_id === req.params.appId);
    const assessments = assignments.map(a =>
      Array.from(testStore.assessments.values()).find(as => as.assignment_id === a.assignment_id)
    ).filter(Boolean);

    const breakdown = {
      application_id: app.application_id,
      assessments: assessments.map(a => ({
        assessment_id: a?.assessment_id,
        scores: a?.scores,
        overall_score: a?.overall_score,
        overall_comment: a?.overall_comment,
      })),
      average_score: assessments.length > 0
        ? assessments.reduce((sum, a) => sum + (a?.overall_score || 0), 0) / assessments.length
        : 0,
    };

    res.json({ success: true, data: breakdown });
  });

  app.get('/api/v1/assessments/call/:callId', authenticate, requireRole('coordinator', 'scheme_owner', 'admin'), (req, res) => {
    const apps = Array.from(testStore.applications.values()).filter(a => a.call_id === req.params.callId);
    const appIds = apps.map(a => a.application_id);
    const assignments = Array.from(testStore.assignments.values()).filter(a => appIds.includes(a.application_id));
    const assessments = assignments.map(a =>
      Array.from(testStore.assessments.values()).find(as => as.assignment_id === a.assignment_id)
    ).filter(Boolean);

    res.json({ success: true, data: assessments });
  });

  app.get('/api/v1/results/application/:appId', authenticate, (req, res) => {
    const app = testStore.applications.get(req.params.appId);
    if (!app) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    const assignments = Array.from(testStore.assignments.values()).filter(a => a.application_id === req.params.appId);
    const assessments = assignments.map(a =>
      Array.from(testStore.assessments.values()).find(as => as.assignment_id === a.assignment_id)
    ).filter(Boolean);

    res.json({ success: true, data: { application: app, assessments } });
  });

  // =============== GDPR ROUTES ===============

  app.post('/api/v1/gdpr/export', authenticate, (req, res) => {
    const user = (req as any).user;
    const requestId = uuidv4();

    const request = {
      request_id: requestId,
      user_id: user.user_id,
      request_type: 'export',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    testStore.gdprRequests.set(requestId, request);

    res.status(202).json({
      success: true,
      data: {
        request_id: requestId,
        status: 'pending',
        estimated_completion: new Date(Date.now() + 86400000).toISOString(),
      }
    });
  });

  app.get('/api/v1/gdpr/export/:requestId', authenticate, (req, res) => {
    const request = testStore.gdprRequests.get(req.params.requestId);
    if (!request) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Request not found' } });
    }

    // Simulate completion
    request.status = 'completed';
    request.completed_at = new Date().toISOString();
    testStore.gdprRequests.set(req.params.requestId, request);

    res.json({
      success: true,
      data: {
        ...request,
        download_url: `/api/v1/gdpr/export/${req.params.requestId}/download`,
      }
    });
  });

  app.post('/api/v1/gdpr/delete', authenticate, (req, res) => {
    const user = (req as any).user;
    const { confirmation } = req.body;

    if (confirmation !== 'DELETE MY DATA') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_CONFIRMATION', message: 'Invalid confirmation phrase' } });
    }

    const requestId = uuidv4();
    const request = {
      request_id: requestId,
      user_id: user.user_id,
      request_type: 'deletion',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    testStore.gdprRequests.set(requestId, request);

    res.status(202).json({
      success: true,
      data: {
        request_id: requestId,
        status: 'pending',
        message: 'Deletion request submitted',
      }
    });
  });

  app.get('/api/v1/gdpr/requests', authenticate, (req, res) => {
    const user = (req as any).user;
    const requests = Array.from(testStore.gdprRequests.values()).filter(r => r.user_id === user.user_id);
    res.json({ success: true, data: requests });
  });

  // =============== AUDIT ROUTES ===============

  app.get('/api/v1/audit/user/:userId', authenticate, requireRole('admin'), (req, res) => {
    const logs = testStore.auditLogs.filter(l => l.actor_id === req.params.userId);
    res.json({ success: true, data: logs });
  });

  // Catch-all 404
  app.use((req, res) => {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
  });

  // Error handler
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Test server error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  });

  return app;
}

// Create and export the mock app
const mockApp = createMockApp();

/**
 * Get the Express app for testing
 */
export function getTestApp(): Application {
  return mockApp;
}

/**
 * Clear all test data
 */
export function clearTestData(): void {
  testStore.clear();
}

/**
 * Start test server on a random available port
 */
export async function startTestServer(port: number = 0): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    testServer = mockApp.listen(port, () => {
      const address = testServer!.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      resolve({ server: testServer!, port: actualPort });
    });

    testServer.on('error', reject);
  });
}

/**
 * Stop the test server
 */
export async function stopTestServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (testServer) {
      testServer.close((err) => {
        testServer = null;
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
}

/**
 * Create a supertest request agent
 */
export function createTestAgent() {
  return request(mockApp);
}

/**
 * Generate a valid JWT token for testing
 */
export function generateTestToken(user: { user_id: string; role: string | UserRole; email?: string }): string {
  const payload = {
    user_id: user.user_id,
    id: user.user_id,
    email: user.email || `${user.role}@test.com`,
    role: user.role,
    first_name: 'Test',
    last_name: 'User',
    type: 'access',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  return jwt.sign(payload, TEST_JWT_SECRET, { algorithm: 'HS256' });
}

/**
 * Generate a refresh token for testing
 */
export function generateTestRefreshToken(userId: string): string {
  const payload = {
    user_id: userId,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
  };

  return jwt.sign(payload, TEST_JWT_SECRET, { algorithm: 'HS256' });
}

/**
 * Generate an expired token for testing auth failures
 */
export function generateExpiredToken(user: { user_id: string; role: string | UserRole; email?: string }): string {
  const payload = {
    user_id: user.user_id,
    email: user.email || `${user.role}@test.com`,
    role: user.role,
    type: 'access',
    iat: Math.floor(Date.now() / 1000) - 7200,
    exp: Math.floor(Date.now() / 1000) - 3600,
  };

  return jwt.sign(payload, TEST_JWT_SECRET, { algorithm: 'HS256' });
}

/**
 * Create test user data for different roles
 */
export const TestUsers = {
  applicant: () => ({
    user_id: uuidv4(),
    email: `applicant-${Date.now()}@test.com`,
    role: UserRole.APPLICANT,
    first_name: 'Test',
    last_name: 'Applicant',
  }),

  assessor: () => ({
    user_id: uuidv4(),
    email: `assessor-${Date.now()}@test.com`,
    role: UserRole.ASSESSOR,
    first_name: 'Test',
    last_name: 'Assessor',
  }),

  coordinator: () => ({
    user_id: uuidv4(),
    email: `coordinator-${Date.now()}@test.com`,
    role: UserRole.COORDINATOR,
    first_name: 'Test',
    last_name: 'Coordinator',
  }),

  admin: () => ({
    user_id: uuidv4(),
    email: `admin-${Date.now()}@test.com`,
    role: UserRole.ADMIN,
    first_name: 'Test',
    last_name: 'Admin',
  }),

  schemeOwner: () => ({
    user_id: uuidv4(),
    email: `owner-${Date.now()}@test.com`,
    role: UserRole.SCHEME_OWNER,
    first_name: 'Test',
    last_name: 'Owner',
  }),
};

/**
 * Create an authenticated request helper
 */
export class AuthenticatedRequest {
  private agent = request(mockApp);
  private token: string;

  constructor(user: { user_id: string; role: string | UserRole }) {
    this.token = generateTestToken(user);
  }

  get(url: string) {
    return this.agent.get(url).set('Authorization', `Bearer ${this.token}`);
  }

  post(url: string) {
    return this.agent.post(url).set('Authorization', `Bearer ${this.token}`);
  }

  put(url: string) {
    return this.agent.put(url).set('Authorization', `Bearer ${this.token}`);
  }

  patch(url: string) {
    return this.agent.patch(url).set('Authorization', `Bearer ${this.token}`);
  }

  delete(url: string) {
    return this.agent.delete(url).set('Authorization', `Bearer ${this.token}`);
  }
}

/**
 * Wait for a specified time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a mock file buffer for upload tests
 */
export function createMockFile(options: {
  content?: string | Buffer;
  filename?: string;
  mimetype?: string;
} = {}): { buffer: Buffer; originalname: string; mimetype: string; size: number } {
  const content = options.content || 'Mock file content for testing';
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

  return {
    buffer,
    originalname: options.filename || 'test-file.pdf',
    mimetype: options.mimetype || 'application/pdf',
    size: buffer.length,
  };
}

/**
 * Create a mock PDF file
 */
export function createMockPDF(): { buffer: Buffer; originalname: string; mimetype: string } {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>
endobj
xref
0 4
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
trailer
<< /Size 4 /Root 1 0 R >>
startxref
191
%%EOF`;

  return {
    buffer: Buffer.from(pdfContent),
    originalname: 'test-document.pdf',
    mimetype: 'application/pdf',
  };
}

/**
 * Helper to extract response data
 */
export function extractData<T>(response: request.Response): T {
  if (response.body?.data) {
    return response.body.data as T;
  }
  return response.body as T;
}

/**
 * Helper to extract error from response
 */
export function extractError(response: request.Response): { code: string; message: string; details?: unknown } | null {
  if (response.body?.error) {
    return response.body.error;
  }
  return null;
}

/**
 * Assert successful API response
 */
export function expectSuccess(response: request.Response, statusCode: number = 200): void {
  expect(response.status).toBe(statusCode);
  expect(response.body).toHaveProperty('success', true);
}

/**
 * Assert failed API response
 */
export function expectError(response: request.Response, statusCode: number, errorCode?: string): void {
  expect(response.status).toBe(statusCode);
  expect(response.body).toHaveProperty('success', false);
  if (errorCode) {
    expect(response.body.error?.code).toBe(errorCode);
  }
}

// Seed test data helper
export function seedTestUser(userData: any) {
  testStore.users.set(userData.user_id, userData);
}

export function seedTestCall(callData: any) {
  testStore.calls.set(callData.call_id, callData);
  testStore.assessorPools.set(callData.call_id, []);
}

export function seedTestApplication(appData: any) {
  testStore.applications.set(appData.application_id, appData);
}

export default {
  getTestApp,
  clearTestData,
  startTestServer,
  stopTestServer,
  createTestAgent,
  generateTestToken,
  generateTestRefreshToken,
  generateExpiredToken,
  TestUsers,
  AuthenticatedRequest,
  wait,
  createMockFile,
  createMockPDF,
  extractData,
  extractError,
  expectSuccess,
  expectError,
  seedTestUser,
  seedTestCall,
  seedTestApplication,
};
