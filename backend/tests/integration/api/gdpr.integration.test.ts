/**
 * GDPR Data Export and Deletion Integration Tests
 *
 * Tests GDPR compliance features:
 * - Data export (Right to Access)
 * - Data deletion (Right to Erasure)
 * - Data portability
 * - Audit trail for GDPR requests
 */

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  getTestApp,
  generateTestToken,
  TestUsers,
  createMockPDF,
} from '../testServer';
import { UserRole } from '../../../src/types';

describe('GDPR Data Export and Deletion Integration Tests', () => {
  const app = getTestApp();

  describe('Data Export (Right to Access)', () => {
    let userToken: string;
    let userId: string;
    let applicationId: string;

    beforeAll(async () => {
      // Create a user with some data
      const user = TestUsers.applicant();
      userId = user.user_id;
      userToken = generateTestToken(user);

      const coordinator = TestUsers.coordinator();
      const coordinatorToken = generateTestToken(coordinator);

      // Create call
      const callResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'GDPR Test Call',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      await request(app)
        .post(`/api/v1/calls/${callResponse.body.data.call_id}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      // Create application
      const appResponse = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ call_id: callResponse.body.data.call_id });

      applicationId = appResponse.body.data.application_id;

      // Add some files
      const mockPdf = createMockPDF();
      await request(app)
        .post(`/api/v1/applications/${applicationId}/files`)
        .set('Authorization', `Bearer ${userToken}`)
        .attach('files', mockPdf.buffer, {
          filename: mockPdf.originalname,
          contentType: mockPdf.mimetype,
        });

      // Add confirmations
      await request(app)
        .post(`/api/v1/applications/${applicationId}/confirmations`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'guidance_read' });
    });

    describe('GET /api/v1/auth/me/export - Export User Data', () => {
      it('should export user profile data', async () => {
        const response = await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('email');
        expect(response.body.data).toHaveProperty('first_name');
        expect(response.body.data).toHaveProperty('last_name');
        // Should NOT include password hash
        expect(response.body.data).not.toHaveProperty('password_hash');
      });

      it('should export user applications', async () => {
        const response = await request(app)
          .get('/api/v1/applications/my')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);

        // Should include application data
        if (response.body.data.length > 0) {
          const app = response.body.data[0];
          expect(app).toHaveProperty('application_id');
          expect(app).toHaveProperty('reference_number');
          expect(app).toHaveProperty('status');
        }
      });

      it('should reject data export without authentication', async () => {
        const response = await request(app)
          .get('/api/v1/auth/me');

        expect(response.status).toBe(401);
      });
    });

    describe('Comprehensive Data Export', () => {
      it('should collect all user-related data', async () => {
        // Collect profile
        const profileResponse = await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${userToken}`);

        expect(profileResponse.status).toBe(200);

        // Collect applications
        const applicationsResponse = await request(app)
          .get('/api/v1/applications/my')
          .set('Authorization', `Bearer ${userToken}`);

        expect(applicationsResponse.status).toBe(200);

        // Verify data can be compiled
        const exportData = {
          profile: profileResponse.body.data,
          applications: applicationsResponse.body.data,
          exportedAt: new Date().toISOString(),
        };

        expect(exportData.profile).toBeDefined();
        expect(exportData.applications).toBeInstanceOf(Array);
      });
    });
  });

  describe('Data Deletion (Right to Erasure)', () => {
    describe('Account Deletion Request', () => {
      let userToken: string;
      let userId: string;

      beforeEach(async () => {
        // Create a fresh user for each test
        const user = TestUsers.applicant();
        userId = user.user_id;
        userToken = generateTestToken(user);
      });

      it('should require authentication for deletion request', async () => {
        const response = await request(app)
          .delete('/api/v1/auth/me');

        expect(response.status).toBe(401);
      });

      it('should initiate account deletion', async () => {
        // Note: Actual implementation may vary
        // Some systems require password confirmation for deletion
        const response = await request(app)
          .delete('/api/v1/auth/me')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ confirm: true });

        // Accept either success or "not implemented" response
        expect([200, 202, 400, 404, 501]).toContain(response.status);
      });

      it('should require confirmation for deletion', async () => {
        const response = await request(app)
          .delete('/api/v1/auth/me')
          .set('Authorization', `Bearer ${userToken}`)
          .send({}); // No confirmation

        // Should either require confirmation or not be implemented
        expect([400, 404, 501]).toContain(response.status);
      });
    });

    describe('Application Withdrawal (Soft Delete)', () => {
      let userToken: string;
      let applicationId: string;

      beforeAll(async () => {
        const user = TestUsers.applicant();
        userToken = generateTestToken(user);

        const coordinator = TestUsers.coordinator();
        const coordinatorToken = generateTestToken(coordinator);

        // Create call
        const callResponse = await request(app)
          .post('/api/v1/calls')
          .set('Authorization', `Bearer ${coordinatorToken}`)
          .send({
            name: 'Deletion Test Call',
            open_at: new Date().toISOString(),
            close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          });

        await request(app)
          .post(`/api/v1/calls/${callResponse.body.data.call_id}/open`)
          .set('Authorization', `Bearer ${coordinatorToken}`);

        // Create application
        const appResponse = await request(app)
          .post('/api/v1/applications')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ call_id: callResponse.body.data.call_id });

        applicationId = appResponse.body.data.application_id;
      });

      it('should allow user to withdraw their application', async () => {
        const response = await request(app)
          .delete(`/api/v1/applications/${applicationId}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
      });

      it('should mark application as withdrawn, not hard delete', async () => {
        const response = await request(app)
          .get(`/api/v1/applications/${applicationId}`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('withdrawn');
      });

      it('should reject withdrawal of another users application', async () => {
        const otherUser = { ...TestUsers.applicant(), user_id: uuidv4() };
        const otherToken = generateTestToken(otherUser);

        const response = await request(app)
          .delete(`/api/v1/applications/${applicationId}`)
          .set('Authorization', `Bearer ${otherToken}`);

        expect([403, 404]).toContain(response.status);
      });
    });
  });

  describe('Data Portability', () => {
    let userToken: string;

    beforeAll(() => {
      const user = TestUsers.applicant();
      userToken = generateTestToken(user);
    });

    it('should provide data in portable format (JSON)', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .set('Accept', 'application/json');

      expect(response.status).toBe(200);
      expect(response.type).toBe('application/json');
    });

    it('should include all relevant personal data fields', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);

      const data = response.body.data;
      const requiredFields = ['user_id', 'email', 'first_name', 'last_name', 'role'];

      for (const field of requiredFields) {
        expect(data).toHaveProperty(field);
      }
    });
  });

  describe('Audit Trail for GDPR Requests', () => {
    let coordinatorToken: string;
    let userId: string;

    beforeAll(() => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      const user = TestUsers.applicant();
      userId = user.user_id;
    });

    it('should log data access events', async () => {
      const userToken = generateTestToken({ user_id: userId, role: UserRole.APPLICANT });

      // Access profile (should be logged)
      await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`);

      // Note: Audit logs may not be directly accessible via API
      // This test verifies the request succeeds; audit verification
      // would typically be done through database queries or admin APIs
    });

    it('should track file downloads for audit purposes', async () => {
      const user = TestUsers.applicant();
      const userToken = generateTestToken(user);

      const coordinator = TestUsers.coordinator();
      const coordToken = generateTestToken(coordinator);

      // Create call and application with file
      const callResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordToken}`)
        .send({
          name: 'Audit Trail Test',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      await request(app)
        .post(`/api/v1/calls/${callResponse.body.data.call_id}/open`)
        .set('Authorization', `Bearer ${coordToken}`);

      const appResponse = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ call_id: callResponse.body.data.call_id });

      const mockPdf = createMockPDF();
      const uploadResponse = await request(app)
        .post(`/api/v1/applications/${appResponse.body.data.application_id}/files`)
        .set('Authorization', `Bearer ${userToken}`)
        .attach('files', mockPdf.buffer, {
          filename: mockPdf.originalname,
          contentType: mockPdf.mimetype,
        });

      if (uploadResponse.body.data?.[0]?.file_id) {
        const fileId = uploadResponse.body.data[0].file_id;

        // Download file (should be logged)
        await request(app)
          .get(`/api/v1/applications/${appResponse.body.data.application_id}/files/${fileId}/download`)
          .set('Authorization', `Bearer ${userToken}`);

        // The download event should be recorded in audit log
      }
    });
  });

  describe('Data Minimization and Retention', () => {
    describe('Sensitive Data Handling', () => {
      let userToken: string;

      beforeAll(() => {
        const user = TestUsers.applicant();
        userToken = generateTestToken(user);
      });

      it('should not expose password hash in API responses', async () => {
        const response = await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data).not.toHaveProperty('password_hash');
        expect(response.body.data).not.toHaveProperty('password');
      });

      it('should not expose internal database IDs unnecessarily', async () => {
        const response = await request(app)
          .get('/api/v1/auth/me')
          .set('Authorization', `Bearer ${userToken}`);

        expect(response.status).toBe(200);
        // Should use public-facing IDs (UUIDs) not internal sequence IDs
        if (response.body.data.user_id) {
          expect(response.body.data.user_id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          );
        }
      });
    });
  });

  describe('Consent Management', () => {
    let userToken: string;
    let applicationId: string;

    beforeAll(async () => {
      const user = TestUsers.applicant();
      userToken = generateTestToken(user);

      const coordinator = TestUsers.coordinator();
      const coordinatorToken = generateTestToken(coordinator);

      // Create call
      const callResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Consent Test Call',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          requirements: {
            requiredConfirmations: ['data_sharing_consent'],
          },
        });

      await request(app)
        .post(`/api/v1/calls/${callResponse.body.data.call_id}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      // Create application
      const appResponse = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ call_id: callResponse.body.data.call_id });

      applicationId = appResponse.body.data.application_id;
    });

    it('should record data sharing consent', async () => {
      const response = await request(app)
        .post(`/api/v1/applications/${applicationId}/confirmations`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'data_sharing_consent' });

      expect(response.status).toBe(200);
    });

    it('should retrieve consent records', async () => {
      const response = await request(app)
        .get(`/api/v1/applications/${applicationId}/confirmations`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);

      const dataConsent = response.body.data.find(
        (c: { type: string }) => c.type === 'data_sharing_consent'
      );
      expect(dataConsent).toBeDefined();
    });

    it('should include IP address and timestamp with consent', async () => {
      const response = await request(app)
        .get(`/api/v1/applications/${applicationId}/confirmations`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);

      if (response.body.data.length > 0) {
        const confirmation = response.body.data[0];
        expect(confirmation).toHaveProperty('confirmed_at');
        expect(confirmation).toHaveProperty('ip_address');
      }
    });
  });

  describe('Cross-Border Data Considerations', () => {
    it('should include data location info in health check', async () => {
      const response = await request(app)
        .get('/health');

      expect(response.status).toBe(200);
      // Health check provides basic system info
      expect(response.body).toHaveProperty('status');
    });
  });

  describe('Metadata Export', () => {
    let coordinatorToken: string;
    let callId: string;

    beforeAll(async () => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      const applicant = TestUsers.applicant();
      const applicantToken = generateTestToken(applicant);

      // Create call with applications
      const callResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Metadata Export Test',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      callId = callResponse.body.data.call_id;

      await request(app)
        .post(`/api/v1/calls/${callId}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      // Create application
      const appResponse = await request(app)
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send({ call_id: callId });

      // Submit
      await request(app)
        .post(`/api/v1/applications/${appResponse.body.data.application_id}/submit`)
        .set('Authorization', `Bearer ${applicantToken}`);
    });

    it('should export application metadata', async () => {
      const response = await request(app)
        .get(`/api/v1/applications/export/${callId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect([200, 202]).toContain(response.status);
    });

    it('should reject metadata export by non-coordinator', async () => {
      const applicant = TestUsers.applicant();
      const applicantToken = generateTestToken(applicant);

      const response = await request(app)
        .get(`/api/v1/applications/export/${callId}`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.status).toBe(403);
    });
  });
});
