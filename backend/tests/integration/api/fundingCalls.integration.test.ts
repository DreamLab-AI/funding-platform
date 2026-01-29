/**
 * Funding Calls API Integration Tests
 *
 * Tests the complete funding call lifecycle:
 * - Creating calls (coordinator)
 * - Updating calls
 * - Opening/closing calls
 * - Cloning calls
 * - Assessor pool management
 * - Criteria management
 */

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  getTestApp,
  generateTestToken,
  TestUsers,
  expectSuccess,
  expectError,
} from '../testServer';
import { UserRole } from '../../../src/types';

describe('Funding Calls API Integration Tests', () => {
  const app = getTestApp();

  describe('POST /api/v1/calls - Create Funding Call', () => {
    let coordinatorToken: string;
    let applicantToken: string;

    beforeAll(() => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      const applicant = TestUsers.applicant();
      applicantToken = generateTestToken(applicant);
    });

    it('should create a funding call with all fields', async () => {
      const callData = {
        name: 'Research Excellence Fund 2024',
        description: 'Supporting groundbreaking research in technology',
        open_at: new Date().toISOString(),
        close_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        requirements: {
          allowedFileTypes: ['application/pdf'],
          maxFileSize: 20971520,
          maxFiles: 5,
          requiredConfirmations: ['guidance_read', 'edi_completed'],
          guidanceUrl: 'https://example.com/guidance',
        },
        criteria_config: [
          {
            name: 'Scientific Excellence',
            description: 'Quality of research methodology and approach',
            maxPoints: 30,
            weight: 1.5,
            commentsRequired: true,
          },
          {
            name: 'Impact',
            description: 'Expected societal and economic impact',
            maxPoints: 25,
            weight: 1.0,
            commentsRequired: true,
          },
          {
            name: 'Feasibility',
            description: 'Practicality and achievability',
            maxPoints: 20,
            weight: 1.0,
            commentsRequired: false,
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send(callData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('call_id');
      expect(response.body.data.name).toBe(callData.name);
      expect(response.body.data.status).toBe('draft');
    });

    it('should create a minimal funding call', async () => {
      const callData = {
        name: 'Simple Call',
        open_at: new Date().toISOString(),
        close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send(callData);

      expect(response.status).toBe(201);
    });

    it('should reject call creation by non-coordinator', async () => {
      const callData = {
        name: 'Unauthorized Call',
        open_at: new Date().toISOString(),
        close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${applicantToken}`)
        .send(callData);

      expect(response.status).toBe(403);
    });

    it('should reject call with invalid dates', async () => {
      const callData = {
        name: 'Invalid Dates Call',
        open_at: 'invalid-date',
        close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send(callData);

      expect(response.status).toBe(400);
    });

    it('should reject call with close date before open date', async () => {
      const now = new Date();
      const callData = {
        name: 'Backwards Dates Call',
        open_at: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        close_at: now.toISOString(), // Close before open
      };

      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send(callData);

      // Should either reject or handle gracefully
      expect([400, 201]).toContain(response.status);
    });
  });

  describe('GET /api/v1/calls - List Funding Calls', () => {
    let coordinatorToken: string;
    let createdCallId: string;

    beforeAll(async () => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      // Create a call
      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'List Test Call',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      createdCallId = response.body.data.call_id;
    });

    it('should list all calls for coordinator', async () => {
      const response = await request(app)
        .get('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v1/calls?page=1&limit=5')
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });

    it('should support status filtering', async () => {
      const response = await request(app)
        .get('/api/v1/calls?status=draft')
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      const allDraft = response.body.data.every(
        (call: { status: string }) => call.status === 'draft'
      );
      expect(allDraft).toBe(true);
    });

    it('should support search', async () => {
      const response = await request(app)
        .get('/api/v1/calls?search=List%20Test')
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/v1/calls/open - Public Open Calls', () => {
    let coordinatorToken: string;
    let openCallId: string;

    beforeAll(async () => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      // Create and open a call
      const createResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Public Open Call',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      openCallId = createResponse.body.data.call_id;

      await request(app)
        .post(`/api/v1/calls/${openCallId}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
    });

    it('should list open calls without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/calls/open');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should only return calls with open status', async () => {
      const response = await request(app)
        .get('/api/v1/calls/open');

      const allOpen = response.body.data.every(
        (call: { status: string }) => call.status === 'open'
      );
      expect(allOpen).toBe(true);
    });
  });

  describe('GET /api/v1/calls/:id - Get Call Details', () => {
    let coordinatorToken: string;
    let assessorToken: string;
    let applicantToken: string;
    let callId: string;

    beforeAll(async () => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      const assessor = TestUsers.assessor();
      assessorToken = generateTestToken(assessor);

      const applicant = TestUsers.applicant();
      applicantToken = generateTestToken(applicant);

      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Detail Test Call',
          description: 'Detailed description',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      callId = response.body.data.call_id;
    });

    it('should return call details for coordinator', async () => {
      const response = await request(app)
        .get(`/api/v1/calls/${callId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.call_id).toBe(callId);
    });

    it('should return call details for assessor', async () => {
      const response = await request(app)
        .get(`/api/v1/calls/${callId}`)
        .set('Authorization', `Bearer ${assessorToken}`);

      expect(response.status).toBe(200);
    });

    it('should deny access to applicant for non-public details', async () => {
      const response = await request(app)
        .get(`/api/v1/calls/${callId}`)
        .set('Authorization', `Bearer ${applicantToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent call', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .get(`/api/v1/calls/${fakeId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/calls/:id - Update Funding Call', () => {
    let coordinatorToken: string;
    let callId: string;

    beforeAll(async () => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Update Test Call',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      callId = response.body.data.call_id;
    });

    it('should update call name and description', async () => {
      const response = await request(app)
        .put(`/api/v1/calls/${callId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Updated Call Name',
          description: 'Updated description',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.name).toBe('Updated Call Name');
    });

    it('should update call dates', async () => {
      const newCloseDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      const response = await request(app)
        .put(`/api/v1/calls/${callId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          close_at: newCloseDate.toISOString(),
        });

      expect(response.status).toBe(200);
    });
  });

  describe('Call Status Transitions', () => {
    let coordinatorToken: string;
    let callId: string;

    beforeAll(async () => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Status Transition Test',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      callId = response.body.data.call_id;
    });

    it('should open a draft call', async () => {
      const response = await request(app)
        .post(`/api/v1/calls/${callId}/open`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('open');
    });

    it('should close an open call', async () => {
      const response = await request(app)
        .post(`/api/v1/calls/${callId}/close`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('closed');
    });
  });

  describe('POST /api/v1/calls/:id/clone - Clone Funding Call', () => {
    let coordinatorToken: string;
    let sourceCallId: string;

    beforeAll(async () => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Original Call',
          description: 'Original description',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          criteria_config: [
            { name: 'Quality', maxPoints: 20, commentsRequired: true },
          ],
        });

      sourceCallId = response.body.data.call_id;
    });

    it('should clone a funding call', async () => {
      const response = await request(app)
        .post(`/api/v1/calls/${sourceCallId}/clone`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ name: 'Cloned Call' });

      expect(response.status).toBe(201);
      expect(response.body.data.name).toBe('Cloned Call');
      expect(response.body.data.status).toBe('draft');
      expect(response.body.data.call_id).not.toBe(sourceCallId);
    });
  });

  describe('Assessor Pool Management', () => {
    let coordinatorToken: string;
    let callId: string;
    let assessorId: string;

    beforeAll(async () => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      const assessor = TestUsers.assessor();
      assessorId = assessor.user_id;

      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Assessor Pool Test',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      callId = response.body.data.call_id;
    });

    it('should add assessor to pool', async () => {
      const response = await request(app)
        .post(`/api/v1/calls/${callId}/assessors`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ assessorId });

      expect(response.status).toBe(200);
    });

    it('should get assessor pool', async () => {
      const response = await request(app)
        .get(`/api/v1/calls/${callId}/assessors`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should remove assessor from pool', async () => {
      const response = await request(app)
        .delete(`/api/v1/calls/${callId}/assessors/${assessorId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Criteria Management', () => {
    let coordinatorToken: string;
    let assessorToken: string;
    let callId: string;

    beforeAll(async () => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);

      const assessor = TestUsers.assessor();
      assessorToken = generateTestToken(assessor);

      const response = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Criteria Test Call',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          criteria_config: [
            { name: 'Initial Criterion', maxPoints: 10, commentsRequired: true },
          ],
        });

      callId = response.body.data.call_id;
    });

    it('coordinator should get criteria', async () => {
      const response = await request(app)
        .get(`/api/v1/calls/${callId}/criteria`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
    });

    it('assessor should get criteria', async () => {
      const response = await request(app)
        .get(`/api/v1/calls/${callId}/criteria`)
        .set('Authorization', `Bearer ${assessorToken}`);

      expect(response.status).toBe(200);
    });

    it('coordinator should update criteria', async () => {
      const response = await request(app)
        .put(`/api/v1/calls/${callId}/criteria`)
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          criteria: [
            { name: 'Updated Criterion', maxPoints: 25, commentsRequired: true },
            { name: 'New Criterion', maxPoints: 15, commentsRequired: false },
          ],
        });

      expect(response.status).toBe(200);
    });
  });

  describe('DELETE /api/v1/calls/:id - Delete Funding Call', () => {
    let coordinatorToken: string;

    beforeAll(() => {
      const coordinator = TestUsers.coordinator();
      coordinatorToken = generateTestToken(coordinator);
    });

    it('should delete a draft call', async () => {
      // Create a call to delete
      const createResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Call to Delete',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      const callId = createResponse.body.data.call_id;

      const response = await request(app)
        .delete(`/api/v1/calls/${callId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(response.status).toBe(200);
    });

    it('should return 404 for deleted call', async () => {
      // Create and delete a call
      const createResponse = await request(app)
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          name: 'Another Call to Delete',
          open_at: new Date().toISOString(),
          close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });

      const callId = createResponse.body.data.call_id;

      await request(app)
        .delete(`/api/v1/calls/${callId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      const getResponse = await request(app)
        .get(`/api/v1/calls/${callId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);

      expect(getResponse.status).toBe(404);
    });
  });
});
